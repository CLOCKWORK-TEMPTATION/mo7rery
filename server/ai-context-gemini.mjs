/**
 * @module server/ai-context-gemini
 * @description
 * Backend route لطبقة السياق المُعزَّزة بـ Gemini Flash.
 *
 * يستقبل النص الكامل + التصنيفات المحلية من الفرونت إند،
 * يرسلها لـ Gemini Flash عبر streaming،
 * ويرجع تصحيحات كـ Server-Sent Events (SSE).
 *
 * Route: POST /api/ai/context-enhance → SSE stream
 */

import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import pino from "pino";

config();

const logger = pino({ name: "ai-context-gemini" });

// ─── الثوابت ──────────────────────────────────────────────────────

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_LINES_PER_REQUEST = 500;
const REQUEST_TIMEOUT_MS = 60_000;

// ─── تحليل الإعدادات من البيئة ────────────────────────────────────

const resolveGeminiConfig = (env = process.env) => {
  const apiKey = (env.GEMINI_API_KEY ?? "").trim();
  const model = (env.AI_CONTEXT_MODEL ?? DEFAULT_MODEL).trim();
  const enabled =
    (env.AI_CONTEXT_ENABLED ?? "true").trim().toLowerCase() !== "false";

  return { apiKey, model, enabled };
};

// ─── System Prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `أنت خبير تصنيف سيناريو عربي. مهمتك تحليل السياق الكامل للنص المُصنّف وتصحيح أي تصنيف خاطئ.

## أنواع عناصر السيناريو:
- action: وصف الحدث والمشهد
- character: اسم الشخصية (عادةً سطر قصير ينتهي بنقطتين)
- dialogue: كلام الشخصية
- parenthetical: توجيه أدائي بين قوسين
- scene-header-top-line: رأس مشهد علوي (يحتوي زمان ومكان)
- scene-header-3: رأس مشهد فرعي (وصف زمني/مكاني)
- transition: انتقال بين المشاهد (قطع، مزج)
- basmala: البسملة في بداية المستند

## قواعد السياق:
1. بعد character → يجي dialogue أو parenthetical (مش action)
2. character بعد character → نادر جداً (تحقق من التصنيف)
3. dialogue بعد dialogue بدون character بينهم → dialogue continuation مقبول
4. action بعد scene-header → طبيعي
5. basmala → فقط في بداية المستند

## المطلوب:
- حلل كل سطر في سياقه الكامل (ما قبله وما بعده)
- ارجع تصحيحات فقط للسطور اللي تصنيفها غلط
- كل تصحيح: JSON object في سطر مستقل (JSON Lines format)
- ابدأ بـ [CORRECTIONS_START] وانهي بـ [CORRECTIONS_END]

## شكل التصحيح:
{"lineIndex": N, "correctedType": "type", "confidence": 0.0-1.0, "reason": "سبب مختصر"}

## مهم:
- لو التصنيف صح → ما ترجعش تصحيح ليه
- الثقة لازم تكون > 0.7 عشان تعتبر تصحيح
- ركّز على أخطاء السياق: character↔action, dialogue flow, scene structure`;

// ─── بناء prompt المستخدم ─────────────────────────────────────────

const buildUserPrompt = (classifiedLines) => {
  const formatted = classifiedLines
    .map(
      (line, index) =>
        `[${index}] (${line.assignedType}, ثقة=${line.confidence}%) ${line.text}`
    )
    .join("\n");

  return `## النص المُصنّف:\n${formatted}\n\n## حلل السياق وأرجع التصحيحات:`;
};

// ─── تحليل استجابة Gemini (streaming) ─────────────────────────────

/**
 * Regex لاستخراج JSON objects من النص المتدفق.
 * بيدور على أي JSON object كامل { ... } في سطر مستقل.
 */
const JSON_LINE_RE = /\{[^{}]*"lineIndex"\s*:\s*\d+[^{}]*\}/gu;

/**
 * يحلل chunk نصي ويستخرج منه تصحيحات JSON صالحة.
 */
const parseCorrectionsFromChunk = (text) => {
  const corrections = [];
  const matches = text.match(JSON_LINE_RE);
  if (!matches) return corrections;

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match);
      if (
        typeof parsed.lineIndex === "number" &&
        typeof parsed.correctedType === "string" &&
        typeof parsed.confidence === "number"
      ) {
        corrections.push({
          lineIndex: parsed.lineIndex,
          correctedType: parsed.correctedType,
          confidence: Math.max(0, Math.min(1, parsed.confidence)),
          reason: typeof parsed.reason === "string" ? parsed.reason : "",
          source: "gemini-context",
        });
      }
    } catch {
      // JSON غير صالح — نتجاهل
    }
  }

  return corrections;
};

// ─── Validation ───────────────────────────────────────────────────

const validateRequestBody = (body) => {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body." };
  }

  const { classifiedLines, sessionId } = body;

  if (!Array.isArray(classifiedLines) || classifiedLines.length === 0) {
    return { valid: false, error: "classifiedLines is required and must be a non-empty array." };
  }

  if (classifiedLines.length > MAX_LINES_PER_REQUEST) {
    return {
      valid: false,
      error: `Too many lines: ${classifiedLines.length} (max ${MAX_LINES_PER_REQUEST}).`,
    };
  }

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return { valid: false, error: "sessionId is required." };
  }

  return { valid: true, error: null };
};

// ─── Handler ──────────────────────────────────────────────────────

/**
 * POST /api/ai/context-enhance
 *
 * Body:
 * {
 *   sessionId: string,
 *   classifiedLines: Array<{ text: string, assignedType: string, confidence: number }>
 * }
 *
 * Response: SSE stream
 * - event: correction → { lineIndex, correctedType, confidence, reason, source }
 * - event: done → { totalCorrections }
 * - event: error → { message }
 */
export const handleContextEnhance = async (req, res) => {
  const geminiConfig = resolveGeminiConfig();

  if (!geminiConfig.enabled) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`event: done\ndata: ${JSON.stringify({ totalCorrections: 0, reason: "disabled" })}\n\n`);
    res.end();
    return;
  }

  if (!geminiConfig.apiKey) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`event: error\ndata: ${JSON.stringify({ message: "GEMINI_API_KEY not configured." })}\n\n`);
    res.end();
    return;
  }

  let body;
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "Invalid JSON body." }));
    return;
  }

  const validation = validateRequestBody(body);
  if (!validation.valid) {
    res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: validation.error }));
    return;
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });

  const { classifiedLines, sessionId } = body;
  const startedAt = Date.now();
  let totalCorrections = 0;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });
    const userPrompt = buildUserPrompt(classifiedLines);

    logger.info({
      sessionId,
      model: geminiConfig.model,
      lineCount: classifiedLines.length,
    }, "gemini-context-enhance-start");

    // Streaming call
    const response = await ai.models.generateContentStream({
      model: geminiConfig.model,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    });

    let accumulatedText = "";
    const sentCorrections = new Set();

    for await (const chunk of response) {
      if (res.destroyed) break;

      const chunkText = chunk.text ?? "";
      accumulatedText += chunkText;

      // استخراج تصحيحات من النص المتراكم
      const corrections = parseCorrectionsFromChunk(accumulatedText);

      for (const correction of corrections) {
        // تجنب إرسال نفس التصحيح مرتين
        const key = `${correction.lineIndex}:${correction.correctedType}`;
        if (sentCorrections.has(key)) continue;
        sentCorrections.add(key);

        totalCorrections += 1;
        res.write(`event: correction\ndata: ${JSON.stringify(correction)}\n\n`);
      }
    }

    const latencyMs = Date.now() - startedAt;
    logger.info({
      sessionId,
      totalCorrections,
      latencyMs,
    }, "gemini-context-enhance-complete");

    res.write(
      `event: done\ndata: ${JSON.stringify({ totalCorrections, latencyMs })}\n\n`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ sessionId, error: message }, "gemini-context-enhance-error");

    if (!res.destroyed) {
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    }
  } finally {
    if (!res.destroyed) {
      res.end();
    }
  }
};

// ─── Health check helper ──────────────────────────────────────────

export const getGeminiContextHealth = () => {
  const geminiConfig = resolveGeminiConfig();
  return {
    configured: Boolean(geminiConfig.apiKey),
    enabled: geminiConfig.enabled,
    model: geminiConfig.model,
  };
};

import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { resolveMoonshotChatRuntime } from "./provider-api-runtime.mjs";

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_KIMI_THINKING_MODE = "disabled";

const toDataUrl = (buffer, mimeType) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const toErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error ?? "unknown error");

const isRetryableStatus = (status) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const toOptionalTrimmedString = (value, maxLength = 256) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const isKimiK25Model = (model) => /^kimi-k2\.5(?:$|[-_])/iu.test(model.trim());

const resolveKimiJudgeRuntime = (model) => {
  const moonshotRuntime = resolveMoonshotChatRuntime(process.env);
  const parsedModel =
    toOptionalTrimmedString(model, 128) || String(model ?? "").trim();
  const isK2_5 = parsedModel ? isKimiK25Model(parsedModel) : false;
  const thinkingRaw = toOptionalTrimmedString(
    process.env.KIMI_THINKING_MODE,
    32
  ).toLowerCase();
  const thinkingType =
    thinkingRaw === "enabled" || thinkingRaw === "disabled"
      ? thinkingRaw
      : DEFAULT_KIMI_THINKING_MODE;

  return {
    baseUrl: moonshotRuntime.baseUrl,
    endpoint: moonshotRuntime.chatCompletionsEndpoint,
    model: parsedModel,
    isK2_5,
    thinkingType,
  };
};

const createTimeoutState = (timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
};

const extractAssistantMessageText = (content) => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") return part.trim();
      if (
        part &&
        typeof part === "object" &&
        part.type === "text" &&
        typeof part.text === "string"
      ) {
        return part.text.trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

const parseJsonObject = (raw, label) => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw;
  }

  const text = String(raw ?? "").trim();
  if (!text) {
    throw new Error(`${label} returned empty response.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error(`${label} returned invalid JSON.`);
  }
};

const requestKimiJudge = async ({
  apiKey,
  model,
  imageDataUrl,
  currentText,
  patches,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_MS,
}) => {
  const runtime = resolveKimiJudgeRuntime(model);
  const url = runtime.endpoint;
  let attempt = 0;
  let lastError;

  const prompt = [
    "You are a strict OCR patch judge.",
    "Given page image + current OCR text + proposed patches, decide each patch.",
    "Return JSON only:",
    '{"decisions":[{"id":"string","approve":true,"confidence":0.0,"reason":"string"}]}',
    "Rules:",
    "1) Approve only if page image supports change.",
    "2) Reject speculative language rewrites.",
    "3) Keep structural markers precise.",
    "",
    "Current OCR page text:",
    currentText,
    "",
    "Proposed patches:",
    JSON.stringify(patches),
  ].join("\n");

  while (attempt <= maxRetries) {
    const timeoutState = createTimeoutState(timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: runtime.model,
          response_format: { type: "json_object" },
          ...(runtime.isK2_5
            ? { thinking: { type: runtime.thinkingType } }
            : { temperature: 0 }),
          messages: [
            {
              role: "system",
              content: "Strict OCR patch judge. JSON only.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
        }),
        signal: timeoutState.signal,
      });

      const raw = await response.text();
      if (!response.ok) {
        const error = new Error(
          `kimi-judge failed: ${response.status} ${response.statusText} ${raw}`
        );
        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          attempt += 1;
          await sleep(retryBaseDelayMs * 2 ** Math.max(0, attempt - 1));
          continue;
        }
        throw error;
      }

      const root = parseJsonObject(raw, "kimi-judge-http");
      const choices = Array.isArray(root?.choices) ? root.choices : [];
      const firstChoice = choices[0] ?? {};
      const content = extractAssistantMessageText(firstChoice?.message?.content);
      const parsed = parseJsonObject(content, "kimi-judge-content");
      const decisions = Array.isArray(parsed?.decisions) ? parsed.decisions : [];
      return decisions;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
      attempt += 1;
      await sleep(retryBaseDelayMs * 2 ** Math.max(0, attempt - 1));
    } finally {
      timeoutState.cleanup();
    }
  }

  throw new Error(`kimi-judge failed after retries: ${toErrorMessage(lastError)}`);
};

export const runVisionJudgePreflight = async ({
  apiKey,
  model,
  imagePath,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (typeof imagePath !== "string" || !imagePath.trim()) {
    throw new Error(
      "[PDF_OCR_VISION_JUDGE_PREFLIGHT_INVALID_INPUT] Vision judge preflight failed: first-page image path is required."
    );
  }

  try {
    const imageBuffer = await readFile(imagePath);
    const imageDataUrl = toDataUrl(imageBuffer, "image/png");
    await requestKimiJudge({
      apiKey,
      model,
      imageDataUrl,
      currentText: "preflight",
      patches: [{ id: "preflight", actual: "x", expected: "y" }],
      timeoutMs,
      maxRetries: 0,
    });
  } catch (error) {
    throw new Error(
      `[PDF_OCR_VISION_JUDGE_PREFLIGHT_FAILED] Vision judge preflight failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
};

export const runVisionJudge = async ({
  apiKey,
  model,
  comparePages,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  skipPreflight = false,
}) => {
  if (!Array.isArray(comparePages) || comparePages.length === 0) {
    throw new Error("vision judge requires compare pages.");
  }

  if (!skipPreflight) {
    await runVisionJudgePreflight({
      apiKey,
      model,
      imagePath: comparePages[0].imagePath,
      timeoutMs,
    });
  }

  const approvedPatches = [];
  const rejectedPatches = [];

  for (const page of comparePages) {
    const patches = Array.isArray(page.proposedPatches) ? page.proposedPatches : [];
    if (patches.length === 0) {
      continue;
    }

    const imageBuffer = await readFile(page.imagePath);
    const imageDataUrl = toDataUrl(imageBuffer, "image/png");
    const decisions = await requestKimiJudge({
      apiKey,
      model,
      imageDataUrl,
      currentText: String(page.currentPageText ?? ""),
      patches,
      timeoutMs,
    });

    const decisionsById = new Map(
      decisions
        .filter((item) => item && typeof item.id === "string")
        .map((item) => [
          item.id,
          {
            approve: Boolean(item.approve),
            reason:
              typeof item.reason === "string" && item.reason.trim()
                ? item.reason.trim()
                : "no-reason",
            confidence:
              typeof item.confidence === "number" && Number.isFinite(item.confidence)
                ? item.confidence
                : 0,
          },
        ])
    );

    for (const patch of patches) {
      const decision = decisionsById.get(patch.id);
      if (!decision) {
        rejectedPatches.push({
          ...patch,
          judgeReason: "missing-judge-decision",
          judgeConfidence: 0,
        });
        continue;
      }

      if (decision.approve) {
        approvedPatches.push({
          ...patch,
          judgeReason: decision.reason,
          judgeConfidence: decision.confidence,
        });
      } else {
        rejectedPatches.push({
          ...patch,
          judgeReason: decision.reason,
          judgeConfidence: decision.confidence,
        });
      }
    }
  }

  return {
    approvedPatches,
    rejectedPatches,
  };
};

export const getVisionJudgeRuntime = ({ model }) =>
  resolveKimiJudgeRuntime(model);

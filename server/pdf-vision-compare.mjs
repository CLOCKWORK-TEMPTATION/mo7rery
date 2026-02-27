import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import {
  resolveMistralAgentsRuntime,
  resolveMistralConversationsRuntime,
} from "./provider-api-runtime.mjs";

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const CANONICAL_VISION_COMPARE_MODEL = "mistral-large-2512";
const VISION_COMPARE_REQUEST_SCHEMA = "inputs-v2-no-model-no-completion-args";

const toDataUrl = (buffer, mimeType) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const tokenize = (line) => {
  const tokens = String(line ?? "").match(/[\p{L}\p{N}_]+|[^\s]/gu);
  return Array.isArray(tokens) ? tokens : [];
};

const parseLines = (text) =>
  String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim());

const toErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error ?? "unknown error");

const isRetryableStatus = (status) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const sanitizeRemoteErrorText = (text) => {
  const raw = String(text ?? "");
  if (!raw) return "";

  const withoutDataUrls = raw.replace(
    /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g,
    "data:image/*;base64,[omitted]"
  );
  if (withoutDataUrls.length <= 1200) {
    return withoutDataUrls;
  }
  return `${withoutDataUrls.slice(0, 1200)}…[truncated]`;
};

const toOptionalTrimmedString = (value, maxLength = 256) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const resolveHardLockedCompareModel = (rawModel) => {
  const model = toOptionalTrimmedString(rawModel, 128);
  if (!model) {
    throw new Error(
      `[PDF_OCR_CFG_MISSING_VISION_COMPARE_MODEL] PDF OCR agent misconfigured: PDF_VISION_COMPARE_MODEL is required.`
    );
  }
  if (model !== CANONICAL_VISION_COMPARE_MODEL) {
    throw new Error(
      `[PDF_OCR_CFG_INVALID_VISION_COMPARE_MODEL] PDF OCR agent misconfigured: PDF_VISION_COMPARE_MODEL must be ${CANONICAL_VISION_COMPARE_MODEL}. Received: ${model}`
    );
  }
  return CANONICAL_VISION_COMPARE_MODEL;
};

const resolveMistralCompareRuntime = ({ model }) => {
  const conversationsRuntime = resolveMistralConversationsRuntime(process.env);
  const agentsRuntime = resolveMistralAgentsRuntime(process.env);
  const agentId = toOptionalTrimmedString(
    process.env.PDF_VISION_COMPARE_AGENT_ID ??
      process.env.MISTRAL_VISION_COMPARE_AGENT_ID,
    128
  );
  const lockedModel = resolveHardLockedCompareModel(model);

  return {
    model: lockedModel,
    requestSchema: VISION_COMPARE_REQUEST_SCHEMA,
    api: "conversations",
    agentId: agentId || null,
    endpoint: conversationsRuntime.conversationsEndpoint,
    baseUrl: conversationsRuntime.baseUrl,
    agentsEndpoint: agentsRuntime.agentsEndpoint,
    agentsCompletionsEndpoint: agentsRuntime.agentsCompletionsEndpoint,
    endpointSource: "hard-locked-canonical",
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

const extractTextFromChunks = (chunks) => {
  if (!Array.isArray(chunks)) return "";
  const out = [];
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== "object") continue;

    if (chunk.type === "text" && typeof chunk.text === "string") {
      out.push(chunk.text);
      continue;
    }

    if (chunk.type === "thinking" && Array.isArray(chunk.thinking)) {
      for (const token of chunk.thinking) {
        if (
          token &&
          typeof token === "object" &&
          token.type === "text" &&
          typeof token.text === "string"
        ) {
          out.push(token.text);
        }
      }
    }
  }
  return out.join("").trim();
};

const extractAssistantMessageText = (payload) => {
  const outputs = Array.isArray(payload?.outputs) ? payload.outputs : [];
  for (let index = outputs.length - 1; index >= 0; index -= 1) {
    const output = outputs[index];
    if (!output || typeof output !== "object") continue;

    const role = toOptionalTrimmedString(output.role, 32).toLowerCase();
    const type = toOptionalTrimmedString(output.type, 64).toLowerCase();
    if (role && role !== "assistant") continue;
    if (type && !type.includes("message")) continue;

    if (typeof output.content === "string") {
      const text = output.content.trim();
      if (text) return text;
    }

    const chunkText = extractTextFromChunks(output.content);
    if (chunkText) return chunkText;
  }

  const firstChoice = Array.isArray(payload?.choices)
    ? payload.choices[0]
    : null;
  const choiceMessage = firstChoice?.message?.content;
  if (typeof choiceMessage === "string") {
    const text = choiceMessage.trim();
    if (text) return text;
  }
  if (Array.isArray(choiceMessage)) {
    const chunkText = extractTextFromChunks(choiceMessage);
    if (chunkText) return chunkText;
  }

  return "";
};

const buildVisionTranscriptionPrompt = () =>
  [
    "Extract the visible text from this page image.",
    "Return plain UTF-8 text only.",
    "Do not summarize.",
    "Preserve line breaks and ordering as seen.",
    "Do not add markdown fences or explanations.",
  ].join("\n");

const ensureCompareAgentExists = async ({ apiKey, runtime, timeoutMs }) => {
  if (!runtime.agentId) return;

  const timeoutState = createTimeoutState(timeoutMs);
  try {
    const response = await fetch(
      `${runtime.agentsEndpoint}/${encodeURIComponent(runtime.agentId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: timeoutState.signal,
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `[PDF_OCR_VISION_COMPARE_AGENT_NOT_FOUND] compare agent check failed: ${response.status} ${response.statusText} ${body}`
      );
    }
  } finally {
    timeoutState.cleanup();
  }
};

const requestMistralConversationForImage = async ({
  apiKey,
  model,
  imageDataUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_MS,
}) => {
  const runtime = resolveMistralCompareRuntime({ model });
  const endpoint = runtime.endpoint;
  const prompt = buildVisionTranscriptionPrompt();
  let attempt = 0;
  let lastError;

  await ensureCompareAgentExists({
    apiKey,
    runtime,
    timeoutMs,
  });

  while (attempt <= maxRetries) {
    const timeoutState = createTimeoutState(timeoutMs);
    try {
      const requestPayload = {
        inputs: [
          {
            role: "system",
            content: [{ type: "text", text: "You are a strict visual OCR comparator." }],
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
        stream: false,
        store: false,
      };

      if (runtime.agentId) {
        requestPayload.agent_id = runtime.agentId;
      } else {
        requestPayload.model = runtime.model;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestPayload),
        signal: timeoutState.signal,
      });

      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const safeResponseText = sanitizeRemoteErrorText(responseText);
        const error = new Error(
          `mistral-compare failed [schema=${VISION_COMPARE_REQUEST_SCHEMA}]: ${response.status} ${response.statusText} ${safeResponseText}`
        );
        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          attempt += 1;
          await sleep(retryBaseDelayMs * 2 ** Math.max(0, attempt - 1));
          continue;
        }
        throw error;
      }

      const text = extractAssistantMessageText(payload).trim();
      if (!text) {
        throw new Error(
          "mistral-compare returned empty assistant text for page image."
        );
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
      attempt += 1;
      await sleep(retryBaseDelayMs * 2 ** Math.max(0, attempt - 1));
    } finally {
      timeoutState.cleanup();
    }
  }

  throw new Error(`mistral-compare failed after retries: ${toErrorMessage(lastError)}`);
};

const buildProposedPatches = ({
  page,
  currentText,
  referenceText,
}) => {
  const currentLines = parseLines(currentText);
  const referenceLines = parseLines(referenceText);
  const patches = [];
  let patchSeq = 0;

  const maxLines = Math.max(currentLines.length, referenceLines.length);
  for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
    const currentLine = currentLines[lineIndex] ?? "";
    const referenceLine = referenceLines[lineIndex] ?? "";
    if (currentLine === referenceLine) {
      continue;
    }

    const currentTokens = tokenize(currentLine);
    const referenceTokens = tokenize(referenceLine);
    const maxTokens = Math.max(currentTokens.length, referenceTokens.length);

    for (let tokenIndex = 0; tokenIndex < maxTokens; tokenIndex += 1) {
      const actual = currentTokens[tokenIndex] ?? "";
      const expected = referenceTokens[tokenIndex] ?? "";
      if (actual === expected) {
        continue;
      }

      const operation = expected && actual ? "replace" : expected ? "insert" : "delete";
      patchSeq += 1;
      patches.push({
        id: `p${page}-l${lineIndex + 1}-t${tokenIndex + 1}-${patchSeq}`,
        page,
        line: lineIndex + 1,
        tokenIndex,
        operation,
        actual,
        expected,
        reason: "vision-comparator-diff",
        confidence: operation === "replace" ? 0.82 : 0.75,
      });
    }
  }

  return patches;
};

export const runVisionCompare = async ({
  apiKey,
  model,
  pageImages,
  ocrPages,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (!Array.isArray(pageImages) || pageImages.length === 0) {
    throw new Error("vision compare requires rendered page images.");
  }
  if (!Array.isArray(ocrPages) || ocrPages.length === 0) {
    throw new Error("vision compare requires OCR pages.");
  }

  const resultPages = [];
  for (let pageIndex = 0; pageIndex < pageImages.length; pageIndex += 1) {
    const pageNumber = pageIndex + 1;
    const imagePath = pageImages[pageIndex];
    const imageBuffer = await readFile(imagePath);
    const imageDataUrl = toDataUrl(imageBuffer, "image/png");
    const compareText = await requestMistralConversationForImage({
      apiKey,
      model,
      imageDataUrl,
      timeoutMs,
    });

    const sourcePage = ocrPages[pageIndex] ?? { text: "" };
    const proposedPatches = buildProposedPatches({
      page: pageNumber,
      currentText: sourcePage.text,
      referenceText: compareText,
    });

    resultPages.push({
      page: pageNumber,
      imagePath,
      currentPageText: sourcePage.text,
      referencePageText: compareText,
      proposedPatches,
    });
  }

  return {
    pages: resultPages,
    proposedPatchCount: resultPages.reduce(
      (sum, item) => sum + item.proposedPatches.length,
      0
    ),
  };
};

export const runVisionComparePreflight = async ({
  apiKey,
  model,
  imagePath,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (typeof imagePath !== "string" || !imagePath.trim()) {
    throw new Error(
      "[PDF_OCR_VISION_COMPARE_PREFLIGHT_INVALID_INPUT] Vision compare preflight failed: first-page image path is required."
    );
  }

  try {
    const imageBuffer = await readFile(imagePath);
    const imageDataUrl = toDataUrl(imageBuffer, "image/png");
    await requestMistralConversationForImage({
      apiKey,
      model,
      imageDataUrl,
      timeoutMs,
      maxRetries: 0,
    });
  } catch (error) {
    throw new Error(
      `[PDF_OCR_VISION_COMPARE_PREFLIGHT_FAILED] Vision compare preflight failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
};

export const getVisionCompareRuntime = ({ model }) =>
  resolveMistralCompareRuntime({ model });

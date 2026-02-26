import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pino from "pino";
import { getPdfOcrAgentConfig } from "./pdf-ocr-agent-config.mjs";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_MISTRAL_REQUEST_ADAPTER_PATH = resolve(
  __dirname,
  "mistral-ocr-request-adapter.mjs"
);

const logger = pino({
  name: "pdf-ocr-agent",
  level: process.env.PDF_OCR_AGENT_LOG_LEVEL || "info",
});

const MAX_STDIO_BUFFER = 64 * 1024 * 1024;

const toChildProcessEnv = (overrideEnv = {}) => {
  const merged = { ...process.env, ...overrideEnv };
  const safeEnv = {};

  for (const [key, value] of Object.entries(merged)) {
    if (!key || key.includes("=") || typeof value === "undefined") {
      continue;
    }
    safeEnv[key] = String(value);
  }

  return safeEnv;
};

const toSafePdfFilename = (filename) => {
  const candidate = basename(filename || "document.pdf");
  if (candidate.toLowerCase().endsWith(".pdf")) return candidate;
  return `${candidate}.pdf`;
};

const getMockMode = () =>
  (process.env.PDF_OCR_AGENT_MOCK_MODE || "").trim().toLowerCase();

const buildMockSuccessResult = () => {
  const text =
    process.env.PDF_OCR_AGENT_MOCK_TEXT?.trim() ||
    "هذا نص OCR تجريبي من وضع المحاكاة.";

  return {
    text,
    method: "ocr-mistral",
    usedOcr: true,
    attempts: ["pdf-ocr-agent", "ocr-mistral", "mock-success"],
    warnings: [],
    qualityScore: 1,
  };
};

const parseOcrPayload = (raw) => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `PDF OCR agent produced invalid JSON output: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("PDF OCR agent output is malformed.");
  }

  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  const orderedPages = pages
    .filter(
      (page) =>
        page &&
        typeof page === "object" &&
        typeof page.markdown === "string" &&
        typeof page.index === "number"
    )
    .sort((a, b) => a.index - b.index);

  const text = orderedPages
    .map((page) => page.markdown.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!text.trim()) {
    throw new Error("PDF OCR agent completed but returned empty text.");
  }

  return {
    text,
    pages: orderedPages.length,
    model: typeof payload.model === "string" ? payload.model : "unknown",
  };
};

const buildOcrArguments = (config, inputPath, outputPath) => {
  const adapterPath =
    process.env.PDF_OCR_MISTRAL_REQUEST_ADAPTER_PATH?.trim() ||
    DEFAULT_MISTRAL_REQUEST_ADAPTER_PATH;

  const args = [
    "--import",
    adapterPath,
    "--import",
    "tsx",
    config.ocrScriptPath,
    "--input",
    inputPath,
    "--output",
    outputPath,
  ];

  if (config.pages && config.pages !== "all") {
    args.push("--pages", config.pages);
  }

  return args;
};

export const runPdfOcrAgent = async ({ buffer, filename }) => {
  const config = getPdfOcrAgentConfig();
  if (!config.enabled) {
    throw new Error("PDF OCR agent is disabled by configuration.");
  }

  const mockMode = getMockMode();
  if (mockMode === "success") {
    return buildMockSuccessResult();
  }
  if (mockMode === "failure") {
    throw new Error("PDF OCR agent mocked failure.");
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "filmlane-pdf-ocr-"));
  const inputPath = join(tempRoot, toSafePdfFilename(filename));
  const outputPath = join(tempRoot, "ocr-result.json");

  const startedAt = Date.now();
  logger.info(
    {
      file: filename,
      timeoutMs: config.timeoutMs,
      pages: config.pages,
      script: config.ocrScriptPath,
    },
    "pdf-agent-start"
  );

  try {
    await writeFile(inputPath, buffer);
    const args = buildOcrArguments(config, inputPath, outputPath);

    const { stderr } = await execFileAsync(process.execPath, args, {
      timeout: config.timeoutMs,
      maxBuffer: MAX_STDIO_BUFFER,
      env: toChildProcessEnv({
        MISTRAL_API_KEY: config.mistralApiKey,
      }),
    });

    const outputRaw = await readFile(outputPath, "utf-8");
    const parsed = parseOcrPayload(outputRaw);
    const durationMs = Date.now() - startedAt;

    const warnings = [];
    if (typeof stderr === "string" && stderr.trim()) {
      warnings.push(
        ...stderr
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter(Boolean)
      );
    }

    logger.info(
      {
        file: filename,
        pages: parsed.pages,
        model: parsed.model,
        durationMs,
      },
      "pdf-agent-complete"
    );

    return {
      text: parsed.text,
      method: "ocr-mistral",
      usedOcr: true,
      attempts: ["pdf-ocr-agent", "ocr-mistral"],
      warnings,
      qualityScore: 1,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error(
      {
        file: filename,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      },
      "pdf-agent-failed"
    );
    throw new Error(
      `PDF OCR agent failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
};

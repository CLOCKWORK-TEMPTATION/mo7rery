import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import pino from "pino";
import { getPdfOcrAgentConfig } from "./pdf-ocr-agent-config.mjs";
import { stripOcrArtifactLines } from "./ocr-text-cleanup.mjs";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const toFileUrl = (filePath) => pathToFileURL(filePath).href;

const DEFAULT_MISTRAL_REQUEST_ADAPTER_PATH = resolve(
  __dirname,
  "mistral-ocr-request-adapter.mjs"
);

const logger = pino({
  name: "pdf-ocr-agent",
  level: process.env.PDF_OCR_AGENT_LOG_LEVEL || "info",
});

const MAX_STDIO_BUFFER = 64 * 1024 * 1024;
const CLASSIFY_TIMEOUT_MS = 30_000;
const WRITE_OUTPUT_TIMEOUT_MS = 60_000;
const PIPELINE_OPEN_AGENT_BOOT_TIMEOUT_MS = 10_000;

// ─── دوال مساعدة عامة ─────────────────────────────────────────

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
    attempts: [
      "pdf-ocr-agent",
      "classify",
      "ocr-mistral",
      "write-output",
      "mock-success",
    ],
    warnings: [],
    qualityScore: 1,
    classification: null,
    rawExtractedText: text,
  };
};

const collectStderrWarnings = (stderr) => {
  if (typeof stderr !== "string" || !stderr.trim()) return [];
  return stderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
};

const buildTsxNodeArgs = (scriptPath, scriptArgs = [], extraImports = []) => {
  const nodeArgs = [];

  for (const importTarget of extraImports) {
    if (typeof importTarget === "string" && importTarget.trim()) {
      nodeArgs.push("--import", importTarget.trim());
    }
  }

  nodeArgs.push("--import", "tsx", scriptPath, ...scriptArgs);
  return nodeArgs;
};

const parseJsonObject = (raw, label) => {
  const rawText = typeof raw === "string" ? raw.trim() : "";
  if (!rawText) {
    throw new Error(`${label} returned empty output.`);
  }

  const tryParse = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(rawText);
  if (!parsed) {
    const lines = rawText
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!line.startsWith("{") || !line.endsWith("}")) {
        continue;
      }
      parsed = tryParse(line);
      if (parsed) {
        break;
      }
    }
  }

  if (!parsed) {
    const firstBraceIndex = rawText.indexOf("{");
    const lastBraceIndex = rawText.lastIndexOf("}");
    if (
      firstBraceIndex >= 0 &&
      lastBraceIndex > firstBraceIndex &&
      lastBraceIndex <= rawText.length - 1
    ) {
      parsed = tryParse(rawText.slice(firstBraceIndex, lastBraceIndex + 1));
    }
  }

  if (!parsed) {
    throw new Error(`${label} returned invalid JSON: unable to parse output.`);
  }

  if (typeof parsed !== "object") {
    throw new Error(`${label} returned malformed payload.`);
  }

  return parsed;
};

const runOpenPdfAgentScript = async (
  config,
  inputPath,
  ocrJsonPath,
  outputTxtPath,
  outputMcpMdPath
) => {
  logger.info(
    {
      script: config.openPdfAgentScriptPath,
      file: inputPath,
      pages: config.pages,
    },
    "open-agent-start"
  );

  const args = buildTsxNodeArgs(config.openPdfAgentScriptPath, [
    "--input",
    inputPath,
    "--output-json",
    ocrJsonPath,
    "--output-txt",
    outputTxtPath,
    "--output-mcp-md",
    outputMcpMdPath,
    "--pages",
    config.pages || "all",
  ]);

  const { stdout, stderr } = await execFileAsync(process.execPath, args, {
    timeout: config.timeoutMs + PIPELINE_OPEN_AGENT_BOOT_TIMEOUT_MS,
    maxBuffer: MAX_STDIO_BUFFER,
    env: toChildProcessEnv({
      MISTRAL_API_KEY: config.mistralApiKey,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    }),
  });

  if (stderr?.trim()) {
    logger.debug({ stderr: stderr.trim() }, "open-agent-stderr");
  }

  const payload = parseJsonObject(stdout.trim(), "open-pdf-agent");
  if (payload.success === false) {
    const reason =
      typeof payload.error === "string" ? payload.error : "Unknown agent error";
    throw new Error(`open-pdf-agent failed: ${reason}`);
  }

  logger.info(
    {
      classificationType:
        typeof payload?.classification?.type === "string"
          ? payload.classification.type
          : "unknown",
      mcpSummaryPreview:
        typeof payload?.meta?.mcp?.summary === "string"
          ? payload.meta.mcp.summary.slice(0, 120)
          : null,
    },
    "open-agent-complete"
  );

  return payload;
};

// ─── خطوة 1: تصنيف PDF (classify-pdf.ts) ──────────────────────

const runClassifyScript = async (config, pdfPath) => {
  logger.info(
    { script: config.classifyScriptPath, file: pdfPath },
    "classify-start"
  );

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      buildTsxNodeArgs(config.classifyScriptPath, [pdfPath]),
      {
        timeout: CLASSIFY_TIMEOUT_MS,
        maxBuffer: MAX_STDIO_BUFFER,
        env: toChildProcessEnv({
          MISTRAL_API_KEY: config.mistralApiKey,
        }),
      }
    );

    if (stderr?.trim()) {
      logger.debug({ stderr: stderr.trim() }, "classify-stderr");
    }

    const result = JSON.parse(stdout.trim());
    logger.info(
      {
        type: result.type,
        pages: result.pages,
        engine: result.recommended_engine,
      },
      "classify-complete"
    );
    return result;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "classify-failed"
    );
    return {
      type: "scanned",
      pages: 0,
      size_mb: 0,
      filename: basename(pdfPath),
      has_arabic: true,
      recommended_engine: "mistral",
      notes: ["التصنيف فشل — يُفترض أن الملف ممسوح ضوئياً"],
    };
  }
};

// ─── خطوة 2: استخراج OCR (ocr-mistral.ts) ─────────────────────

const buildOcrArguments = (config, inputPath, outputPath) => {
  const adapterPath =
    process.env.PDF_OCR_MISTRAL_REQUEST_ADAPTER_PATH?.trim() ||
    DEFAULT_MISTRAL_REQUEST_ADAPTER_PATH;

  const args = [
    ...buildTsxNodeArgs(config.ocrScriptPath, [], [toFileUrl(adapterPath)]),
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

const runOcrScript = async (config, inputPath, outputJsonPath) => {
  logger.info({ script: config.ocrScriptPath, file: inputPath }, "ocr-start");

  const args = buildOcrArguments(config, inputPath, outputJsonPath);

  const { stderr } = await execFileAsync(process.execPath, args, {
    timeout: config.timeoutMs,
    maxBuffer: MAX_STDIO_BUFFER,
    env: toChildProcessEnv({
      MISTRAL_API_KEY: config.mistralApiKey,
    }),
  });

  const outputRaw = await readFile(outputJsonPath, "utf-8");
  const parsed = parseOcrPayload(outputRaw);
  const warnings = collectStderrWarnings(stderr);

  logger.info({ pages: parsed.pages, model: parsed.model }, "ocr-complete");

  return { ...parsed, warnings };
};

// ─── خطوة 3: تنسيق المخرجات (write-output.ts) ────────────────

const runWriteOutputScript = async (
  config,
  ocrJsonPath,
  format,
  outputPath
) => {
  logger.info(
    { script: config.writeOutputScriptPath, format, output: outputPath },
    "write-output-start"
  );

  try {
    const { stderr } = await execFileAsync(
      process.execPath,
      buildTsxNodeArgs(config.writeOutputScriptPath, [
        "--input",
        ocrJsonPath,
        "--format",
        format,
        "--output",
        outputPath,
      ]),
      {
        timeout: WRITE_OUTPUT_TIMEOUT_MS,
        maxBuffer: MAX_STDIO_BUFFER,
        env: toChildProcessEnv(),
      }
    );

    if (stderr?.trim()) {
      logger.debug({ stderr: stderr.trim() }, "write-output-stderr");
    }

    const formattedText = await readFile(outputPath, "utf-8");
    logger.info(
      { sizeKb: Math.round(Buffer.byteLength(formattedText, "utf-8") / 1024) },
      "write-output-complete"
    );
    return formattedText;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "write-output-failed"
    );
    return null;
  }
};

// ─── الأوركسترا الرئيسية ──────────────────────────────────────

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
  const ocrJsonPath = join(tempRoot, "ocr-result.json");
  const formattedTxtPath = join(tempRoot, "output.txt");
  const mcpNormalizedOutputPath = join(tempRoot, "mcp-normalized.md");

  const startedAt = Date.now();
  const attempts = ["pdf-ocr-agent"];
  const allWarnings = [];
  const legacyFallbackEnabled = /^(1|true|yes|on)$/iu.test(
    (process.env.PDF_OCR_AGENT_LEGACY_FALLBACK || "").trim()
  );

  logger.info(
    {
      file: filename,
      timeoutMs: config.timeoutMs,
      pages: config.pages,
      enableClassification: config.enableClassification,
      enableEnhancement: config.enableEnhancement,
    },
    "pipeline-start"
  );

  try {
    await writeFile(inputPath, buffer);

    // ── المسار الأساسي: وكيل فتح PDF (مهارة + MCP) ──────────
    let classification = null;
    let pipelineFootprint = null;
    let finalText = "";
    let usedLegacyFallback = false;
    let pipelinePages = 0;
    let pipelineModel = "mistral-ocr-latest";

    attempts.push("pipeline-open-agent");
    try {
      const openAgentPayload = await runOpenPdfAgentScript(
        config,
        inputPath,
        ocrJsonPath,
        formattedTxtPath,
        mcpNormalizedOutputPath
      );

      classification =
        openAgentPayload?.classification &&
        typeof openAgentPayload.classification === "object"
          ? openAgentPayload.classification
          : null;
      pipelinePages =
        typeof classification?.pages === "number"
          ? Number(classification.pages)
          : 0;

      finalText =
        typeof openAgentPayload?.text === "string" ? openAgentPayload.text : "";
      if (!finalText.trim()) {
        throw new Error("open-pdf-agent returned empty raw text.");
      }

      if (Array.isArray(openAgentPayload?.attempts)) {
        attempts.push(
          ...openAgentPayload.attempts.filter(
            (entry) => typeof entry === "string" && entry.trim()
          )
        );
      }

      if (Array.isArray(openAgentPayload?.warnings)) {
        allWarnings.push(
          ...openAgentPayload.warnings.filter(
            (entry) => typeof entry === "string" && entry.trim()
          )
        );
      }

      const checkedDirectories = Array.isArray(
        openAgentPayload?.meta?.footprint?.checkedDirectories
      )
        ? openAgentPayload.meta.footprint.checkedDirectories.filter(
            (entry) => typeof entry === "string" && entry.trim()
          )
        : [];
      const checkedFiles = Array.isArray(
        openAgentPayload?.meta?.footprint?.checkedFiles
      )
        ? openAgentPayload.meta.footprint.checkedFiles.filter(
            (entry) => typeof entry === "string" && entry.trim()
          )
        : [];

      if (checkedDirectories.length > 0 || checkedFiles.length > 0) {
        pipelineFootprint = {
          checkedDirectories,
          checkedFiles,
        };
      }
    } catch (openAgentError) {
      if (!legacyFallbackEnabled) {
        throw openAgentError;
      }

      usedLegacyFallback = true;
      logger.warn(
        {
          error:
            openAgentError instanceof Error
              ? openAgentError.message
              : String(openAgentError),
        },
        "open-agent-failed-fallback-legacy"
      );
      allWarnings.push(
        `open-pdf-agent failed وتم تفعيل المسار الاحتياطي legacy: ${
          openAgentError instanceof Error
            ? openAgentError.message
            : String(openAgentError)
        }`
      );

      // ── fallback legacy: classify + OCR + write-output ─────
      if (config.enableClassification) {
        attempts.push("classify");
        classification = await runClassifyScript(config, inputPath);

        if (classification.type === "protected") {
          throw new Error("الملف محمي بكلمة مرور — يتطلب فك التشفير أولاً.", {
            cause: openAgentError,
          });
        }

        if (classification.notes?.length) {
          allWarnings.push(...classification.notes);
        }
      }

      attempts.push("ocr-mistral");
      const ocrResult = await runOcrScript(config, inputPath, ocrJsonPath);
      finalText = ocrResult.text;
      pipelinePages = ocrResult.pages;
      pipelineModel = ocrResult.model;

      if (ocrResult.warnings.length) {
        allWarnings.push(...ocrResult.warnings);
      }

      attempts.push("write-output");
      const formattedText = await runWriteOutputScript(
        config,
        ocrJsonPath,
        "txt",
        formattedTxtPath
      );

      if (formattedText && formattedText.trim()) {
        finalText = formattedText;
      } else {
        allWarnings.push("write-output فشل — يُستخدم النص الخام من OCR");
      }
    }

    if (classification?.type === "protected") {
      throw new Error("الملف محمي بكلمة مرور — يتطلب فك التشفير أولاً.");
    }
    if (classification?.notes?.length) {
      allWarnings.push(...classification.notes);
    }

    const rawExtractedText = finalText;
    let artifactLinesRemoved = 0;
    const normalizationApplied = [];
    const cleaned = stripOcrArtifactLines(finalText);
    finalText = cleaned.text;
    artifactLinesRemoved = cleaned.removedLines;
    if (artifactLinesRemoved > 0) {
      normalizationApplied.push("strip-ocr-artifact-lines");
      allWarnings.push(`تم حذف ${artifactLinesRemoved} سطرًا مصطنعًا من OCR`);
      logger.info({ artifactLinesRemoved }, "ocr-artifacts-stripped");
    }

    // ── بناء النتيجة النهائية ────────────────────────────────
    const durationMs = Date.now() - startedAt;
    const uniqueAttempts = Array.from(
      new Set(attempts.filter((entry) => typeof entry === "string" && entry))
    );

    logger.info(
      {
        file: filename,
        pages: pipelinePages,
        model: pipelineModel,
        classificationType: classification?.type ?? "skipped",
        usedLegacyFallback,
        artifactLinesRemoved,
        durationMs,
      },
      "pipeline-complete"
    );

    return {
      text: finalText,
      method: "ocr-mistral",
      usedOcr: true,
      attempts: uniqueAttempts,
      warnings: allWarnings,
      qualityScore: 1,
      classification,
      rawExtractedText,
      pipelineFootprint,
      artifactLinesRemoved,
      normalizationApplied,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error(
      {
        file: filename,
        durationMs,
        attempts,
        error: error instanceof Error ? error.message : String(error),
      },
      "pipeline-failed"
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

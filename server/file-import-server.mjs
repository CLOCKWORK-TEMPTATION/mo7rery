import http from "node:http";
import express from "express";
import rateLimit from "express-rate-limit";
import process from "node:process";
import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "crypto";
import { config as loadEnv } from "dotenv";
import {
  AgentReviewValidationError,
  getAnthropicReviewModel,
  getAnthropicReviewRuntime,
  requestAnthropicReview,
  validateAgentReviewRequestBody,
} from "./agent-review.mjs";
import {
  ExecFileClassifiedError,
  classifyExecError,
} from "./exec-file-error-classifier.mjs";
import { getPdfOcrAgentHealth } from "./pdf-ocr-agent-config.mjs";
import { runPdfOcrAgent } from "./pdf-ocr-agent-runner.mjs";

loadEnv();

const HOST = process.env.FILE_IMPORT_HOST || "127.0.0.1";
const PORT = Number(process.env.FILE_IMPORT_PORT || 8787);
const MAX_BODY_SIZE = 40 * 1024 * 1024;

const DOC_CONVERTER_TIMEOUT_MS = 30_000;
const DOCX_TO_DOC_CONVERTER_TIMEOUT_MS = 90_000;
const DOC_CONVERTER_MAX_BUFFER = 64 * 1024 * 1024;
const DEFAULT_ANTIWORD_PATH = "antiword";
const DEFAULT_ANTIWORD_HOME = "/usr/share/antiword";
const DOCX_TO_DOC_SCRIPT_PATH = fileURLToPath(
  new URL("./docx-to-doc.final.ts", import.meta.url)
);
const DOCX_TO_DOC_SCRIPT_EXISTS = existsSync(DOCX_TO_DOC_SCRIPT_PATH);

const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "fountain",
  "fdx",
  "doc",
  "docx",
]);
const SUPPORTED_EXTRACTION_METHODS = new Set([
  "native-text",
  "doc-converter-flow",
  "ocr-mistral",
  "backend-api",
  "app-payload",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
    this.statusCode = 400;
  }
}

const toExecBuffer = (value) =>
  Buffer.isBuffer(value) ? value : Buffer.from(value ?? "", "utf-8");

const isHttpTypedError = (error) =>
  typeof error?.statusCode === "number" &&
  Number.isFinite(error.statusCode) &&
  error.statusCode >= 400 &&
  error.statusCode <= 599;

const isObjectRecord = (value) => typeof value === "object" && value !== null;
const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const normalizeIncomingText = (value, maxLength = 50_000) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const stripAsciiControlChars = (value, options = {}) => {
  const { preserveTabs = false, preserveNewlines = false } = options;
  const text = String(value ?? "");
  let cleaned = "";

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    const isAsciiControl = code <= 0x1f || code === 0x7f;

    if (!isAsciiControl) {
      cleaned += ch;
      continue;
    }

    if (preserveTabs && code === 0x09) {
      cleaned += ch;
      continue;
    }

    if (preserveNewlines && (code === 0x0a || code === 0x0d)) {
      cleaned += ch;
    }
  }

  return cleaned;
};

const normalizeText = (value) =>
  stripAsciiControlChars(
    String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n"),
    {
      preserveNewlines: true,
    }
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractErrorCode = (error, message) => {
  if (typeof error?.errorCode === "string" && error.errorCode.trim()) {
    return error.errorCode.trim();
  }

  const match = String(message ?? "").match(/\[([A-Z0-9_]+)\]/u);
  return match?.[1] || undefined;
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders,
  });
  res.end(JSON.stringify(payload));
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeExistingBackendHealth = async () => {
  const healthUrl = `http://${HOST}:${PORT}/health`;
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      return { ok: false, reason: `status:${response.status}` };
    }

    const payload = await response.json().catch(() => null);
    const isSameService =
      payload?.ok === true && payload?.service === "file-import-backend";

    return isSameService
      ? { ok: true, reason: "matched-health-signature" }
      : { ok: false, reason: "health-signature-mismatch" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "health-probe-failed",
    };
  }
};

const probeExistingBackendWithRetries = async () => {
  const attempts = 4;
  for (let index = 0; index < attempts; index += 1) {
    const result = await probeExistingBackendHealth();
    if (result.ok) {
      return result;
    }
    if (index < attempts - 1) {
      await wait(300);
    }
  }
  return { ok: false, reason: "health-check-exhausted" };
};

const readRawBody = async (req) =>
  new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_SIZE) {
        reject(new Error("Request body exceeded max allowed size."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });

const readJsonBody = async (req) => {
  const raw = await readRawBody(req);
  const text = raw.toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body.");
  }
};

const validateExtractRequestBody = (rawBody) => {
  if (!isObjectRecord(rawBody)) {
    throw new RequestValidationError("Invalid extract request body.");
  }

  const filename = normalizeIncomingText(rawBody.filename, 512) || "document";
  const extension =
    typeof rawBody.extension === "string"
      ? rawBody.extension.trim().toLowerCase()
      : "";
  const fileBase64 =
    typeof rawBody.fileBase64 === "string" ? rawBody.fileBase64.trim() : "";

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new RequestValidationError(
      `Unsupported extension: ${extension || "unknown"}`
    );
  }
  if (!fileBase64) {
    throw new RequestValidationError("Missing fileBase64.");
  }

  return {
    filename,
    extension,
    fileBase64,
  };
};

const getRequestContentType = (req) => {
  const header = req.headers["content-type"];
  if (Array.isArray(header)) {
    return header[0] ?? "";
  }
  return header ?? "";
};

const parseMultipartBoundary = (contentType) => {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match?.[1] ?? match?.[2] ?? "";
  if (!boundary) {
    throw new RequestValidationError(
      "Invalid multipart request: boundary is missing."
    );
  }
  return boundary;
};

const decodeMultipartFilename = (rawFilename) =>
  normalizeIncomingText(rawFilename, 512)
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .pop();

const parseMultipartContentDisposition = (headerLine) => {
  const line = String(headerLine || "");
  const nameMatch = line.match(/\bname="([^"]+)"/i);
  const filenameMatch = line.match(/\bfilename="([^"]*)"/i);
  return {
    fieldName: nameMatch?.[1] ?? "",
    filename: filenameMatch?.[1] ?? "",
  };
};

const parseMultipartExtractRequestBody = (rawBody, contentType) => {
  const boundary = parseMultipartBoundary(contentType);
  const payload = rawBody.toString("latin1");
  const delimiter = `--${boundary}`;
  const parts = payload.split(delimiter);

  for (const part of parts) {
    if (!part || part === "--" || part === "--\r\n") {
      continue;
    }

    let normalizedPart = part;
    if (normalizedPart.startsWith("\r\n")) {
      normalizedPart = normalizedPart.slice(2);
    }
    if (normalizedPart.endsWith("\r\n")) {
      normalizedPart = normalizedPart.slice(0, -2);
    }
    if (normalizedPart.endsWith("--")) {
      normalizedPart = normalizedPart.slice(0, -2);
    }

    if (!normalizedPart.trim()) {
      continue;
    }

    const headerSeparatorIndex = normalizedPart.indexOf("\r\n\r\n");
    if (headerSeparatorIndex < 0) {
      continue;
    }

    const headersRaw = normalizedPart.slice(0, headerSeparatorIndex);
    const bodyRaw = normalizedPart.slice(headerSeparatorIndex + 4);
    const headerLines = headersRaw.split("\r\n");
    const dispositionHeader = headerLines.find((line) =>
      line.toLowerCase().startsWith("content-disposition:")
    );
    if (!dispositionHeader) {
      continue;
    }

    const { fieldName, filename } =
      parseMultipartContentDisposition(dispositionHeader);
    if (fieldName !== "file") {
      continue;
    }

    const resolvedFilename = decodeMultipartFilename(filename);
    if (!resolvedFilename) {
      throw new RequestValidationError(
        "Invalid multipart request: uploaded file has no filename."
      );
    }

    const extension = extname(resolvedFilename)
      .replace(/^\./, "")
      .toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new RequestValidationError(
        `Unsupported extension: ${extension || "unknown"}`
      );
    }

    const normalizedBody = bodyRaw.endsWith("\r\n")
      ? bodyRaw.slice(0, -2)
      : bodyRaw;
    const buffer = Buffer.from(normalizedBody, "latin1");
    if (!buffer.length) {
      throw new RequestValidationError("Uploaded file is empty.");
    }

    return {
      filename: resolvedFilename,
      extension,
      buffer,
    };
  }

  throw new RequestValidationError(
    "Invalid multipart request: missing file field."
  );
};

const parseExtractRequest = async (req) => {
  const contentType = getRequestContentType(req).toLowerCase();
  const rawBody = await readRawBody(req);

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartExtractRequestBody(rawBody, contentType);
  }

  const bodyText = rawBody.toString("utf8");
  let parsedBody;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    throw new RequestValidationError("Invalid JSON body.");
  }

  const { filename, extension, fileBase64 } =
    validateExtractRequestBody(parsedBody);
  return {
    filename,
    extension,
    buffer: decodeBase64(fileBase64),
  };
};

const normalizeExtractionResponseData = (result, fileType) => {
  if (!isObjectRecord(result)) {
    throw new Error("Extraction returned invalid payload.");
  }

  const text = typeof result.text === "string" ? result.text : "";
  const method = normalizeIncomingText(result.method, 64);
  const usedOcr = Boolean(result.usedOcr);
  const attempts = Array.isArray(result.attempts)
    ? result.attempts.filter((entry) => isNonEmptyString(entry)).slice(0, 24)
    : [];
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.filter((entry) => isNonEmptyString(entry)).slice(0, 24)
    : [];

  if (!SUPPORTED_EXTRACTION_METHODS.has(method)) {
    throw new Error(`Extraction returned unsupported method: ${method}`);
  }

  const pipelineFootprint =
    isObjectRecord(result.pipelineFootprint) &&
    Array.isArray(result.pipelineFootprint.checkedDirectories) &&
    Array.isArray(result.pipelineFootprint.checkedFiles) &&
    result.pipelineFootprint.checkedDirectories.every((entry) =>
      isNonEmptyString(entry)
    ) &&
    result.pipelineFootprint.checkedFiles.every((entry) =>
      isNonEmptyString(entry)
    )
      ? {
          checkedDirectories: result.pipelineFootprint.checkedDirectories,
          checkedFiles: result.pipelineFootprint.checkedFiles,
        }
      : undefined;

  return {
    text,
    textRaw:
      typeof result.textRaw === "string"
        ? result.textRaw
        : typeof result.rawExtractedText === "string"
          ? result.rawExtractedText
          : text,
    textMarkdown:
      typeof result.textMarkdown === "string" ? result.textMarkdown : undefined,
    rawExtractedText:
      typeof result.rawExtractedText === "string"
        ? result.rawExtractedText
        : undefined,
    fileType,
    method,
    usedOcr,
    warnings,
    attempts,
    qualityScore:
      typeof result.qualityScore === "number" &&
      Number.isFinite(result.qualityScore)
        ? result.qualityScore
        : undefined,
    artifactLinesRemoved:
      typeof result.artifactLinesRemoved === "number" &&
      Number.isFinite(result.artifactLinesRemoved)
        ? result.artifactLinesRemoved
        : undefined,
    normalizationApplied: Array.isArray(result.normalizationApplied)
      ? result.normalizationApplied
          .filter((entry) => isNonEmptyString(entry))
          .slice(0, 24)
      : undefined,
    structuredBlocks: Array.isArray(result.structuredBlocks)
      ? result.structuredBlocks
          .filter(
            (block) =>
              isObjectRecord(block) &&
              isNonEmptyString(block.formatId) &&
              typeof block.text === "string"
          )
          .map((block) => ({
            formatId: block.formatId.trim(),
            text: block.text,
          }))
      : undefined,
    pipelineFootprint,
    payloadVersion:
      typeof result.payloadVersion === "number" &&
      Number.isInteger(result.payloadVersion)
        ? result.payloadVersion
        : undefined,
    referenceMode:
      typeof result.referenceMode === "string"
        ? result.referenceMode
        : undefined,
    status: typeof result.status === "string" ? result.status : undefined,
    rejectionReason:
      typeof result.rejectionReason === "string"
        ? result.rejectionReason
        : undefined,
    quality:
      isObjectRecord(result.quality) &&
      typeof result.quality.wordMatch === "number" &&
      typeof result.quality.structuralMatch === "number" &&
      typeof result.quality.accepted === "boolean"
        ? {
            wordMatch: result.quality.wordMatch,
            structuralMatch: result.quality.structuralMatch,
            accepted: result.quality.accepted,
          }
        : undefined,
    mismatchReport: Array.isArray(result.mismatchReport)
      ? result.mismatchReport
          .filter(
            (entry) =>
              isObjectRecord(entry) &&
              typeof entry.page === "number" &&
              typeof entry.line === "number" &&
              typeof entry.token === "string" &&
              typeof entry.expected === "string" &&
              typeof entry.actual === "string" &&
              (entry.severity === "critical" || entry.severity === "normal")
          )
          .slice(0, 10_000)
      : undefined,
    mismatchReportPath:
      typeof result.mismatchReportPath === "string"
        ? result.mismatchReportPath
        : undefined,
    classification: isObjectRecord(result.classification)
      ? {
          type:
            typeof result.classification.type === "string"
              ? result.classification.type
              : undefined,
          pages:
            typeof result.classification.pages === "number"
              ? result.classification.pages
              : undefined,
          sizeMb:
            typeof result.classification.size_mb === "number"
              ? result.classification.size_mb
              : undefined,
          hasArabic:
            typeof result.classification.has_arabic === "boolean"
              ? result.classification.has_arabic
              : undefined,
          recommendedEngine:
            typeof result.classification.recommended_engine === "string"
              ? result.classification.recommended_engine
              : undefined,
        }
      : undefined,
  };
};

const decodeBase64 = (input) => {
  if (!input || typeof input !== "string") {
    throw new Error("Missing fileBase64.");
  }

  const normalized = input.replace(/\s+/g, "");
  if (!normalized) {
    throw new Error("fileBase64 is empty.");
  }

  return Buffer.from(normalized, "base64");
};

const decodeUtf8Buffer = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return new TextDecoder("utf-8").decode(value);
};

const resolveAntiwordRuntime = () => {
  const antiwordPath =
    process.env.ANTIWORD_PATH?.trim() || DEFAULT_ANTIWORD_PATH;
  const antiwordHome =
    process.env.ANTIWORDHOME?.trim() || DEFAULT_ANTIWORD_HOME;

  return {
    antiwordPath,
    antiwordHome,
    runtimeSource: process.env.ANTIWORD_PATH?.trim() ? "env" : "path-default",
  };
};

const runAntiwordPreflight = () => {
  const runtime = resolveAntiwordRuntime();
  const warnings = [];
  let binaryAvailable = false;

  try {
    execFileSync(runtime.antiwordPath, ["-h"], {
      stdio: "pipe",
      timeout: 5000,
      windowsHide: true,
      env: {
        ...process.env,
        ANTIWORDHOME: runtime.antiwordHome,
      },
    });
    binaryAvailable = true;
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "";
    if (code === "ENOENT") {
      warnings.push(
        `antiword binary غير موجود على المسار الحالي: ${runtime.antiwordPath}`
      );
    } else if (code === "EACCES") {
      warnings.push(
        `antiword binary موجود لكنه غير قابل للتنفيذ: ${runtime.antiwordPath}`
      );
    } else {
      // antiword قد يرجع exit code غير صفري مع -h رغم وجوده.
      binaryAvailable = true;
    }
  }

  const antiwordHomeExists = existsSync(runtime.antiwordHome);
  if (!antiwordHomeExists) {
    warnings.push(
      `ANTIWORDHOME غير موجود أو غير صحيح: ${runtime.antiwordHome}`
    );
  }

  return {
    ...runtime,
    binaryAvailable,
    antiwordHomeExists,
    warnings,
  };
};

const ANTIWORD_PREFLIGHT = runAntiwordPreflight();
const FILE_IMPORT_PREFLIGHT_WARNINGS = [...ANTIWORD_PREFLIGHT.warnings];
if (!DOCX_TO_DOC_SCRIPT_EXISTS) {
  FILE_IMPORT_PREFLIGHT_WARNINGS.push(
    `DOCX converter script غير موجود: ${DOCX_TO_DOC_SCRIPT_PATH}`
  );
}

const runAntiword = async (antiwordPath, args, antiwordHome) =>
  new Promise((resolve, reject) => {
    execFile(
      antiwordPath,
      args,
      {
        encoding: "buffer",
        timeout: DOC_CONVERTER_TIMEOUT_MS,
        maxBuffer: DOC_CONVERTER_MAX_BUFFER,
        windowsHide: true,
        env: {
          ...process.env,
          ANTIWORDHOME: antiwordHome,
        },
      },
      (error, stdout, stderr) => {
        const stdoutBuffer = toExecBuffer(stdout);
        const stderrBuffer = toExecBuffer(stderr);

        if (error) {
          reject(
            classifyExecError(
              error,
              "antiword",
              DOC_CONVERTER_TIMEOUT_MS,
              stdoutBuffer,
              stderrBuffer
            )
          );
          return;
        }

        resolve({ stdout: stdoutBuffer, stderr: stderrBuffer });
      }
    );
  });

const resolveTempFilename = (filename) => {
  const base = basename(filename || "document.doc");
  const hasDocExt = extname(base).toLowerCase() === ".doc";
  return hasDocExt ? base : `${base}.doc`;
};

const cleanExtractedDocText = (text) =>
  normalizeText(text)
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[^\S\r\n]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const resolveDocxTempFilename = (filename) => {
  const base = basename(filename || "document.docx");
  const hasDocxExt = extname(base).toLowerCase() === ".docx";
  if (hasDocxExt) return base;
  const withoutExt = base.replace(/\.[^.]+$/, "");
  return `${withoutExt || "document"}.docx`;
};

const runDocxToDocConverter = async (inputDocxPath, outputDocPath) =>
  new Promise((resolve, reject) => {
    const args = [
      "--import",
      "tsx",
      DOCX_TO_DOC_SCRIPT_PATH,
      inputDocxPath,
      outputDocPath,
      "--overwrite",
    ];

    execFile(
      process.execPath,
      args,
      {
        encoding: "buffer",
        timeout: DOCX_TO_DOC_CONVERTER_TIMEOUT_MS,
        maxBuffer: DOC_CONVERTER_MAX_BUFFER,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const stdoutBuffer = toExecBuffer(stdout);
        const stderrBuffer = toExecBuffer(stderr);

        if (error) {
          reject(
            classifyExecError(
              error,
              "docx-to-doc.final.ts",
              DOCX_TO_DOC_CONVERTER_TIMEOUT_MS,
              stdoutBuffer,
              stderrBuffer
            )
          );
          return;
        }

        resolve({ stdout: stdoutBuffer, stderr: stderrBuffer });
      }
    );
  });

const convertDocBufferToText = async (buffer, filename) => {
  const warnings = [];
  const attempts = ["doc-converter-flow"];
  const runtime = resolveAntiwordRuntime();
  let tempDirPath = null;

  try {
    tempDirPath = await mkdtemp(join(tmpdir(), "doc-converter-flow-"));
    const tempFilePath = join(tempDirPath, resolveTempFilename(filename));
    await writeFile(tempFilePath, buffer);

    const { stdout, stderr } = await runAntiword(
      runtime.antiwordPath,
      ["-m", "UTF-8.txt", "-w", "0", tempFilePath],
      runtime.antiwordHome
    );

    const stderrText = decodeUtf8Buffer(stderr).trim();
    if (stderrText) warnings.push(stderrText);

    const decoded = decodeUtf8Buffer(stdout);
    const cleaned = cleanExtractedDocText(decoded);
    if (!cleaned) {
      throw new Error("antiword أعاد نصًا فارغًا");
    }

    return {
      text: cleaned,
      method: "doc-converter-flow",
      usedOcr: false,
      attempts,
      warnings,
      antiword: runtime,
    };
  } catch (error) {
    if (error instanceof ExecFileClassifiedError) {
      const stderrText = normalizeIncomingText(
        error.classifiedError?.stderrPreview,
        400
      );
      if (stderrText) warnings.push(stderrText);
      throw new ExecFileClassifiedError(
        `فشل تحويل ملف DOC عبر antiword (${runtime.antiwordPath}): ${error.message}`,
        {
          statusCode: error.statusCode,
          category: error.category,
          classifiedError: {
            ...error.classifiedError,
            antiwordPath: runtime.antiwordPath,
            antiwordHome: runtime.antiwordHome,
          },
        }
      );
    }
    throw new Error(
      `فشل تحويل ملف DOC عبر antiword (${runtime.antiwordPath}): ${
        error instanceof Error ? error.message : String(error)
      }`,
      {
        cause: error,
      }
    );
  } finally {
    if (tempDirPath) {
      await rm(tempDirPath, { recursive: true, force: true }).catch(() => {});
    }
  }
};

const convertDocxBufferToDocThenExtract = async (buffer, filename) => {
  const warnings = [];
  const attempts = ["docx-to-doc.final", "doc-converter-flow"];
  let tempDirPath = null;

  try {
    tempDirPath = await mkdtemp(join(tmpdir(), "docx-to-doc-flow-"));
    const sourceDocxPath = join(tempDirPath, resolveDocxTempFilename(filename));
    const convertedDocPath = sourceDocxPath.replace(/\.docx$/i, ".doc");

    await writeFile(sourceDocxPath, buffer);
    const { stdout, stderr } = await runDocxToDocConverter(
      sourceDocxPath,
      convertedDocPath
    );

    const converterStdout = decodeUtf8Buffer(stdout).trim();
    const converterStderr = decodeUtf8Buffer(stderr).trim();
    if (converterStdout) warnings.push(converterStdout);
    if (converterStderr) warnings.push(converterStderr);

    if (!existsSync(convertedDocPath)) {
      throw new Error(
        `تم تشغيل محول DOCX لكن ملف DOC الناتج غير موجود: ${convertedDocPath}`
      );
    }

    const convertedDocBuffer = await readFile(convertedDocPath);
    const extractedDoc = await convertDocBufferToText(
      convertedDocBuffer,
      basename(convertedDocPath)
    );

    return {
      ...extractedDoc,
      method: "doc-converter-flow",
      attempts: [...attempts, ...extractedDoc.attempts],
      warnings: [...warnings, ...extractedDoc.warnings],
    };
  } catch (error) {
    if (error instanceof ExecFileClassifiedError) {
      const stdoutText = normalizeIncomingText(
        error.classifiedError?.stdoutPreview,
        400
      );
      const stderrText = normalizeIncomingText(
        error.classifiedError?.stderrPreview,
        400
      );
      if (stdoutText) warnings.push(stdoutText);
      if (stderrText) warnings.push(stderrText);
      throw new ExecFileClassifiedError(
        `فشل مسار تحويل DOCX→DOC عبر docx-to-doc.final.ts: ${error.message}${
          warnings.length > 0 ? ` | logs: ${warnings.join(" | ")}` : ""
        }`,
        {
          statusCode: error.statusCode,
          category: error.category,
          classifiedError: {
            ...error.classifiedError,
            converterScript: DOCX_TO_DOC_SCRIPT_PATH,
          },
        }
      );
    }

    throw new Error(
      `فشل مسار تحويل DOCX→DOC عبر docx-to-doc.final.ts: ${
        error instanceof Error ? error.message : String(error)
      }${warnings.length > 0 ? ` | logs: ${warnings.join(" | ")}` : ""}`,
      {
        cause: error,
      }
    );
  } finally {
    if (tempDirPath) {
      await rm(tempDirPath, { recursive: true, force: true }).catch(() => {});
    }
  }
};

const decodeUtf8Fallback = (buffer) => {
  const utf8Text = buffer.toString("utf8");
  const hasReplacementChars =
    utf8Text.includes("\uFFFD") || utf8Text.includes("�");
  if (!hasReplacementChars) return utf8Text;
  return buffer.toString("latin1");
};

const extractByType = async (buffer, extension, filename) => {
  if (extension === "pdf") {
    return runPdfOcrAgent({ buffer, filename });
  }

  if (extension === "txt" || extension === "fountain" || extension === "fdx") {
    return {
      text: normalizeText(decodeUtf8Fallback(buffer)),
      method: "native-text",
      usedOcr: false,
      attempts: ["native-text"],
      warnings: [],
    };
  }

  if (extension === "doc") {
    if (!ANTIWORD_PREFLIGHT.binaryAvailable) {
      throw new ExecFileClassifiedError(
        "تعذر استخراج DOC: antiword غير متاح. راجع health endpoint والتأكد من ANTIWORD_PATH.",
        {
          statusCode: 422,
          category: "binary-missing",
          classifiedError: {
            category: "binary-missing",
            antiwordPath: ANTIWORD_PREFLIGHT.antiwordPath,
          },
        }
      );
    }
    if (!ANTIWORD_PREFLIGHT.antiwordHomeExists) {
      throw new ExecFileClassifiedError(
        `تعذر استخراج DOC: مسار ANTIWORDHOME غير صالح (${ANTIWORD_PREFLIGHT.antiwordHome}).`,
        {
          statusCode: 422,
          category: "invalid-config",
          classifiedError: {
            category: "invalid-config",
            antiwordHome: ANTIWORD_PREFLIGHT.antiwordHome,
          },
        }
      );
    }
    return convertDocBufferToText(buffer, filename);
  }

  if (extension === "docx") {
    if (!DOCX_TO_DOC_SCRIPT_EXISTS) {
      throw new ExecFileClassifiedError(
        "تعذر استخراج DOCX: ملف المحول غير موجود (docx-to-doc.final.ts).",
        {
          statusCode: 422,
          category: "invalid-config",
          classifiedError: {
            category: "invalid-config",
            converterScript: DOCX_TO_DOC_SCRIPT_PATH,
          },
        }
      );
    }

    if (!ANTIWORD_PREFLIGHT.binaryAvailable) {
      throw new ExecFileClassifiedError(
        "تعذر استخراج DOCX: antiword غير متاح. راجع health endpoint والتأكد من ANTIWORD_PATH.",
        {
          statusCode: 422,
          category: "binary-missing",
          classifiedError: {
            category: "binary-missing",
            antiwordPath: ANTIWORD_PREFLIGHT.antiwordPath,
          },
        }
      );
    }
    if (!ANTIWORD_PREFLIGHT.antiwordHomeExists) {
      throw new ExecFileClassifiedError(
        `تعذر استخراج DOCX: مسار ANTIWORDHOME غير صالح (${ANTIWORD_PREFLIGHT.antiwordHome}).`,
        {
          statusCode: 422,
          category: "invalid-config",
          classifiedError: {
            category: "invalid-config",
            antiwordHome: ANTIWORD_PREFLIGHT.antiwordHome,
          },
        }
      );
    }

    return convertDocxBufferToDocThenExtract(buffer, filename);
  }

  throw new Error(`Unsupported extension: ${extension}`);
};

const handleExtract = async (req, res) => {
  try {
    const { filename, extension, buffer } = await parseExtractRequest(req);
    const extracted = await extractByType(buffer, extension, filename);
    const normalizedData = normalizeExtractionResponseData(
      extracted,
      extension
    );

    sendJson(res, 200, {
      success: true,
      data: normalizedData,
      meta: {
        filename,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    const statusCode = isHttpTypedError(error)
      ? error.statusCode
      : error instanceof RequestValidationError
        ? error.statusCode
        : 500;
    const errorCode = extractErrorCode(error, message);
    const payload = {
      success: false,
      error: message,
      ...(errorCode ? { errorCode } : {}),
    };
    if (error instanceof ExecFileClassifiedError) {
      payload.classifiedError = error.classifiedError;
    }
    sendJson(res, statusCode, payload);
  }
};

const handleAgentReview = async (req, res) => {
  let importOpId = null;
  try {
    const rawBody = await readJsonBody(req);
    // Extract importOpId early for error response
    importOpId =
      typeof rawBody?.importOpId === "string" ? rawBody.importOpId : null;
    const body = validateAgentReviewRequestBody(rawBody);
    const response = await requestAnthropicReview(body);
    // إذا كان الـ provider رجع status code (529/503/429)، مرره للكلاينت
    // عشان يقدر يعمل retry صحيح
    const httpStatus =
      response.status === "error" &&
      typeof response.providerStatusCode === "number" &&
      response.providerStatusCode >= 400
        ? response.providerStatusCode
        : 200;
    sendJson(res, httpStatus, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode =
      error instanceof AgentReviewValidationError ? error.statusCode : 500;
    // v2-compliant error response
    sendJson(res, statusCode, {
      apiVersion: "2.0",
      mode: "auto-apply",
      importOpId: importOpId ?? "unknown",
      requestId: randomUUID(),
      status: "error",
      commands: [],
      message,
      latencyMs: 0,
    });
  }
};

/**
 * يُصدّر HTML إلى PDF عالي الجودة عبر Puppeteer (مرحلة PDF/A).
 * Puppeteer يدعم Arabic/RTL بشكل كامل عبر Chromium.
 */
const handleExportPdfA = async (req, res) => {
  let browser = null;
  try {
    const body = await readJsonBody(req);
    const html = typeof body?.html === "string" ? body.html : "";
    if (!html.trim()) {
      sendJson(res, 400, { success: false, error: "HTML content is empty." });
      return;
    }

    const puppeteer = await import("puppeteer");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
      displayHeaderFooter: false,
      preferCSSPageSize: false,
    });

    await browser.close();
    browser = null;

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": pdfBuffer.length,
      ...corsHeaders,
    });
    res.end(Buffer.from(pdfBuffer));
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // تجاهل أخطاء إغلاق المتصفح
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[export/pdfa] Error:", message);
    sendJson(res, 500, { success: false, error: message });
  }
};

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
  } else {
    next();
  }
});

const extractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    sendJson(res, options.statusCode, { success: false, error: options.message });
  }
});

const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    sendJson(res, options.statusCode, { success: false, error: options.message });
  }
});

app.get("/health", async (req, res) => {
  const ocrAgent = await getPdfOcrAgentHealth();
  const reviewRuntime = getAnthropicReviewRuntime();
  res.status(200).json({
    status: "ok",
    ok: true,
    service: "file-import-backend",
    antiwordPath: process.env.ANTIWORD_PATH || DEFAULT_ANTIWORD_PATH,
    antiwordHome: process.env.ANTIWORDHOME || DEFAULT_ANTIWORD_HOME,
    antiwordBinaryAvailable: ANTIWORD_PREFLIGHT.binaryAvailable,
    antiwordHomeExists: ANTIWORD_PREFLIGHT.antiwordHomeExists,
    antiwordWarnings: FILE_IMPORT_PREFLIGHT_WARNINGS,
    docxConverterScriptPath: DOCX_TO_DOC_SCRIPT_PATH,
    docxConverterScriptExists: DOCX_TO_DOC_SCRIPT_EXISTS,
    agentReviewConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    ocrConfigured: ocrAgent.configured,
    ocrAgent,
    reviewModel: getAnthropicReviewModel(),
    reviewProvider: reviewRuntime.provider,
    reviewModelRequested: reviewRuntime.requestedModel,
    reviewModelResolved: reviewRuntime.resolvedModel,
    reviewModelFallbackApplied: reviewRuntime.fallbackApplied,
    reviewModelFallbackReason: reviewRuntime.fallbackReason,
    reviewApiBaseUrl: reviewRuntime.baseUrl,
    reviewApiVersion: reviewRuntime.apiVersion,
  });
});

app.post("/api/file-extract", extractLimiter, handleExtract);
app.post("/api/files/extract", extractLimiter, handleExtract);
app.post("/api/agent/review", reviewLimiter, handleAgentReview);
app.post("/api/export/pdfa", handleExportPdfA);

app.use((req, res) => {
  sendJson(res, 404, { success: false, error: "Route not found." });
});

const server = http.createServer(app);

server.on("error", (error) => {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code !== "EADDRINUSE") {
    console.error("[file-import-backend] failed to start server:", error);
    process.exit(1);
    return;
  }

  void (async () => {
    const probe = await probeExistingBackendWithRetries();
    if (!probe.ok) {
      console.error(
        `[file-import-backend] port ${PORT} is already in use and health check did not match this backend (${probe.reason}).`
      );
      process.exit(1);
      return;
    }

    console.warn(
      `[file-import-backend] detected running backend on http://${HOST}:${PORT}; reusing existing process.`
    );
    process.exit(0);
  })();
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`file-import backend running on http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`extract endpoint: http://${HOST}:${PORT}/api/file-extract`);
  // eslint-disable-next-line no-console
  console.log(`review endpoint:  http://${HOST}:${PORT}/api/agent/review`);
  // eslint-disable-next-line no-console
  console.log(`health:           http://${HOST}:${PORT}/health`);
  if (FILE_IMPORT_PREFLIGHT_WARNINGS.length > 0) {
    console.warn("[antiword preflight] warnings:");
    for (const warning of FILE_IMPORT_PREFLIGHT_WARNINGS) {
      console.warn(`- ${warning}`);
    }
  }
});

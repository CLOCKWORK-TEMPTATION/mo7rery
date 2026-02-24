import http from "node:http";
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
  isPdfTextLayerScriptAvailable,
  runPdfTextLayerFlow
} from "./pdf-textlayer-runner.mjs";
import {
  AgentReviewValidationError,
  getAnthropicReviewModel,
  requestAnthropicReview,
  validateAgentReviewRequestBody,
} from "./agent-review.mjs";

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
  new URL("../docx-to-doc.final.ts", import.meta.url)
);

const SUPPORTED_EXTENSIONS = new Set([
  "txt",
  "fountain",
  "fdx",
  "pdf",
  "doc",
  "docx",
]);
const SUPPORTED_EXTRACTION_METHODS = new Set([
  "native-text",
  "pdfjs-text-layer",
  "doc-converter-flow",
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

const isObjectRecord = (value) => typeof value === "object" && value !== null;
const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const normalizeIncomingText = (value, maxLength = 50_000) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeTextForStructure = (value) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u2028|\u2029/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\u000B/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/^\uFEFF/, "");

const normalizeNewlinesOnly = (value) =>
  String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders,
  });
  res.end(JSON.stringify(payload));
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

    const extension = extname(resolvedFilename).replace(/^\./, "").toLowerCase();
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

  return {
    text,
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
    payloadVersion:
      typeof result.payloadVersion === "number" &&
        Number.isInteger(result.payloadVersion)
        ? result.payloadVersion
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
        const stdoutBuffer = Buffer.isBuffer(stdout)
          ? stdout
          : Buffer.from(stdout ?? "", "utf-8");
        const stderrBuffer = Buffer.isBuffer(stderr)
          ? stderr
          : Buffer.from(stderr ?? "", "utf-8");

        if (error) {
          const wrappedError = error;
          wrappedError.stdout = stdoutBuffer;
          wrappedError.stderr = stderrBuffer;
          reject(wrappedError);
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
        const stdoutBuffer = Buffer.isBuffer(stdout)
          ? stdout
          : Buffer.from(stdout ?? "", "utf-8");
        const stderrBuffer = Buffer.isBuffer(stderr)
          ? stderr
          : Buffer.from(stderr ?? "", "utf-8");

        if (error) {
          const wrappedError = error;
          wrappedError.stdout = stdoutBuffer;
          wrappedError.stderr = stderrBuffer;
          reject(wrappedError);
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
    const stderrText = decodeUtf8Buffer(error?.stderr).trim();
    if (stderrText) warnings.push(stderrText);
    throw new Error(
      `فشل تحويل ملف DOC عبر antiword (${runtime.antiwordPath}): ${error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    if (tempDirPath) {
      await rm(tempDirPath, { recursive: true, force: true }).catch(() => { });
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
    const stdoutText = decodeUtf8Buffer(error?.stdout).trim();
    const stderrText = decodeUtf8Buffer(error?.stderr).trim();
    if (stdoutText) warnings.push(stdoutText);
    if (stderrText) warnings.push(stderrText);

    throw new Error(
      `فشل مسار تحويل DOCX→DOC عبر docx-to-doc.final.ts: ${error instanceof Error ? error.message : String(error)
      }${warnings.length > 0 ? ` | logs: ${warnings.join(" | ")}` : ""}`
    );
  } finally {
    if (tempDirPath) {
      await rm(tempDirPath, { recursive: true, force: true }).catch(() => { });
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

const extractPdfTextWithTextLayerPipeline = async (buffer, filename) => {
  const attempts = [];
  const warnings = [];

  if (!isPdfTextLayerScriptAvailable()) {
    throw new Error("Text-layer PDF pipeline script is not available.");
  }

  try {
    const textLayerResult = await runPdfTextLayerFlow(buffer, filename);
    attempts.push(...textLayerResult.attempts);
    warnings.push(...textLayerResult.warnings);
    const text = normalizeNewlinesOnly(textLayerResult.text);

    if (!text.trim()) {
      throw new Error("pdf-textlayer-first أعاد نصًا فارغًا.");
    }

    const usedOcr =
      textLayerResult.stats?.patchedLines > 0 ||
      textLayerResult.stats?.pagesSentToOcr > 0;

    return {
      text,
      method: "pdfjs-text-layer",
      usedOcr,
      attempts,
      warnings,
      normalizationApplied: ["pdf-text-layer-first-fidelity"],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    attempts.push("pdf-textlayer-failed");
    warnings.push(`فشل مسار PDF text-layer-first: ${reason}`);
    throw new Error(
      `فشل استخراج PDF عبر المسار الموحد text-layer-first${
        warnings.length > 0 ? ` | ${warnings.join(" | ")}` : ""
      }`
    );
  }
};

const extractByType = async (buffer, extension, filename) => {
  if (extension === "txt" || extension === "fountain" || extension === "fdx") {
    return {
      text: normalizeText(decodeUtf8Fallback(buffer)),
      method: "native-text",
      usedOcr: false,
      attempts: ["native-text"],
      warnings: [],
    };
  }

  if (extension === "pdf") {
    return extractPdfTextWithTextLayerPipeline(buffer, filename);
  }

  if (extension === "doc") {
    if (!ANTIWORD_PREFLIGHT.binaryAvailable) {
      throw new Error(
        `تعذر استخراج DOC: antiword غير متاح. راجع health endpoint والتأكد من ANTIWORD_PATH.`
      );
    }
    if (!ANTIWORD_PREFLIGHT.antiwordHomeExists) {
      throw new Error(
        `تعذر استخراج DOC: مسار ANTIWORDHOME غير صالح (${ANTIWORD_PREFLIGHT.antiwordHome}).`
      );
    }
    return convertDocBufferToText(buffer, filename);
  }

  if (extension === "docx") {
    if (!ANTIWORD_PREFLIGHT.binaryAvailable) {
      throw new Error(
        `تعذر استخراج DOCX: antiword غير متاح. راجع health endpoint والتأكد من ANTIWORD_PATH.`
      );
    }
    if (!ANTIWORD_PREFLIGHT.antiwordHomeExists) {
      throw new Error(
        `تعذر استخراج DOCX: مسار ANTIWORDHOME غير صالح (${ANTIWORD_PREFLIGHT.antiwordHome}).`
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
    const statusCode =
      error instanceof RequestValidationError ? error.statusCode : 500;
    sendJson(res, statusCode, {
      success: false,
      error: message,
    });
  }
};

const handleAgentReview = async (req, res) => {
  let importOpId = null;
  try {
    const rawBody = await readJsonBody(req);
    // Extract importOpId early for error response
    importOpId = typeof rawBody?.importOpId === "string" ? rawBody.importOpId : null;
    const body = validateAgentReviewRequestBody(rawBody);
    const response = await requestAnthropicReview(body);
    sendJson(res, 200, response);
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

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { success: false, error: "Not found." });
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    const ocrProvider = (process.env.OCR_PROVIDER || "mistral")
      .trim()
      .toLowerCase();
    const selectiveOcrEnabled = ocrProvider !== "none";
    const selectiveOcrConfigured =
      !selectiveOcrEnabled || Boolean(process.env.MISTRAL_API_KEY);

    sendJson(res, 200, {
      ok: true,
      service: "file-import-backend",
      ocrConfigured: selectiveOcrConfigured,
      pdfTextLayerScriptAvailable: isPdfTextLayerScriptAvailable(),
      pdfSinglePipelineEnabled: true,
      pdfSelectiveOcrEnabled: selectiveOcrEnabled,
      antiwordPath: process.env.ANTIWORD_PATH || DEFAULT_ANTIWORD_PATH,
      antiwordHome: process.env.ANTIWORDHOME || DEFAULT_ANTIWORD_HOME,
      antiwordBinaryAvailable: ANTIWORD_PREFLIGHT.binaryAvailable,
      antiwordHomeExists: ANTIWORD_PREFLIGHT.antiwordHomeExists,
      antiwordWarnings: ANTIWORD_PREFLIGHT.warnings,
      agentReviewConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      model: selectiveOcrEnabled ? "mistral-ocr-latest" : "none",
      reviewModel: getAnthropicReviewModel(),
    });
    return;
  }

  if (
    req.method === "POST" &&
    (url.pathname === "/api/file-extract" ||
      url.pathname === "/api/files/extract")
  ) {
    await handleExtract(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/agent/review") {
    await handleAgentReview(req, res);
    return;
  }

  sendJson(res, 404, { success: false, error: "Route not found." });
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
  if (ANTIWORD_PREFLIGHT.warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[antiword preflight] warnings:");
    for (const warning of ANTIWORD_PREFLIGHT.warnings) {
      // eslint-disable-next-line no-console
      console.warn(`- ${warning}`);
    }
  }
});

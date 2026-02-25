/**
 * @module utils/file-import/extract/backend-extract
 * @description استخراج النصوص عبر خادم Backend خارجي (REST API).
 *
 * يُرسل الملف بصيغة Base64 داخل جسم JSON إلى نقطة النهاية المحددة في
 * `VITE_FILE_IMPORT_BACKEND_URL`، مع مهلة زمنية افتراضية 45 ثانية
 * عبر {@link AbortController}.
 *
 * يُستخدم كبديل احتياطي (fallback) عندما يفشل الاستخراج في المتصفح
 * أو عندما يكون النوع غير مدعوم داخل المتصفح.
 */
import type {
  FileExtractionResponse,
  FileExtractionResult,
  ExtractionMethod,
  ImportedFileType,
} from "../../../types/file-import";

/** نقطة نهاية Backend المأخوذة من متغير البيئة */
const DEV_DEFAULT_BACKEND_ENDPOINT = "http://127.0.0.1:8787/api/file-extract";
const ENV_BACKEND_ENDPOINT =
  (
    import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined
  )?.trim() || (import.meta.env.DEV ? DEV_DEFAULT_BACKEND_ENDPOINT : "");

const EXTRACTION_METHODS = new Set<ExtractionMethod>([
  "native-text",
  "mammoth",
  "doc-converter-flow",
  "ocr-mistral",
  "backend-api",
  "app-payload",
]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isExtractionMethod = (value: unknown): value is ExtractionMethod =>
  typeof value === "string" &&
  EXTRACTION_METHODS.has(value as ExtractionMethod);

/**
 * يحوّل ArrayBuffer إلى سلسلة Base64 عبر تقطيع القطع (chunks)
 * لتجنب تجاوز حد المكدس في `String.fromCharCode`.
 *
 * @param arrayBuffer - المخزن المؤقت المراد ترميزه
 * @returns سلسلة Base64
 */
const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  const runtimeBuffer = (
    globalThis as {
      Buffer?: {
        from: (
          input: string,
          encoding: string
        ) => { toString: (encoding: string) => string };
      };
    }
  ).Buffer;

  if (runtimeBuffer) {
    return runtimeBuffer.from(binary, "binary").toString("base64");
  }

  throw new Error("No base64 encoder is available in the current runtime.");
};

/** يزيل الشرطة المائلة الزائدة من نهاية عنوان URL */
const normalizeEndpoint = (endpoint: string): string =>
  endpoint.replace(/\/$/, "");

/**
 * خيارات استخراج الملف عبر Backend.
 * @property endpoint - عنوان URL مخصص (يتجاوز متغير البيئة)
 * @property timeoutMs - مهلة الطلب بالمللي ثانية (الافتراضي: 45000)
 */
export interface BackendExtractOptions {
  endpoint?: string;
  timeoutMs?: number;
}

/**
 * يتحقق ممّا إذا كان Backend مضبوطاً (عبر متغير البيئة أو endpoint صريح).
 *
 * @param endpoint - عنوان اختياري يتجاوز `VITE_FILE_IMPORT_BACKEND_URL`
 * @returns `true` إذا وُجد عنوان غير فارغ
 */
export const isBackendExtractionConfigured = (endpoint?: string): boolean =>
  Boolean((endpoint ?? ENV_BACKEND_ENDPOINT).trim());

/**
 * يحلّ عنوان نقطة النهاية النهائي، ويرمي خطأ إذا لم يُضبط أي عنوان.
 * @throws {Error} إذا لم يكن هناك endpoint مضبوط
 */
const resolveBackendExtractionEndpoint = (endpoint?: string): string => {
  const resolved = (endpoint ?? ENV_BACKEND_ENDPOINT).trim();
  if (!resolved) {
    throw new Error(
      "VITE_FILE_IMPORT_BACKEND_URL غير مضبوط. اضبط endpoint كامل مثل: http://127.0.0.1:8787/api/file-extract"
    );
  }

  return normalizeEndpoint(resolved);
};

const parseBackendExtractionResult = (
  fileType: ImportedFileType,
  body: FileExtractionResponse
): FileExtractionResult => {
  if (!body.success || !body.data) {
    throw new Error(body.error || "Backend extraction failed without details.");
  }

  const data = body.data;
  if (!isObjectRecord(data)) {
    throw new Error("Backend extraction response has invalid shape.");
  }
  if (typeof data.text !== "string") {
    throw new Error("Backend extraction response is missing text field.");
  }
  if (!isStringArray(data.warnings ?? [])) {
    throw new Error("Backend extraction response has invalid warnings field.");
  }
  if (!isStringArray(data.attempts ?? [])) {
    throw new Error("Backend extraction response has invalid attempts field.");
  }
  if (!isExtractionMethod(data.method ?? "backend-api")) {
    throw new Error(
      `Backend extraction response returned unknown method: ${String(data.method)}`
    );
  }
  if (typeof data.usedOcr !== "boolean") {
    throw new Error("Backend extraction response has invalid usedOcr field.");
  }

  const qualityScore =
    typeof data.qualityScore === "number" && Number.isFinite(data.qualityScore)
      ? data.qualityScore
      : undefined;

  const normalizationApplied =
    Array.isArray(data.normalizationApplied) &&
    data.normalizationApplied.every((entry) => typeof entry === "string")
      ? data.normalizationApplied
      : undefined;

  const structuredBlocks =
    Array.isArray(data.structuredBlocks) &&
    data.structuredBlocks.every(
      (block) =>
        block &&
        typeof block.formatId === "string" &&
        typeof block.text === "string"
    )
      ? data.structuredBlocks
      : undefined;

  const payloadVersion =
    typeof data.payloadVersion === "number" &&
    Number.isInteger(data.payloadVersion)
      ? data.payloadVersion
      : undefined;

  return {
    ...data,
    fileType,
    method: data.method,
    warnings: data.warnings,
    attempts: data.attempts,
    usedOcr: data.usedOcr,
    qualityScore,
    normalizationApplied,
    structuredBlocks,
    payloadVersion,
  };
};

const extractBackendErrorMessage = (
  responseText: string,
  status: number
): string => {
  if (!responseText.trim()) {
    return `Backend returned HTTP ${status}`;
  }

  try {
    const parsed = JSON.parse(responseText) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return `Backend returned HTTP ${status}: ${parsed.error.trim()}`;
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return `Backend returned HTTP ${status}: ${parsed.message.trim()}`;
    }
  } catch {
    // ignore parse failure
  }

  return `Backend returned HTTP ${status}: ${responseText.trim()}`;
};

const executeBackendExtractionRequest = async (
  endpoint: string,
  fileType: ImportedFileType,
  requestInit: RequestInit
): Promise<FileExtractionResult> => {
  const response = await fetch(endpoint, requestInit);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(responseText, response.status));
  }

  if (!responseText.trim()) {
    throw new Error("Backend extraction response was empty.");
  }

  const body = JSON.parse(responseText) as FileExtractionResponse;
  return parseBackendExtractionResult(fileType, body);
};

const createErrorWithCause = (message: string, cause: unknown): Error => {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;
  return error;
};

/**
 * يستخرج نص الملف عبر Backend API.
 *
 * يُرسل الملف كـ Base64 في جسم JSON ويستقبل {@link FileExtractionResult}.
 * يدعم مهلة زمنية عبر AbortController (الافتراضي 45 ثانية).
 *
 * @param file - كائن الملف المراد استخراجه
 * @param fileType - نوع الملف المُحدد مسبقاً
 * @param options - خيارات اختيارية (endpoint، مهلة)
 * @returns نتيجة الاستخراج
 * @throws {Error} عند فشل الاتصال أو انتهاء المهلة
 */
export const extractFileWithBackend = async (
  file: File,
  fileType: ImportedFileType,
  options?: BackendExtractOptions
): Promise<FileExtractionResult> => {
  const endpoint = resolveBackendExtractionEndpoint(options?.endpoint);

  const timeoutMs = options?.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const sendJsonRequest = async (): Promise<FileExtractionResult> => {
      const arrayBuffer = await file.arrayBuffer();
      const payload = {
        filename: file.name,
        extension: fileType,
        fileBase64: arrayBufferToBase64(arrayBuffer),
      };

      return executeBackendExtractionRequest(endpoint, fileType, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    };

    return await sendJsonRequest();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createErrorWithCause("Backend extraction timed out.", error);
    }
    if (error instanceof TypeError) {
      throw createErrorWithCause(
        `تعذر الاتصال بخدمة Backend extraction على ${endpoint}.`,
        error
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

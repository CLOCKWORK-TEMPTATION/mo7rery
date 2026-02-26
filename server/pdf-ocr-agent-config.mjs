import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

const DEFAULT_AGENT_ROOT = resolve(PROJECT_ROOT, "ocr-arabic-pdf-to-txt");

const baseConfigSchema = z.object({
  enabled: z.boolean(),
  agentRoot: z.string().min(1),
  ocrScriptPath: z.string().min(1),
  timeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(30 * 60 * 1_000),
  pages: z.string().min(1),
  mistralApiKey: z.string(),
});

const isFalseLike = (value) => /^(0|false|no|off)$/iu.test(value.trim());

const toEnabledFlag = (value) => {
  if (typeof value !== "string") return true;
  return !isFalseLike(value);
};

const toTimeoutMs = (value) => {
  const fallback = 10 * 60 * 1_000;
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const resolveRawConfig = () => {
  const agentRoot =
    process.env.PDF_OCR_AGENT_ROOT?.trim() || resolve(DEFAULT_AGENT_ROOT);

  const ocrScriptPath =
    process.env.PDF_OCR_AGENT_OCR_SCRIPT_PATH?.trim() ||
    resolve(agentRoot, "src", "skill-scripts", "ocr-mistral.ts");

  return {
    enabled: toEnabledFlag(process.env.PDF_OCR_AGENT_ENABLED),
    agentRoot,
    ocrScriptPath,
    timeoutMs: toTimeoutMs(process.env.PDF_OCR_AGENT_TIMEOUT_MS),
    pages: process.env.PDF_OCR_AGENT_PAGES?.trim() || "all",
    mistralApiKey: process.env.MISTRAL_API_KEY?.trim() || "",
  };
};

export const getPdfOcrAgentConfig = () => {
  const parsed = baseConfigSchema.parse(resolveRawConfig());
  if (!parsed.enabled) {
    return parsed;
  }

  if (!parsed.mistralApiKey) {
    throw new Error(
      "PDF OCR agent misconfigured: MISTRAL_API_KEY is required for PDF extraction."
    );
  }

  if (!existsSync(parsed.agentRoot)) {
    throw new Error(
      `PDF OCR agent misconfigured: agent root does not exist (${parsed.agentRoot}).`
    );
  }

  if (!existsSync(parsed.ocrScriptPath)) {
    throw new Error(
      `PDF OCR agent misconfigured: OCR script does not exist (${parsed.ocrScriptPath}).`
    );
  }

  return parsed;
};

export const getPdfOcrAgentHealth = () => {
  const config = baseConfigSchema.parse(resolveRawConfig());
  const agentRootExists = existsSync(config.agentRoot);
  const ocrScriptExists = existsSync(config.ocrScriptPath);
  const hasMistralApiKey = config.mistralApiKey.length > 0;
  const configured =
    config.enabled && agentRootExists && ocrScriptExists && hasMistralApiKey;

  return {
    enabled: config.enabled,
    configured,
    hasMistralApiKey,
    agentRoot: config.agentRoot,
    agentRootExists,
    ocrScriptPath: config.ocrScriptPath,
    ocrScriptExists,
    timeoutMs: config.timeoutMs,
    pages: config.pages,
  };
};

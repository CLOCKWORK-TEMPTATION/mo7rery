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

const DEFAULT_AGENT_ROOT = resolve(
  PROJECT_ROOT,
  "src",
  "ocr-arabic-pdf-to-txt-pipeline"
);

const baseConfigSchema = z.object({
  enabled: z.boolean(),
  agentRoot: z.string().min(1),
  openPdfAgentScriptPath: z.string().min(1),
  ocrScriptPath: z.string().min(1),
  classifyScriptPath: z.string().min(1),
  enhanceScriptPath: z.string().min(1),
  writeOutputScriptPath: z.string().min(1),
  timeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(30 * 60 * 1_000),
  pages: z.string().min(1),
  mistralApiKey: z.string(),
  enableClassification: z.boolean(),
  enableEnhancement: z.boolean(),
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

  const skillScriptsDir = resolve(agentRoot, "skill-scripts");
  const openPdfAgentScriptPath =
    process.env.PDF_OCR_AGENT_OPEN_SCRIPT_PATH?.trim() ||
    resolve(agentRoot, "open-pdf-agent.ts");

  const ocrScriptPath =
    process.env.PDF_OCR_AGENT_OCR_SCRIPT_PATH?.trim() ||
    resolve(skillScriptsDir, "ocr-mistral.ts");

  const classifyScriptPath =
    process.env.PDF_OCR_AGENT_CLASSIFY_SCRIPT_PATH?.trim() ||
    resolve(skillScriptsDir, "classify-pdf.ts");

  const enhanceScriptPath =
    process.env.PDF_OCR_AGENT_ENHANCE_SCRIPT_PATH?.trim() ||
    resolve(skillScriptsDir, "enhance-image.ts");

  const writeOutputScriptPath =
    process.env.PDF_OCR_AGENT_WRITE_OUTPUT_SCRIPT_PATH?.trim() ||
    resolve(skillScriptsDir, "write-output.ts");

  return {
    enabled: toEnabledFlag(process.env.PDF_OCR_AGENT_ENABLED),
    agentRoot,
    openPdfAgentScriptPath,
    ocrScriptPath,
    classifyScriptPath,
    enhanceScriptPath,
    writeOutputScriptPath,
    timeoutMs: toTimeoutMs(process.env.PDF_OCR_AGENT_TIMEOUT_MS),
    pages: process.env.PDF_OCR_AGENT_PAGES?.trim() || "all",
    mistralApiKey: process.env.MISTRAL_API_KEY?.trim() || "",
    enableClassification: toEnabledFlag(
      process.env.PDF_OCR_AGENT_CLASSIFY_ENABLED
    ),
    enableEnhancement: toEnabledFlag(process.env.PDF_OCR_AGENT_ENHANCE_ENABLED),
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

  const requiredScripts = [
    ["openPdfAgentScriptPath", parsed.openPdfAgentScriptPath],
    ["ocrScriptPath", parsed.ocrScriptPath],
    ["classifyScriptPath", parsed.classifyScriptPath],
    ["writeOutputScriptPath", parsed.writeOutputScriptPath],
  ];

  for (const [label, scriptPath] of requiredScripts) {
    if (!existsSync(scriptPath)) {
      throw new Error(
        `PDF OCR agent misconfigured: ${label} does not exist (${scriptPath}).`
      );
    }
  }

  return parsed;
};

export const getPdfOcrAgentHealth = () => {
  const config = baseConfigSchema.parse(resolveRawConfig());
  const agentRootExists = existsSync(config.agentRoot);
  const openPdfAgentScriptExists = existsSync(config.openPdfAgentScriptPath);
  const ocrScriptExists = existsSync(config.ocrScriptPath);
  const classifyScriptExists = existsSync(config.classifyScriptPath);
  const enhanceScriptExists = existsSync(config.enhanceScriptPath);
  const writeOutputScriptExists = existsSync(config.writeOutputScriptPath);
  const hasMistralApiKey = config.mistralApiKey.length > 0;
  const configured =
    config.enabled &&
    agentRootExists &&
    openPdfAgentScriptExists &&
    ocrScriptExists &&
    classifyScriptExists &&
    writeOutputScriptExists &&
    hasMistralApiKey;

  return {
    enabled: config.enabled,
    configured,
    hasMistralApiKey,
    agentRoot: config.agentRoot,
    agentRootExists,
    openPdfAgentScriptPath: config.openPdfAgentScriptPath,
    openPdfAgentScriptExists,
    ocrScriptPath: config.ocrScriptPath,
    ocrScriptExists,
    classifyScriptPath: config.classifyScriptPath,
    classifyScriptExists,
    enhanceScriptPath: config.enhanceScriptPath,
    enhanceScriptExists,
    writeOutputScriptPath: config.writeOutputScriptPath,
    writeOutputScriptExists,
    enableClassification: config.enableClassification,
    enableEnhancement: config.enableEnhancement,
    timeoutMs: config.timeoutMs,
    pages: config.pages,
  };
};

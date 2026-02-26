#!/usr/bin/env node

/**
 * TypeScript conversion of ncio_mistral_all_in_one.py
 * PDF -> Markdown عبر Mistral OCR مع طبقة تطبيع + LLM refinement اختياري.
 *
 * ملاحظة:
 * - المسار المباشر (PDF document_url) مدعوم بالكامل.
 * - المسار page-by-page + pre-OCR غير مفعل في نسخة TS (كان يعتمد PaddleOCR + PyMuPDF في بايثون).
 */

import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import util from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

// ============================================================================
// Constants
// ============================================================================

const APP_NAME = "MistralOCRPDFConverter";
const DEFAULT_LLM_MODEL = "gpt-5.2";
const DEFAULT_MISTRAL_OCR_MODEL = "mistral-ocr-latest";
const DEFAULT_PRE_OCR_LANG = "ar";

const DEFAULT_MATCH_THRESHOLD = 0.88;
const DEFAULT_FULLPAGE_FALLBACK_RATIO = 0.70;
const DEFAULT_REGION_PADDING_PX = 12;
const DEFAULT_LLM_MAX_ITERATIONS = 3;
const DEFAULT_LLM_TARGET_MATCH = 100.0;
const DEFAULT_DIFF_PREVIEW_LINES = 12;

const DEFAULT_INPUT = String.raw`E:\New folder (31)\12.pdf`;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MISTRAL_BASE_URL = (process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1").replace(/\/+$/u, "");

// ============================================================================
// Types
// ============================================================================

export interface LLMConfig {
  enabled: boolean;
  model: string;
  referencePath?: string;
  strict: boolean;
  iterative: boolean;
  maxIterations: number;
  targetMatch: number;
  diffPreviewLines: number;
}

export interface MistralOCRConfig {
  model: string;
  useDocumentInput: boolean;
  useBatchOCR: boolean;
  batchTimeoutSec: number;
  batchPollIntervalSec: number;
  annotationSchemaPath?: string;
  annotationPrompt?: string;
  annotationOutputPath?: string;
  annotationStrict: boolean;
  tableFormat?: "markdown" | "html";
  extractHeader: boolean;
  extractFooter: boolean;
  includeImageBase64: boolean;
}

export interface PreOCRConfig {
  enabled: boolean;
  lang: string;
  matchThreshold: number;
  fullpageFallbackRatio: number;
  regionPaddingPx: number;
}

export interface NormalizationOptions {
  normalizeYa?: boolean;
  normalizeTaMarbuta?: boolean;
  normalizeHamza?: boolean;
  normalizeDigits?: "none" | "arabic" | "western";
  removeDiacritics?: boolean;
  fixConnectedLetters?: boolean;
  fixArabicPunctuation?: boolean;
  scriptSpecificRules?: boolean;
}

export interface ConfigManager {
  inputPath: string;
  outputPath?: string;
  normalizeOutput: boolean;
  normalizerOptions?: NormalizationOptions;
  saveRawMarkdown: boolean;
  llm: LLMConfig;
  mistral: MistralOCRConfig;
  preOcr: PreOCRConfig;
}

type JsonRecord = Record<string, unknown>;

// ============================================================================
// Logging
// ============================================================================

function log(level: "INFO" | "WARN" | "ERROR" | "CRITICAL", message: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  const line = `${ts} - ${APP_NAME} - ${level} - ${util.format(message, ...args)}`;
  if (level === "ERROR" || level === "CRITICAL") {
    console.error(line);
  } else {
    console.log(line);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isTruthy(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadEnvFile(envPath: string): Promise<void> {
  if (!(await fileExists(envPath))) {
    return;
  }

  try {
    const content = await readFile(envPath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) {
        continue;
      }

      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");

      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }

    log("INFO", "تم تحميل متغيرات البيئة من: %s", envPath);
  } catch (error) {
    log("WARN", "تعذر تحميل ملف البيئة %s: %s", envPath, String(error));
  }
}

function getEnvOrRaise(key: string, message?: string): string {
  const value = (process.env[key] ?? "").trim();
  if (!value) {
    throw new Error(message ?? `متغير ${key} غير موجود. أضف المفتاح في البيئة أو في ملف .env`);
  }
  return value;
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function field<T>(obj: unknown, name: string, fallback: T): T {
  if (obj && typeof obj === "object" && name in (obj as JsonRecord)) {
    const value = (obj as JsonRecord)[name] as T;
    return value ?? fallback;
  }
  return fallback;
}

function str(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function toNumberInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const v = Number.parseInt(raw, 10);
  return Number.isFinite(v) ? v : fallback;
}

function toNumberFloat(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

interface ParsedArgs {
  [key: string]: string | boolean | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const arg = token.slice(2);
    const eq = arg.indexOf("=");

    if (eq >= 0) {
      const name = arg.slice(0, eq).trim();
      const value = arg.slice(eq + 1);
      if (name) {
        parsed[name] = value;
      }
      continue;
    }

    const name = arg.trim();
    if (!name) {
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[name] = next;
      i += 1;
    } else {
      parsed[name] = true;
    }
  }

  return parsed;
}

function argString(parsed: ParsedArgs, name: string, fallback: string): string {
  const v = parsed[name];
  if (typeof v === "string" && v.trim()) {
    return v;
  }
  return fallback;
}

function argOptionalString(parsed: ParsedArgs, name: string): string | undefined {
  const v = parsed[name];
  if (typeof v === "string" && v.trim()) {
    return v;
  }
  return undefined;
}

function argBool(parsed: ParsedArgs, name: string, fallback = false): boolean {
  const v = parsed[name];
  if (typeof v === "boolean") {
    return v;
  }
  if (typeof v === "string") {
    return isTruthy(v);
  }
  return fallback;
}

function buildConfig(argv: string[]): ConfigManager {
  const args = parseArgs(argv);

  const llm: LLMConfig = {
    enabled: argBool(args, "use-llm"),
    model: argString(args, "llm-model", DEFAULT_LLM_MODEL),
    referencePath: argOptionalString(args, "llm-reference"),
    strict: argBool(args, "llm-strict"),
    iterative: !argBool(args, "llm-no-iterative"),
    maxIterations: Math.max(1, toNumberInt(argOptionalString(args, "llm-max-iterations"), DEFAULT_LLM_MAX_ITERATIONS)),
    targetMatch: clamp(toNumberFloat(argOptionalString(args, "llm-target-match"), DEFAULT_LLM_TARGET_MATCH), 0, 100),
    diffPreviewLines: Math.max(1, toNumberInt(argOptionalString(args, "llm-diff-preview-lines"), DEFAULT_DIFF_PREVIEW_LINES)),
  };

  const tableRaw = (argOptionalString(args, "mistral-table-format") ?? process.env.MISTRAL_OCR_TABLE_FORMAT ?? "").trim().toLowerCase();
  const tableFormat = (tableRaw === "markdown" || tableRaw === "html") ? (tableRaw as "markdown" | "html") : undefined;

  const mistral: MistralOCRConfig = {
    model: argString(args, "mistral-ocr-model", (process.env.MISTRAL_OCR_MODEL ?? DEFAULT_MISTRAL_OCR_MODEL).trim() || DEFAULT_MISTRAL_OCR_MODEL),
    useDocumentInput: !argBool(args, "mistral-disable-document-input"),
    useBatchOCR: argBool(args, "mistral-use-batch"),
    batchTimeoutSec: Math.max(5, toNumberInt(argOptionalString(args, "mistral-batch-timeout-sec") ?? process.env.MISTRAL_BATCH_TIMEOUT_SEC, 300)),
    batchPollIntervalSec: Math.max(0.5, toNumberFloat(argOptionalString(args, "mistral-batch-poll-interval-sec") ?? process.env.MISTRAL_BATCH_POLL_INTERVAL_SEC, 3)),
    annotationSchemaPath: argOptionalString(args, "mistral-annotation-schema") ?? (process.env.MISTRAL_ANNOTATION_SCHEMA_PATH?.trim() || undefined),
    annotationPrompt: argOptionalString(args, "mistral-annotation-prompt") ?? (process.env.MISTRAL_ANNOTATION_PROMPT?.trim() || undefined),
    annotationOutputPath: argOptionalString(args, "mistral-annotation-output") ?? (process.env.MISTRAL_ANNOTATION_OUTPUT_PATH?.trim() || undefined),
    annotationStrict: !argBool(args, "mistral-annotation-non-strict"),
    tableFormat,
    extractHeader: argBool(args, "mistral-extract-header"),
    extractFooter: argBool(args, "mistral-extract-footer"),
    includeImageBase64: argBool(args, "mistral-include-image-base64"),
  };

  const preOcr: PreOCRConfig = {
    enabled: !argBool(args, "disable-pre-ocr-filter"),
    lang: argString(args, "pre-ocr-lang", (process.env.PRE_OCR_LANG ?? DEFAULT_PRE_OCR_LANG).trim() || DEFAULT_PRE_OCR_LANG),
    matchThreshold: clamp(toNumberFloat(argOptionalString(args, "pre-ocr-match-threshold"), DEFAULT_MATCH_THRESHOLD), 0, 1),
    fullpageFallbackRatio: clamp(toNumberFloat(argOptionalString(args, "pre-ocr-fullpage-fallback-ratio"), DEFAULT_FULLPAGE_FALLBACK_RATIO), 0, 1),
    regionPaddingPx: Math.max(0, toNumberInt(argOptionalString(args, "pre-ocr-region-padding-px"), DEFAULT_REGION_PADDING_PX)),
  };

  const normalizerOptions: NormalizationOptions = {
    normalizeYa: argBool(args, "normalize-ya", false),
    normalizeTaMarbuta: argBool(args, "normalize-ta-marbuta", false),
    normalizeHamza: !argBool(args, "no-normalize-hamza"),
    normalizeDigits: (argOptionalString(args, "normalize-digits") ?? "arabic") as "none" | "arabic" | "western",
    removeDiacritics: !argBool(args, "no-remove-diacritics"),
    fixConnectedLetters: !argBool(args, "no-fix-connected-letters"),
    fixArabicPunctuation: !argBool(args, "no-fix-arabic-punctuation"),
    scriptSpecificRules: !argBool(args, "no-script-specific-rules"),
  };

  return {
    inputPath: argString(args, "input", DEFAULT_INPUT),
    outputPath: argOptionalString(args, "output"),
    normalizeOutput: !argBool(args, "no-normalize"),
    normalizerOptions,
    saveRawMarkdown: !argBool(args, "no-raw"),
    llm,
    mistral,
    preOcr,
  };
}

// ============================================================================
// Markdown Normalizer
// ============================================================================

export class MarkdownNormalizer {
  private readonly noiseOnlyLine = /^[\s\-•▪*·.]+$/u;
  private readonly bulletPrefixPattern = /^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+]/u;
  private readonly invisibleCharsPattern = /[\u200f\u200e\ufeff\u061c]/gu;
  private readonly htmlTagPattern = /<[^>]+>/gu;
  private readonly domArtifactTokenPattern = /@dom-element:[^\s]+/giu;
  private readonly headingNumberPattern = /^(#{1,6})\s*(\d+)\s*$/u;
  private readonly sceneHeadingPattern = /^(#{1,6})\s*(مشهد)\s*$/u;
  private readonly arabicDiacritics = /[\u064b-\u065f\u0670]/gu;
  private readonly nonWordPattern = /[^\w\u0600-\u06FF\s]/gu;
  private readonly whitespacePattern = /\s+/gu;
  private readonly sentenceEndPattern = /[.!؟?!…»"]\s*$/u;
  private readonly continuationPrefixRe = /^(?:\.{3}|…|،|(?:و|ثم)\s+)/u;

  private readonly sceneNumberExactRe = /^\s*(?:مشهد|scene)\s*[0-9٠-٩]+/iu;
  private readonly sceneTimeRe = /(نهار|ليل|صباح|مساء|فجر)/iu;
  private readonly sceneLocationRe = /(داخلي|خارجي)/iu;
  private readonly transitionRe = /^(?:قطع|اختفاء|تحول|انتقال|fade|cut|dissolve|wipe)(?:\s+(?:إلى|to))?[:\s]*$/iu;
  private readonly characterRe = /^\s*(?:صوت\s+)?[\u0600-\u06FF][\u0600-\u06FF\s0-9٠-٩]{0,30}:?\s*$/u;
  private readonly parentheticalRe = /^[\(（].*?[\)）]$/u;
  private readonly inlineDialogueGlueRe = /^([\u0600-\u06FF]+(?:اً))([\u0600-\u06FF][\u0600-\u06FF\s]{0,20}?)\s*[:：]\s*(.+)$/u;
  private readonly inlineDialogueRe = /^([^:：]{1,60}?)\s*[:：]\s*(.+)$/u;
  private readonly arabicOnlyWithNumbersRe = /^[\s\u0600-\u06FF\d٠-٩\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+$/u;
  private readonly basmalaBasmRe = /بسم/iu;
  private readonly basmalaAllahRe = /الله/iu;
  private readonly basmalaRahmanRe = /الرحمن/iu;
  private readonly basmalaRahimRe = /الرحيم/iu;

  private readonly headerKeywords = new Set(["بسم الله", "مشهد", "الصالة", "نهار", "- داخلي"]);
  private readonly sceneMetadata = new Set(["قطع", "### قطع", "## قطع", "# قطع", "- قطع"]);

  private readonly options: Required<NormalizationOptions>;

  constructor(options: NormalizationOptions = {}) {
    this.options = {
      normalizeYa: options.normalizeYa ?? false,
      normalizeTaMarbuta: options.normalizeTaMarbuta ?? false,
      normalizeHamza: options.normalizeHamza ?? true,
      normalizeDigits: options.normalizeDigits ?? "arabic",
      removeDiacritics: options.removeDiacritics ?? true,
      fixConnectedLetters: options.fixConnectedLetters ?? true,
      fixArabicPunctuation: options.fixArabicPunctuation ?? true,
      scriptSpecificRules: options.scriptSpecificRules ?? true,
    };
  }

  private normalizeArabicCharacters(text: string): string {
    let result = text;
    if (this.options.normalizeYa) {
      result = result.replace(/ى/g, "ي");
    }
    if (this.options.normalizeTaMarbuta) {
      result = result.replace(/ة/g, "ه");
    }
    return result;
  }

  private normalizeHamzaChars(text: string): string {
    if (!this.options.normalizeHamza) return text;
    let result = text;
    result = result.replace(/[إأآ]/g, "ا");
    result = result.replace(/ؤ/g, "و");
    return result;
  }

  private normalizeDigitsChars(text: string): string {
    const mode = this.options.normalizeDigits;
    if (mode === "none") return text;

    let result = text;
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const westernDigits = "0123456789";

    if (mode === "arabic") {
      for (let i = 0; i < 10; i++) {
        result = result.replace(new RegExp(westernDigits[i], "g"), arabicDigits[i]);
        result = result.replace(new RegExp(persianDigits[i], "g"), arabicDigits[i]);
      }
    } else if (mode === "western") {
      for (let i = 0; i < 10; i++) {
        result = result.replace(new RegExp(arabicDigits[i], "g"), westernDigits[i]);
        result = result.replace(new RegExp(persianDigits[i], "g"), westernDigits[i]);
      }
    }

    return result;
  }

  private fixConnectedLettersChars(text: string): string {
    if (!this.options.fixConnectedLetters) return text;
    let result = text;
    result = result.replace(/[\uFEED\uFEEE\uFEE9\uFEEA]/g, "و");
    result = result.replace(/[\uFED1\uFED2\uFED3\uFED4]/g, "ف");
    result = result.replace(/[\uFE91\uFE92\uFE8F\uFE90]/g, "ب");
    result = result.replace(/[\uFE97\uFE98\uFE95\uFE96]/g, "ت");
    return result;
  }

  private fixArabicPunctuationChars(text: string): string {
    if (!this.options.fixArabicPunctuation) return text;
    let result = text;
    result = result.replace(/،(?!\s)/g, "، ");
    result = result.replace(/,(?!\s)/g, ", ");
    result = result.replace(/\s+،/g, "،");
    result = result.replace(/\s+,/g, ",");
    result = result.replace(/\.(?!\s|\.)/g, ". ");
    result = result.replace(/\s*([؟?!])\s*/g, " $1 ");
    result = result.replace(/\s{2,}/g, " ");
    return result;
  }

  normalize(text: string): string {
    const unicode = this.normalizeUnicode(text);
    const fixedLetters = this.fixConnectedLettersChars(unicode);
    const normalizedChars = this.normalizeArabicCharacters(fixedLetters);
    const normalizedHamza = this.normalizeHamzaChars(normalizedChars);
    const normalizedDigits = this.normalizeDigitsChars(normalizedHamza);

    let lines = this.normalizeLines(normalizedDigits);
    lines = lines.map((line) => this.normalizeStructuralLine(line));

    if (this.options.scriptSpecificRules) {
      lines = this.filterSceneMetadata(lines);
    }

    if (this.options.scriptSpecificRules) {
      lines = lines.map((line) => this.normalizeSpeakerLine(line));
    }

    lines = this.normalizeBullets(lines);

    if (this.options.scriptSpecificRules) {
      lines = this.mergeSplitHeadings(lines);
    }

    lines = this.mergeWrappedLines(lines);
    lines = this.collapseBlankLines(lines);

    let finalText = lines.join("\n").trim();
    finalText = this.fixArabicPunctuationChars(finalText);

    return ensureTrailingNewline(finalText);
  }

  normalizeForMatch(text: string): string {
    let out = text.trim().toLowerCase();
    out = out.replace(this.arabicDiacritics, "");
    out = out.replace(this.nonWordPattern, " ");
    out = out.replace(this.whitespacePattern, " ").trim();
    return out;
  }

  private filterSceneMetadata(lines: string[]): string[] {
    const out: string[] = [];
    for (const line of lines) {
      const s = line.trim();
      if (this.sceneMetadata.has(s)) {
        continue;
      }
      if (this.transitionRe.test(s)) {
        continue;
      }
      out.push(line);
    }
    return out;
  }

  private normalizeUnicode(text: string): string {
    let out = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    out = out.replace(/\ufeff/g, "");
    out = out.replace(/\xa0/g, " ");
    out = out.replace(/[–—−]/g, "-");
    out = out.replace(/…/g, "...");

    const chars: string[] = [];
    for (const ch of out) {
      if (ch === "\n" || ch === "\t") {
        chars.push(ch);
        continue;
      }
      const cp = ch.codePointAt(0) ?? 0;
      const control = (cp >= 0 && cp <= 31) || (cp >= 127 && cp <= 159);
      if (!control) {
        chars.push(ch);
      }
    }

    return chars.join("").replace(this.invisibleCharsPattern, "");
  }

  private normalizeLines(text: string): string[] {
    const out: string[] = [];

    for (const raw of text.split("\n")) {
      let line = raw.replace(/\t/g, " ");
      line = line.replace(this.domArtifactTokenPattern, " ");
      line = line.replace(this.htmlTagPattern, " ");
      line = line.trim();
      line = line.replace(/\\-/g, "-");
      line = line.replace(/\*\*/g, "").replace(/__/g, "");
      line = line.replace(this.invisibleCharsPattern, "");

      if (line && this.noiseOnlyLine.test(line)) {
        continue;
      }

      line = this.normalizeLinePrefix(line);
      line = line.replace(this.whitespacePattern, " ").trim();
      out.push(line);
    }

    return out;
  }

  private normalizeLinePrefix(line: string): string {
    let out = line;
    out = out.replace(/^\*\s+/u, "- ");
    out = out.replace(/^-\s*-+\s*/u, "- ");
    out = out.replace(/^-\s*:\s*/u, "- ");
    out = out.replace(/^-\s*\.\.\s*/u, "- ");
    return out;
  }

  private normalizeStructuralLine(line: string): string {
    const stripped = line.trim();
    if (!stripped) {
      return "";
    }

    const compactArabic = stripped.replace(/[^\u0600-\u06FF\s]/gu, "");
    const hasBasm = this.basmalaBasmRe.test(compactArabic);
    const hasAllah = this.basmalaAllahRe.test(compactArabic);
    const hasRahman = this.basmalaRahmanRe.test(compactArabic);
    const hasRahim = this.basmalaRahimRe.test(compactArabic);

    if (hasBasm && hasAllah && (hasRahman || hasRahim)) {
      return "بسم الله الرحمن الرحيم";
    }

    const glueMatch = stripped.match(this.inlineDialogueGlueRe);
    if (glueMatch) {
      const speaker = `${glueMatch[1]} ${glueMatch[2]}`.replace(this.whitespacePattern, " ").trim();
      const dialogue = glueMatch[3].replace(this.whitespacePattern, " ").trim();
      if (speaker && dialogue && this.characterRe.test(`${speaker}:`)) {
        return `${speaker}: ${dialogue}`;
      }
    }

    const inline = stripped.match(this.inlineDialogueRe);
    if (inline) {
      const speaker = inline[1].replace(this.whitespacePattern, " ").trim();
      const dialogue = inline[2].replace(this.whitespacePattern, " ").trim();
      if (speaker && dialogue && this.arabicOnlyWithNumbersRe.test(speaker) && this.characterRe.test(`${speaker}:`)) {
        return `${speaker}: ${dialogue}`;
      }
    }

    if (this.transitionRe.test(stripped)) {
      return stripped.replace(/[:：]+\s*$/u, "").trim();
    }

    return stripped;
  }

  private isHeading(line: string): boolean {
    return line.startsWith("#");
  }

  private isBullet(line: string): boolean {
    return line.startsWith("- ") || line.startsWith("* ");
  }

  private isSceneHeaderCandidate(line: string): boolean {
    const normalized = line.replace(/-/g, " ").replace(this.whitespacePattern, " ").trim();
    if (!normalized) {
      return false;
    }
    if (this.sceneNumberExactRe.test(normalized)) {
      return true;
    }
    return this.sceneTimeRe.test(normalized) && this.sceneLocationRe.test(normalized);
  }

  private isStructuralBoundary(line: string): boolean {
    const s = line.trim();
    if (!s) {
      return true;
    }
    if (this.isHeading(s) || this.isBullet(s)) {
      return true;
    }
    if (this.transitionRe.test(s) || this.isSceneHeaderCandidate(s)) {
      return true;
    }
    if (this.parentheticalRe.test(s) || this.characterRe.test(s)) {
      return true;
    }
    if (s.startsWith("بسم الله")) {
      return true;
    }
    return false;
  }

  private mergeSplitHeadings(lines: string[]): string[] {
    const merged: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const scene = line.match(this.sceneHeadingPattern);

      if (scene) {
        let j = i + 1;
        while (j < lines.length && !lines[j]) {
          j += 1;
        }
        if (j < lines.length) {
          const num = lines[j].match(this.headingNumberPattern);
          if (num) {
            merged.push(`${scene[1]} ${scene[2]} ${num[2]}`);
            i = j + 1;
            continue;
          }
        }
      }

      merged.push(line);
      i += 1;
    }

    return merged;
  }

  private normalizeSpeakerLine(line: string): string {
    let out = line;
    out = out.replace(/\s*:\s+/gu, ": ");
    out = out.replace(/\s*\.\s*\./gu, "..");
    return out;
  }

  private normalizeBullets(lines: string[]): string[] {
    const out: string[] = [];
    for (const line of lines) {
      if (!line.startsWith("- ") && !this.bulletPrefixPattern.test(line)) {
        out.push(line);
        continue;
      }
      const stripped = line.replace(/^[\-*•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃+\s]+/u, "").trim();
      out.push(`- ${stripped}`);
    }
    return out;
  }

  private mergeWrappedLines(lines: string[]): string[] {
    const merged: string[] = [];

    for (const line of lines) {
      if (!line) {
        merged.push(line);
        continue;
      }
      if (merged.length === 0) {
        merged.push(line);
        continue;
      }

      const prev = merged[merged.length - 1];
      if (this.continuationPrefixRe.test(line)) {
        merged[merged.length - 1] = `${prev.trimEnd()} ${line.trimStart()}`;
        continue;
      }

      const isHeaderLine = [...this.headerKeywords].some((kw) => line.includes(kw));
      const isPrevHeader = [...this.headerKeywords].some((kw) => prev.includes(kw));
      const isStructuralLine = this.isStructuralBoundary(line);
      const isPrevStructural = this.isStructuralBoundary(prev);
      const prevEndsSentence = this.sentenceEndPattern.test(prev);

      const shouldMerge = (
        line
        && !this.isHeading(line)
        && !this.isBullet(line)
        && !isHeaderLine
        && !isStructuralLine
        && prev
        && !this.isHeading(prev)
        && !isPrevHeader
        && !isPrevStructural
        && !prevEndsSentence
      );

      if (shouldMerge) {
        merged[merged.length - 1] = `${prev.trimEnd()} ${line.trimStart()}`;
      } else {
        merged.push(line);
      }
    }

    return merged;
  }

  private collapseBlankLines(lines: string[]): string[] {
    const out: string[] = [];
    let prevBlank = false;
    for (const line of lines) {
      const blank = !line;
      if (blank && prevBlank) {
        continue;
      }
      out.push(line);
      prevBlank = blank;
    }
    return out;
  }
}

// ============================================================================
// LLM Post Processor
// ============================================================================

export class LLMPostProcessor {
  private static readonly SYSTEM_PROMPT =
    "You are an expert Arabic OCR post-processor for screenplay markdown. Return ONLY the final corrected markdown without explanations. Do not drop content. Keep headings, scene structure, and speaker lines consistent.";

  private static readonly USER_TEMPLATE = [
    "صحّح النص التالي لتحسين التطابق مع النسخة المرجعية إن وُجدت.",
    "قواعد التنفيذ:",
    "1) لا تضف شروحاً أو تعليقات.",
    "2) أخرج Markdown فقط.",
    "3) حافظ على ترتيب المشاهد والأسطر قدر الإمكان.",
    "4) حسّن أخطاء OCR الإملائية وعلامات الترقيم وترويسات المشاهد.",
    "",
    "[FEEDBACK]",
    "{feedback}",
    "",
    "[INPUT_MARKDOWN]",
    "{markdown_text}",
    "",
    "[REFERENCE_MARKDOWN]",
    "{reference_text}",
  ].join("\n");

  private readonly config: LLMConfig;
  private referenceCache?: string;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async getReferenceText(): Promise<string> {
    if (this.referenceCache !== undefined) {
      return this.referenceCache;
    }

    if (!this.config.referencePath) {
      this.referenceCache = "";
      return this.referenceCache;
    }

    if (!(await fileExists(this.config.referencePath))) {
      throw new Error(`الملف المرجعي غير موجود: ${this.config.referencePath}`);
    }

    this.referenceCache = await readFile(this.config.referencePath, "utf-8");
    return this.referenceCache;
  }

  async postprocess(markdownText: string, referenceText?: string, feedback = ""): Promise<string> {
    const apiKey = getEnvOrRaise("OPENAI_API_KEY");
    const effectiveReference = referenceText ?? (await this.getReferenceText());

    const userPrompt = LLMPostProcessor.USER_TEMPLATE
      .replace("{feedback}", feedback || "N/A")
      .replace("{markdown_text}", markdownText)
      .replace("{reference_text}", effectiveReference || "N/A");

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        input: [
          { role: "system", content: [{ type: "input_text", text: LLMPostProcessor.SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`فشل استدعاء OpenAI: ${response.status} ${response.statusText} - ${raw}`);
    }

    let data: JsonRecord = {};
    try {
      data = JSON.parse(raw) as JsonRecord;
    } catch {
      throw new Error("تعذر تحليل استجابة OpenAI كـ JSON.");
    }

    const out = this.extractOutputText(data).trim();
    if (!out) {
      throw new Error("الاستجابة من نموذج LLM كانت فارغة.");
    }

    const cleaned = this.stripMarkdownFences(out);
    return ensureTrailingNewline(cleaned);
  }

  private extractOutputText(data: JsonRecord): string {
    const direct = field<string>(data, "output_text", "");
    if (typeof direct === "string" && direct.trim()) {
      return direct;
    }

    const output = field<unknown[]>(data, "output", []);
    if (!Array.isArray(output)) {
      return "";
    }

    const chunks: string[] = [];
    for (const item of output) {
      if (str(field(item, "type", "")) !== "message") {
        continue;
      }
      const content = field<unknown[]>(item, "content", []);
      if (!Array.isArray(content)) {
        continue;
      }
      for (const segment of content) {
        const text = field<string>(segment, "text", "");
        if (typeof text === "string" && text.trim()) {
          chunks.push(text);
        }
      }
    }

    return chunks.join("\n").trim();
  }

  private stripMarkdownFences(text: string): string {
    let out = text.trim();
    out = out.replace(/^```(?:markdown)?\s*/iu, "");
    out = out.replace(/\s*```$/u, "");
    return out.trim();
  }
}

// ============================================================================
// Mistral OCR Service
// ============================================================================

export class MistralOCRService {
  private readonly config: MistralOCRConfig;
  private annotationSchemaCache?: JsonRecord;
  private lastDocumentAnnotation?: unknown;

  constructor(config: MistralOCRConfig) {
    this.config = config;
  }

  getLastDocumentAnnotation(): unknown {
    return this.lastDocumentAnnotation;
  }

  async processDocumentUrl(documentUrl: string, documentName?: string): Promise<string> {
    this.lastDocumentAnnotation = undefined;

    const documentPayload: JsonRecord = {
      type: "document_url",
      document_url: documentUrl,
    };
    if (documentName) {
      documentPayload.document_name = documentName;
    }

    const body: JsonRecord = {
      model: this.config.model,
      document: documentPayload,
      ...await this.buildCommonRequestKwargs(),
    };

    const response = await this.requestJson("POST", "/ocr", body);
    return this.extractMarkdownFromResponse(response);
  }

  async processPdfFile(pdfPath: string): Promise<string> {
    if (!(await fileExists(pdfPath))) {
      throw new Error(`ملف PDF غير موجود: ${pdfPath}`);
    }

    const pdfBytes = await readFile(pdfPath);
    const form = new FormData();
    form.append("purpose", "ocr");
    form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), path.basename(pdfPath));

    let fileId = "";

    try {
      const upload = await this.requestJson("POST", "/files", form);
      fileId = str(field(upload, "id", "")).trim();
      if (!fileId) {
        throw new Error("لم يتم الحصول على معرف الملف بعد الرفع إلى Mistral.");
      }

      const signedUrl = await this.getSignedUrl(fileId);
      if (!signedUrl) {
        throw new Error("تعذر الحصول على signed URL من Mistral.");
      }

      if (this.config.useBatchOCR) {
        try {
          return await this.processDocumentViaBatch(signedUrl, path.basename(pdfPath));
        } catch (error) {
          log("WARN", "تعذر/فشل Batch OCR (%s). fallback إلى OCR المباشر.", String(error));
        }
      }

      return this.processDocumentUrl(signedUrl, path.basename(pdfPath));
    } finally {
      if (fileId) {
        try {
          await this.requestJson("DELETE", `/files/${encodeURIComponent(fileId)}`);
        } catch (cleanupError) {
          log("WARN", "تعذر حذف ملف OCR المؤقت من Mistral (%s): %s", fileId, String(cleanupError));
        }
      }
    }
  }

  private async processDocumentViaBatch(documentUrl: string, documentName?: string): Promise<string> {
    this.lastDocumentAnnotation = undefined;

    const payload: JsonRecord = {
      document: {
        type: "document_url",
        document_url: documentUrl,
        ...(documentName ? { document_name: documentName } : {}),
      },
      ...await this.buildCommonRequestKwargs(),
    };

    const timeoutHours = Math.max(1, Math.ceil(this.config.batchTimeoutSec / 3600));
    const batch = await this.requestJson("POST", "/batch/jobs", {
      endpoint: "/v1/ocr",
      model: this.config.model,
      requests: [{ custom_id: "ocr-document-0", body: payload }],
      timeout_hours: timeoutHours,
    });

    const jobId = str(field(batch, "id", "")).trim();
    if (!jobId) {
      throw new Error("تعذر إنشاء Batch Job صالح لعملية OCR.");
    }

    log("INFO", "تم إنشاء Batch OCR job: %s", jobId);

    const deadline = Date.now() + this.config.batchTimeoutSec * 1000;
    const pollInterval = Math.max(500, Math.round(this.config.batchPollIntervalSec * 1000));

    while (true) {
      const job = await this.requestJson("GET", `/batch/jobs/${encodeURIComponent(jobId)}?inline=true`);
      const status = str(field(job, "status", "")).toUpperCase();
      const completed = Number(field(job, "completed_requests", 0));
      const total = Number(field(job, "total_requests", 0));

      log("INFO", "Batch OCR status=%s (%s/%s)", status, completed, total);

      if (status === "SUCCESS") {
        const markdown = (await this.extractMarkdownFromBatchJob(job)).trim();
        if (markdown) {
          return markdown;
        }
        throw new Error("Batch OCR نجح لكن الناتج كان فارغاً.");
      }

      if (["FAILED", "TIMEOUT_EXCEEDED", "CANCELLED"].includes(status)) {
        const errors = field(job, "errors", []);
        throw new Error(`Batch OCR انتهى بالحالة ${status}. errors=${JSON.stringify(errors)}`);
      }

      if (Date.now() >= deadline) {
        try {
          await this.requestJson("POST", `/batch/jobs/${encodeURIComponent(jobId)}/cancel`);
          log("WARN", "تم إرسال طلب إلغاء لـ Batch OCR job بعد تجاوز المهلة: %s", jobId);
        } catch (cancelError) {
          log("WARN", "تعذر إلغاء Batch OCR job %s بعد انتهاء المهلة: %s", jobId, String(cancelError));
        }
        throw new Error(`انتهت مهلة Batch OCR (${this.config.batchTimeoutSec}s) قبل الاكتمال.`);
      }

      await sleep(pollInterval);
    }
  }

  private async extractMarkdownFromBatchJob(job: unknown): Promise<string> {
    const outputs = field<unknown[]>(job, "outputs", []);
    if (Array.isArray(outputs) && outputs.length > 0) {
      for (const item of outputs) {
        const body = this.extractBatchBody(item);
        if (!body) {
          continue;
        }
        const md = this.extractMarkdownFromResponse(body).trim();
        if (md) {
          return md;
        }
      }
    }

    const outputFileId = str(field(job, "output_file", "") || field(job, "output_file_id", "")).trim();
    if (outputFileId) {
      const text = await this.downloadFileText(outputFileId);
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        let row: unknown;
        try {
          row = JSON.parse(line);
        } catch {
          continue;
        }

        const body = this.extractBatchBody(row);
        if (!body) {
          continue;
        }

        const md = this.extractMarkdownFromResponse(body).trim();
        if (md) {
          return md;
        }
      }
    }

    return "";
  }

  private extractBatchBody(row: unknown): JsonRecord | undefined {
    if (!row || typeof row !== "object") {
      return undefined;
    }

    const responseObj = field(row, "response", null);
    if (responseObj && typeof responseObj === "object") {
      const body = field(responseObj, "body", null);
      if (body && typeof body === "object") {
        return body as JsonRecord;
      }
    }

    const body = field(row, "body", null);
    if (body && typeof body === "object") {
      return body as JsonRecord;
    }

    if (Array.isArray(field(row, "pages", null))) {
      return row as JsonRecord;
    }

    return undefined;
  }

  private async buildCommonRequestKwargs(): Promise<JsonRecord> {
    const kwargs: JsonRecord = {};

    if (this.config.tableFormat) {
      kwargs.table_format = this.config.tableFormat;
    }
    if (this.config.extractHeader) {
      kwargs.extract_header = true;
    }
    if (this.config.extractFooter) {
      kwargs.extract_footer = true;
    }
    if (this.config.includeImageBase64) {
      kwargs.include_image_base64 = true;
    }

    const annotationFormat = await this.buildAnnotationFormat();
    if (annotationFormat) {
      kwargs.document_annotation_format = annotationFormat;
      if (this.config.annotationPrompt) {
        kwargs.document_annotation_prompt = this.config.annotationPrompt;
      }
    }

    return kwargs;
  }

  private async buildAnnotationFormat(): Promise<JsonRecord | undefined> {
    const schema = await this.loadAnnotationSchema();
    if (!schema) {
      return undefined;
    }

    const schemaType = str(field(schema, "type", "")).trim();
    if (["json_schema", "json_object", "text"].includes(schemaType)) {
      return schema;
    }

    return {
      type: "json_schema",
      json_schema: {
        name: "document_annotation",
        schema,
        strict: Boolean(this.config.annotationStrict),
      },
    };
  }

  private async loadAnnotationSchema(): Promise<JsonRecord | undefined> {
    if (!this.config.annotationSchemaPath) {
      return undefined;
    }
    if (this.annotationSchemaCache) {
      return this.annotationSchemaCache;
    }

    if (!(await fileExists(this.config.annotationSchemaPath))) {
      throw new Error(`ملف annotation schema غير موجود: ${this.config.annotationSchemaPath}`);
    }

    const content = await readFile(this.config.annotationSchemaPath, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("ملف annotation schema يجب أن يكون كائن JSON.");
    }

    this.annotationSchemaCache = parsed as JsonRecord;
    return this.annotationSchemaCache;
  }

  private extractMarkdownFromResponse(response: unknown): string {
    this.captureAnnotation(response);

    const pages = field<unknown[]>(response, "pages", []);
    if (!Array.isArray(pages) || pages.length === 0) {
      return "";
    }

    const pageMarkdowns: string[] = [];
    for (const page of pages) {
      const markdown = str(field(page, "markdown", "")).trim();
      if (markdown) {
        pageMarkdowns.push(markdown);
      }
    }

    return pageMarkdowns.join("\n\n").trim();
  }

  private captureAnnotation(response: unknown): void {
    const raw = field<string | object | null>(response, "document_annotation", null);
    if (raw === null || raw === undefined) {
      return;
    }

    if (typeof raw === "string") {
      const stripped = (raw as string).trim();
      if (!stripped) {
        return;
      }
      try {
        this.lastDocumentAnnotation = JSON.parse(stripped);
      } catch {
        this.lastDocumentAnnotation = stripped;
      }
      return;
    }

    this.lastDocumentAnnotation = raw;
  }

  private async getSignedUrl(fileId: string): Promise<string> {
    const attempts: Array<{ method: "GET" | "POST"; endpoint: string; body?: unknown }> = [
      { method: "GET", endpoint: `/files/${encodeURIComponent(fileId)}/url?expiry=24` },
      { method: "GET", endpoint: `/files/${encodeURIComponent(fileId)}/signed-url` },
      { method: "POST", endpoint: `/files/${encodeURIComponent(fileId)}/url`, body: { expiry: 24 } },
      { method: "POST", endpoint: `/files/${encodeURIComponent(fileId)}/signed-url`, body: { expiry: 24 } },
    ];

    for (const a of attempts) {
      try {
        const resp = await this.requestJson(a.method, a.endpoint, a.body);
        const top = str(field(resp, "url", "")).trim();
        if (top) {
          return top;
        }

        const dataObj = field(resp, "data", null);
        if (dataObj && typeof dataObj === "object") {
          const nested = str(field(dataObj, "url", "")).trim();
          if (nested) {
            return nested;
          }
        }
      } catch {
        // continue
      }
    }

    throw new Error("تعذر الحصول على signed URL من Mistral بعد عدة محاولات.");
  }

  private async downloadFileText(fileId: string): Promise<string> {
    const endpoints = [
      `/files/${encodeURIComponent(fileId)}/content`,
      `/files/${encodeURIComponent(fileId)}/download`,
      `/files/${encodeURIComponent(fileId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.requestRaw("GET", endpoint);
        if (!response.ok) {
          continue;
        }
        return await response.text();
      } catch {
        // continue
      }
    }

    return "";
  }

  private async requestJson(method: "GET" | "POST" | "DELETE", endpoint: string, body?: unknown): Promise<JsonRecord> {
    const response = await this.requestRaw(method, endpoint, body);
    const raw = await response.text();

    let data: unknown = {};
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }

    if (!response.ok) {
      throw new Error(`Mistral API error ${response.status} ${response.statusText}: ${raw}`);
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }

    return data as JsonRecord;
  }

  private async requestRaw(method: "GET" | "POST" | "DELETE", endpoint: string, body?: unknown): Promise<Response> {
    const apiKey = getEnvOrRaise("MISTRAL_API_KEY");
    const url = `${MISTRAL_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    let bodyInit: string | FormData | undefined;
    if (body !== undefined) {
      if (body instanceof FormData) {
        bodyInit = body;
      } else {
        headers["Content-Type"] = "application/json";
        bodyInit = JSON.stringify(body);
      }
    }

    return fetch(url, {
      method,
      headers,
      body: bodyInit,
    });
  }
}

// ============================================================================
// Converter
// ============================================================================

export class PDFToTextConverter {
  private readonly config: ConfigManager;
  private readonly normalizer: MarkdownNormalizer;
  private readonly mistralService: MistralOCRService;
  private readonly llmPostProcessor?: LLMPostProcessor;

  constructor(config: ConfigManager) {
    this.config = config;
    this.normalizer = new MarkdownNormalizer(config.normalizerOptions);
    this.mistralService = new MistralOCRService(config.mistral);
    if (config.llm.enabled) {
      this.llmPostProcessor = new LLMPostProcessor(config.llm);
    }
  }

  async extractMarkdown(): Promise<string> {
    if (!(await fileExists(this.config.inputPath))) {
      throw new Error(`الملف غير موجود في المسار المحدد: ${this.config.inputPath}`);
    }

    const ext = path.extname(this.config.inputPath).toLowerCase();
    log("INFO", "بدء المعالجة للملف: %s", this.config.inputPath);

    if (ext === ".md" || ext === ".txt") {
      return readFile(this.config.inputPath, "utf-8");
    }

    if (ext !== ".pdf") {
      throw new Error("صيغة الملف غير مدعومة. الصيغ المقبولة: PDF, MD, TXT");
    }

    return this.processPdf();
  }

  private async processPdf(): Promise<string> {
    if (!this.config.mistral.useDocumentInput) {
      throw new Error("في نسخة TypeScript يجب استخدام OCR المباشر للـ PDF (أزل --mistral-disable-document-input). ");
    }

    try {
      log("INFO", "محاولة OCR مباشر للـ PDF عبر Mistral (document_url)...");
      const markdown = (await this.mistralService.processPdfFile(this.config.inputPath)).trim();
      if (!markdown) {
        throw new Error("OCR المباشر أعاد ناتجاً فارغاً.");
      }
      log("INFO", "نجح OCR المباشر للـ PDF.");
      return ensureTrailingNewline(markdown);
    } catch (error) {
      throw new Error(`فشل OCR المباشر للـ PDF: ${String(error)}`);
    }
  }

  resolveOutputPath(): string {
    if (this.config.outputPath) {
      return this.config.outputPath;
    }

    const ext = path.extname(this.config.inputPath);
    if (ext.toLowerCase() === ".pdf") {
      return this.config.inputPath.slice(0, -ext.length) + ".md";
    }

    const dir = path.dirname(this.config.inputPath);
    const stem = path.basename(this.config.inputPath, ext);
    return path.join(dir, `${stem}.normalized.md`);
  }

  resolveAnnotationOutputPath(outputPath: string): string {
    if (this.config.mistral.annotationOutputPath) {
      return this.config.mistral.annotationOutputPath;
    }

    const ext = path.extname(outputPath);
    const dir = path.dirname(outputPath);
    const stem = path.basename(outputPath, ext);
    return path.join(dir, `${stem}.annotation.json`);
  }

  getDocumentAnnotation(): unknown {
    return this.mistralService.getLastDocumentAnnotation();
  }

  async getNonOverwritingPath(filePath: string): Promise<string> {
    if (!(await fileExists(filePath))) {
      return filePath;
    }

    const ext = path.extname(filePath);
    const dir = path.dirname(filePath);
    const stem = path.basename(filePath, ext);

    let c = 1;
    while (true) {
      const candidate = path.join(dir, `${stem}_${c}${ext}`);
      if (!(await fileExists(candidate))) {
        log("INFO", "الملف %s موجود مسبقاً، سيتم الحفظ باسم: %s", filePath, candidate);
        return candidate;
      }
      c += 1;
    }
  }

  calculateMatchScore(referenceText: string, candidateText: string): number {
    const refLines = referenceText.split(/\r?\n/);
    const candLines = candidateText.split(/\r?\n/);

    const maxLen = Math.max(refLines.length, candLines.length);
    if (maxLen === 0) {
      return 100;
    }

    let eq = 0;
    for (let i = 0; i < maxLen; i += 1) {
      if ((refLines[i] ?? "") === (candLines[i] ?? "")) {
        eq += 1;
      }
    }

    return Math.round((eq / maxLen) * 1000000) / 10000;
  }

  generateDiffPreview(referenceText: string, candidateText: string, maxLines: number): string {
    const refLines = referenceText.split(/\r?\n/);
    const candLines = candidateText.split(/\r?\n/);
    const max = Math.max(refLines.length, candLines.length);

    const out: string[] = [];
    for (let i = 0; i < max; i += 1) {
      const r = refLines[i] ?? "";
      const c = candLines[i] ?? "";
      if (r === c) {
        continue;
      }
      out.push(`@@ line ${i + 1} @@`);
      out.push(`- ${r}`);
      out.push(`+ ${c}`);
      if (out.length >= maxLines) {
        break;
      }
    }

    return out.length > 0 ? out.slice(0, maxLines).join("\n") : "N/A";
  }

  async runLlmRefinement(initialMarkdown: string): Promise<string> {
    if (!this.llmPostProcessor) {
      return initialMarkdown;
    }

    let referenceText = await this.llmPostProcessor.getReferenceText();
    if (referenceText && this.config.normalizeOutput) {
      referenceText = this.normalizer.normalize(referenceText);
    }

    if (!referenceText) {
      log("INFO", "لا يوجد مرجع نصي؛ سيتم تنفيذ تمرير LLM واحد فقط.");
      let result = await this.llmPostProcessor.postprocess(initialMarkdown);
      if (this.config.normalizeOutput) {
        result = this.normalizer.normalize(result);
      }
      return result;
    }

    let best = initialMarkdown;
    let bestScore = this.calculateMatchScore(referenceText, best);
    log("INFO", "نسبة التطابق قبل LLM: %.2f%%", bestScore);

    let current = initialMarkdown;
    const rounds = this.config.llm.iterative ? this.config.llm.maxIterations : 1;

    for (let i = 1; i <= rounds; i += 1) {
      if (bestScore >= this.config.llm.targetMatch) {
        log("INFO", "تم الوصول للنسبة المستهدفة %.2f%% قبل الجولة %s.", this.config.llm.targetMatch, i);
        break;
      }

      const preview = this.generateDiffPreview(referenceText, current, this.config.llm.diffPreviewLines);
      const feedback = [
        `Current best match: ${bestScore.toFixed(2)}%. Target: ${this.config.llm.targetMatch.toFixed(2)}%.`,
        "Focus only on lines that differ from reference and avoid changing already matching lines.",
        `Diff preview:\n${preview}`,
      ].join("\n");

      let candidate = await this.llmPostProcessor.postprocess(current, referenceText, feedback);
      if (this.config.normalizeOutput) {
        candidate = this.normalizer.normalize(candidate);
      }

      const score = this.calculateMatchScore(referenceText, candidate);
      log("INFO", "جولة LLM %s/%s -> نسبة التطابق: %.2f%%", i, rounds, score);

      current = candidate;
      if (score >= bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    log("INFO", "أفضل نسبة تطابق بعد التحسين التكراري: %.2f%%", bestScore);
    return best;
  }

  async convert(): Promise<{ rawMarkdown: string; finalMarkdown: string }> {
    const rawMarkdown = await this.extractMarkdown();
    let finalMarkdown = rawMarkdown;

    if (this.config.normalizeOutput) {
      finalMarkdown = this.normalizer.normalize(rawMarkdown);
      log("INFO", "اكتمل التطبيع: حجم النص قبل=%s حرف، بعد=%s حرف.", rawMarkdown.length, finalMarkdown.length);
    } else {
      log("INFO", "تم الاستخراج بدون تطبيع بناءً على الإعدادات.");
    }

    if (this.config.llm.enabled && this.llmPostProcessor) {
      log("INFO", "بدء تمرير طبقة LLM لتحسين التطابق...");
      try {
        finalMarkdown = await this.runLlmRefinement(finalMarkdown);
        log("INFO", "اكتملت طبقة LLM بنجاح.");
      } catch (error) {
        if (this.config.llm.strict) {
          throw error;
        }
        log("WARN", "فشلت طبقة LLM وسيتم المتابعة بالنص الحالي: %s", String(error));
      }
    }

    return { rawMarkdown, finalMarkdown };
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  if (isTruthy(process.env.FORCE_CPU_ONLY ?? "")) {
    process.env.CUDA_VISIBLE_DEVICES = "-1";
  }

  const envPath = path.join(process.cwd(), ".env");
  await loadEnvFile(envPath);

  const config = buildConfig(process.argv.slice(2));
  const converter = new PDFToTextConverter(config);

  try {
    const { rawMarkdown, finalMarkdown } = await converter.convert();
    log("INFO", "العملية مكتملة. تم استخراج نص يحتوي على %s حرف.", finalMarkdown.length);

    const outputPath = await converter.getNonOverwritingPath(converter.resolveOutputPath());

    if (config.saveRawMarkdown && rawMarkdown !== finalMarkdown) {
      const ext = path.extname(outputPath);
      const stem = path.basename(outputPath, ext);
      const dir = path.dirname(outputPath);
      const rawPath = await converter.getNonOverwritingPath(path.join(dir, `${stem}.raw.md`));
      await writeFile(rawPath, rawMarkdown, "utf-8");
      log("INFO", "تم حفظ النسخة الخام في: %s", rawPath);
    }

    await writeFile(outputPath, finalMarkdown, "utf-8");
    log("INFO", "تم حفظ النص المستخرج في: %s", outputPath);

    const annotation = converter.getDocumentAnnotation();
    if (annotation !== undefined && annotation !== null) {
      const annotationPath = await converter.getNonOverwritingPath(converter.resolveAnnotationOutputPath(outputPath));
      await writeFile(annotationPath, `${JSON.stringify(annotation, null, 2)}\n`, "utf-8");
      log("INFO", "تم حفظ document annotation في: %s", annotationPath);
    }

    log("INFO", "تمت المعالجة بنجاح.");
  } catch (error) {
    log("CRITICAL", "فشل البرنامج في إكمال المهمة المطلوبة بسبب الخطأ: %s", String(error));
    process.exitCode = 1;
  }
}

// Only run main() if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

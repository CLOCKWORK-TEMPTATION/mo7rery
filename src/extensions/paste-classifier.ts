import { Extension } from "@tiptap/core";
import { Fragment, Node as PmNode, Schema, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { isActionLine } from "./action";
import {
  MODEL_ID as AGENT_MODEL_ID,
  parseReviewCommands,
} from "./Arabic-Screenplay-Classifier-Agent";
import {
  DATE_PATTERNS,
  TIME_PATTERNS,
  convertHindiToArabic,
  detectDialect,
} from "./arabic-patterns";
import { isBasmalaLine } from "./basmala";
import {
  ensureCharacterTrailingColon,
  isCharacterLine,
  parseImplicitCharacterDialogueWithoutColon,
  parseInlineCharacterDialogue,
} from "./character";
import { resolveNarrativeDecision } from "./classification-decision";
import { PostClassificationReviewer } from "./classification-core";
import type {
  ClassifiedDraft,
  ClassificationContext,
  ClassifiedLine,
  ClassificationSourceProfile,
  ElementType,
  LLMReviewPacket,
  SuspiciousLine,
} from "./classification-types";
import { fromLegacyElementType, isElementType } from "./classification-types";
import { ContextMemoryManager } from "./context-memory-manager";
import {
  getDialogueProbability,
  isDialogueContinuationLine,
  isDialogueLine,
} from "./dialogue";
import { HybridClassifier } from "./hybrid-classifier";
import {
  mergeBrokenCharacterName,
  parseBulletLine,
  shouldMergeWrappedLines,
} from "./line-repair";
import { isParentheticalLine } from "./parenthetical";
import { isSceneHeader3Line } from "./scene-header-3";
import {
  isCompleteSceneHeaderLine,
  splitSceneHeaderLine,
} from "./scene-header-top-line";
import { isTransitionLine } from "./transition";
import { logger } from "../utils/logger";
import type {
  AgentReviewRequestPayload,
  AgentReviewResponsePayload,
  AgentCommand,
  AgentReviewResponseMeta,
  LineType,
} from "../types";
import {
  computeFingerprintSync,
  createImportOperationState,
  checkResponseValidity,
  normalizeAndDedupeCommands,
  prepareItemForPacket,
  buildPacketWithBudget,
  DEFAULT_PACKET_BUDGET,
} from "../pipeline";
import type { ItemSnapshot } from "../pipeline";
import {
  logAgentResponse,
  logCommandApply,
  logAgentError,
  telemetry as pipelineTelemetry,
} from "../pipeline/telemetry";
/** رقم نسخة Command API — v2 */
const COMMAND_API_VERSION = "2.0" as const;

/** نمط التصنيف: Backend review required قبل تطبيق الإدراج */
const CLASSIFICATION_MODE = "auto-apply" as const;

const AGENT_REVIEW_MODEL = AGENT_MODEL_ID;
const AGENT_REVIEW_DEADLINE_MS = 25_000;
const AGENT_REVIEW_MAX_ATTEMPTS = 2;
const AGENT_REVIEW_MAX_RATIO = 0.18;
const AGENT_REVIEW_MIN_TIMEOUT_MS = 1_500;
const AGENT_REVIEW_MAX_TIMEOUT_MS = 12_000;
const AGENT_REVIEW_RETRY_DELAY_MS = 450;

export const PASTE_CLASSIFIER_ERROR_EVENT = "paste-classifier:error";

const agentReviewLogger = logger.createScope("paste.agent-review");

/** واجهة محلية توسع ClassifiedDraft بـ _itemId (معرف فريد لكل عنصر) */
interface ClassifiedDraftWithId extends ClassifiedDraft {
  _itemId?: string;
}

const normalizeEndpoint = (endpoint: string): string =>
  endpoint.replace(/\/$/, "");

const resolveAgentReviewEndpoint = (): string => {
  const explicit = (
    import.meta.env.VITE_AGENT_REVIEW_BACKEND_URL as string | undefined
  )?.trim();
  if (explicit) return normalizeEndpoint(explicit);

  const fileImportEndpoint =
    (
      import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined
    )?.trim() ||
    (import.meta.env.DEV ? "http://127.0.0.1:8787/api/file-extract" : "");
  if (!fileImportEndpoint) return "";

  const normalized = normalizeEndpoint(fileImportEndpoint);
  if (normalized.endsWith("/api/file-extract")) {
    return `${normalized.slice(0, -"/api/file-extract".length)}/api/agent/review`;
  }

  return `${normalized}/api/agent/review`;
};

const AGENT_REVIEW_ENDPOINT = resolveAgentReviewEndpoint();
const REVIEWABLE_AGENT_TYPES = new Set<LineType>([
  "action",
  "dialogue",
  "character",
  "scene-header-top-line",
  "scene-header-3",
  "transition",
  "parenthetical",
  "basmala",
]);
const VALID_AGENT_DECISION_TYPES = new Set<LineType>([
  ...REVIEWABLE_AGENT_TYPES,
  "scene-header-1",
  "scene-header-2",
]);

let pendingAgentAbortController: AbortController | null = null;

/**
 * خيارات مصنّف اللصق التلقائي.
 */
export interface PasteClassifierOptions {
  /** دالة مراجعة محلية مخصصة (اختياري) */
  agentReview?: (
    classified: readonly ClassifiedDraftWithId[]
  ) => ClassifiedDraftWithId[];
}

/**
 * خيارات تطبيق تدفق التصنيف على العرض.
 */
export interface ApplyPasteClassifierFlowOptions {
  /** دالة مراجعة محلية مخصصة (اختياري) */
  agentReview?: (
    classified: readonly ClassifiedDraftWithId[]
  ) => ClassifiedDraftWithId[];
  /** موضع البدء في العرض (اختياري) */
  from?: number;
  /** موضع النهاية في العرض (اختياري) */
  to?: number;
  /** بروفايل مصدر التصنيف (paste | generic-open) */
  classificationProfile?: string; // ClassificationSourceProfile in classification-types
  /** نوع الملف المصدر (اختياري) */
  sourceFileType?: string;
  /** طريقة الاستخراج (اختياري) */
  sourceMethod?: string;
  /** تلميحات بنيوية من المصدر (Filmlane، PDF، إلخ) */
  structuredHints?: readonly unknown[]; // ScreenplayBlock[]
}

export interface ClassifyLinesContext {
  classificationProfile?: string;
  sourceFileType?: string;
  sourceMethod?: string;
  structuredHints?: readonly unknown[];
}

const buildContext = (
  previousTypes: readonly ElementType[]
): ClassificationContext => {
  const previousType =
    previousTypes.length > 0 ? previousTypes[previousTypes.length - 1] : null;
  const isInDialogueBlock =
    previousType === "character" ||
    previousType === "dialogue" ||
    previousType === "parenthetical";

  return {
    previousTypes,
    previousType,
    isInDialogueBlock,
    isAfterSceneHeaderTopLine: previousType === "sceneHeaderTopLine",
  };
};

const hasTemporalSceneSignal = (text: string): boolean =>
  DATE_PATTERNS.test(text) || TIME_PATTERNS.test(text);

interface StructuredHintLike {
  formatId?: unknown;
  text?: unknown;
}

const normalizeHintLookupText = (value: string): string => {
  const bulletNormalized = parseBulletLine(value) ?? value;
  return convertHindiToArabic(bulletNormalized).replace(/\s+/g, " ").trim();
};

const toSourceProfile = (
  value: string | undefined
): ClassificationSourceProfile | undefined => {
  if (value === "paste" || value === "generic-open") {
    return value;
  }
  return undefined;
};

const toHintElementType = (formatId: unknown): ElementType | null => {
  if (typeof formatId !== "string") return null;
  return fromLegacyElementType(formatId);
};

const buildStructuredHintQueues = (
  structuredHints: readonly unknown[] | undefined
): Map<string, ElementType[]> => {
  const queues = new Map<string, ElementType[]>();
  if (!structuredHints || structuredHints.length === 0) return queues;

  for (const hintEntry of structuredHints) {
    if (!hintEntry || typeof hintEntry !== "object") continue;
    const hint = hintEntry as StructuredHintLike;
    const hintType = toHintElementType(hint.formatId);
    if (!hintType || typeof hint.text !== "string") continue;

    const hintLines = hint.text
      .split(/\r?\n/)
      .map((line) => normalizeHintLookupText(line))
      .filter((line) => line.length > 0);

    for (const line of hintLines) {
      const queue = queues.get(line);
      if (queue) {
        queue.push(hintType);
      } else {
        queues.set(line, [hintType]);
      }
    }
  }

  return queues;
};

const consumeSourceHintTypeForLine = (
  lineText: string,
  hintQueues: Map<string, ElementType[]>
): ElementType | undefined => {
  const normalized = normalizeHintLookupText(lineText);
  if (!normalized) return undefined;

  const queue = hintQueues.get(normalized);
  if (!queue || queue.length === 0) return undefined;

  const hintType = queue.shift();
  if (queue.length === 0) {
    hintQueues.delete(normalized);
  }

  return hintType;
};

/**
 * تصنيف النصوص المُلصقة محلياً مع توليد معرف فريد (_itemId) لكل عنصر.
 * المعرّف يُستخدم لاحقاً في تتبع الأوامر من الوكيل.
 */
export const classifyLines = (
  text: string,
  context?: ClassifyLinesContext
): ClassifiedDraftWithId[] => {
  const lines = text.split(/\r?\n/);
  const classified: ClassifiedDraftWithId[] = [];

  const memoryManager = new ContextMemoryManager();
  const hybridClassifier = new HybridClassifier();

  // استخراج الخيارات من السياق
  const sourceProfile = toSourceProfile(context?.classificationProfile);
  const hintQueues = buildStructuredHintQueues(context?.structuredHints);
  let activeSourceHintType: ElementType | undefined;

  const push = (entry: ClassifiedDraft): void => {
    const withId: ClassifiedDraftWithId = {
      ...entry,
      _itemId: crypto.randomUUID(),
      // إضافة بيانات المصدر إذا كانت متوفرة
      sourceProfile,
      sourceHintType: activeSourceHintType,
    };
    classified.push(withId);
    memoryManager.record(entry);
  };

  for (const rawLine of lines) {
    const trimmed = parseBulletLine(rawLine);
    if (!trimmed) continue;
    activeSourceHintType = consumeSourceHintTypeForLine(trimmed, hintQueues);
    const normalizedForClassification = convertHindiToArabic(trimmed);
    const detectedDialect = detectDialect(normalizedForClassification);

    const previous = classified[classified.length - 1];
    if (previous) {
      const mergedCharacter = mergeBrokenCharacterName(previous.text, trimmed);
      if (mergedCharacter && previous.type === "action") {
        const corrected: ClassifiedDraft = {
          ...previous,
          type: "character",
          text: ensureCharacterTrailingColon(mergedCharacter),
          confidence: 92,
          classificationMethod: "context",
        };
        classified[classified.length - 1] = corrected;
        memoryManager.replaceLast(corrected);
        continue;
      }

      if (shouldMergeWrappedLines(previous.text, trimmed, previous.type)) {
        const merged: ClassifiedDraft = {
          ...previous,
          text: `${previous.text} ${trimmed}`.replace(/\s+/g, " ").trim(),
          confidence: Math.max(previous.confidence, 86),
          classificationMethod: "context",
        };
        classified[classified.length - 1] = merged;
        memoryManager.replaceLast(merged);
        continue;
      }
    }

    const context = buildContext(classified.map((item) => item.type));

    if (isBasmalaLine(normalizedForClassification)) {
      push({
        type: "basmala",
        text: trimmed,
        confidence: 99,
        classificationMethod: "regex",
      });
      continue;
    }

    if (isCompleteSceneHeaderLine(normalizedForClassification)) {
      const parts = splitSceneHeaderLine(normalizedForClassification);
      if (parts) {
        push({
          type: "sceneHeaderTopLine",
          text: trimmed,
          header1: parts.header1,
          header2: parts.header2,
          confidence: 96,
          classificationMethod: "regex",
        });
        continue;
      }
    }

    if (isTransitionLine(normalizedForClassification)) {
      push({
        type: "transition",
        text: trimmed,
        confidence: 95,
        classificationMethod: "regex",
      });
      continue;
    }

    const temporalSceneSignal = hasTemporalSceneSignal(
      normalizedForClassification
    );
    if (
      context.isAfterSceneHeaderTopLine &&
      (isSceneHeader3Line(normalizedForClassification, context) ||
        temporalSceneSignal)
    ) {
      push({
        type: "sceneHeader3",
        text: trimmed,
        confidence: temporalSceneSignal ? 88 : 90,
        classificationMethod: "context",
      });
      continue;
    }

    const inlineParsed = parseInlineCharacterDialogue(trimmed);
    if (inlineParsed) {
      if (inlineParsed.cue) {
        push({
          type: "action",
          text: inlineParsed.cue,
          confidence: 92,
          classificationMethod: "regex",
        });
      }

      push({
        type: "character",
        text: ensureCharacterTrailingColon(inlineParsed.characterName),
        confidence: 98,
        classificationMethod: "regex",
      });

      push({
        type: "dialogue",
        text: inlineParsed.dialogueText,
        confidence: 98,
        classificationMethod: "regex",
      });
      continue;
    }

    if (
      isParentheticalLine(normalizedForClassification) &&
      context.isInDialogueBlock
    ) {
      push({
        type: "parenthetical",
        text: trimmed,
        confidence: 90,
        classificationMethod: "regex",
      });
      continue;
    }

    if (isDialogueContinuationLine(rawLine, context.previousType)) {
      push({
        type: "dialogue",
        text: trimmed,
        confidence: 82,
        classificationMethod: "context",
      });
      continue;
    }

    const implicit = parseImplicitCharacterDialogueWithoutColon(
      trimmed,
      context
    );
    if (implicit) {
      if (implicit.cue) {
        push({
          type: "action",
          text: implicit.cue,
          confidence: 85,
          classificationMethod: "context",
        });
      }

      push({
        type: "character",
        text: ensureCharacterTrailingColon(implicit.characterName),
        confidence: 78,
        classificationMethod: "context",
      });

      push({
        type: "dialogue",
        text: implicit.dialogueText,
        confidence: 78,
        classificationMethod: "context",
      });
      continue;
    }

    if (isCharacterLine(normalizedForClassification, context)) {
      push({
        type: "character",
        text: ensureCharacterTrailingColon(trimmed),
        confidence: 88,
        classificationMethod: "regex",
      });
      continue;
    }

    const dialogueProbability = getDialogueProbability(
      normalizedForClassification,
      context
    );
    const dialogueThreshold = detectedDialect ? 5 : 6;
    if (
      isDialogueLine(normalizedForClassification, context) ||
      dialogueProbability >= dialogueThreshold
    ) {
      const dialectBoost = detectedDialect ? 3 : 0;
      push({
        type: "dialogue",
        text: trimmed,
        confidence: Math.max(
          72,
          Math.min(94, 64 + dialogueProbability * 4 + dialectBoost)
        ),
        classificationMethod: "context",
      });
      continue;
    }

    if (isSceneHeader3Line(normalizedForClassification, context)) {
      push({
        type: "sceneHeader3",
        text: trimmed,
        confidence: 80,
        classificationMethod: "context",
      });
      continue;
    }

    const decision = resolveNarrativeDecision(
      normalizedForClassification,
      context
    );
    const hybridResult = hybridClassifier.classifyLine(
      normalizedForClassification,
      decision.type,
      context,
      memoryManager.getSnapshot()
    );

    if (hybridResult.type === "sceneHeaderTopLine") {
      const parts = splitSceneHeaderLine(normalizedForClassification);
      if (parts && parts.header2) {
        push({
          type: "sceneHeaderTopLine",
          text: trimmed,
          header1: parts.header1,
          header2: parts.header2,
          confidence: Math.max(85, hybridResult.confidence),
          classificationMethod: hybridResult.classificationMethod,
        });
        continue;
      }
    }

    if (hybridResult.type === "character") {
      push({
        type: "character",
        text: ensureCharacterTrailingColon(trimmed),
        confidence: Math.max(78, hybridResult.confidence),
        classificationMethod: hybridResult.classificationMethod,
      });
      continue;
    }

    if (
      hybridResult.type === "action" ||
      isActionLine(normalizedForClassification, context)
    ) {
      push({
        type: "action",
        text: trimmed.replace(/^[-–—]\s*/, ""),
        confidence: Math.max(74, hybridResult.confidence),
        classificationMethod: hybridResult.classificationMethod,
      });
      continue;
    }

    push({
      type: hybridResult.type,
      text: trimmed,
      confidence: Math.max(68, hybridResult.confidence),
      classificationMethod: hybridResult.classificationMethod,
    });
  }

  return classified;
};

const elementTypeToLineType = (type: ElementType): LineType => {
  switch (type) {
    case "sceneHeaderTopLine":
      return "scene-header-top-line";
    case "sceneHeader3":
      return "scene-header-3";
    default:
      return type;
  }
};

const lineTypeToElementType = (type: LineType): ElementType | null => {
  switch (type) {
    case "scene-header-top-line":
      return "sceneHeaderTopLine";
    case "scene-header-3":
      return "sceneHeader3";
    case "action":
    case "dialogue":
    case "character":
    case "transition":
    case "parenthetical":
    case "basmala":
      return type;
    default:
      return null;
  }
};

const toClassifiedLineRecords = (
  classified: ClassifiedDraft[]
): ClassifiedLine[] =>
  classified.map((item, index) => ({
    lineIndex: index,
    text: item.text,
    assignedType: item.type,
    originalConfidence: item.confidence,
    classificationMethod: item.classificationMethod,
    sourceHintType: item.sourceHintType,
    sourceProfile: item.sourceProfile,
  }));

interface ReviewRoutingStats {
  countPass: number;
  countLocalReview: number;
  countAgentCandidate: number;
  countAgentForced: number;
}

const EMBEDDED_NARRATIVE_SUSPICION_FLOOR = 96;

const promoteHighSeverityMismatches = (
  suspiciousLines: readonly SuspiciousLine[]
): SuspiciousLine[] =>
  suspiciousLines.map((suspicious) => {
    if (
      suspicious.routingBand === "agent-candidate" &&
      suspicious.findings.some(
        (f) =>
          f.detectorId === "content-type-mismatch" &&
          f.suspicionScore >= EMBEDDED_NARRATIVE_SUSPICION_FLOOR
      )
    ) {
      return {
        ...suspicious,
        routingBand: "agent-forced" as const,
        escalationScore: Math.max(suspicious.escalationScore, 90),
      };
    }
    return suspicious;
  });

const summarizeRoutingStats = (
  totalReviewed: number,
  suspiciousLines: readonly SuspiciousLine[]
): ReviewRoutingStats => {
  const stats: ReviewRoutingStats = {
    countPass: Math.max(0, totalReviewed - suspiciousLines.length),
    countLocalReview: 0,
    countAgentCandidate: 0,
    countAgentForced: 0,
  };

  for (const line of suspiciousLines) {
    if (line.routingBand === "local-review") {
      stats.countLocalReview += 1;
      continue;
    }
    if (line.routingBand === "agent-candidate") {
      stats.countAgentCandidate += 1;
      continue;
    }
    if (line.routingBand === "agent-forced") {
      stats.countAgentForced += 1;
    }
  }

  return stats;
};

const shouldEscalateToAgent = (suspicious: SuspiciousLine): boolean => {
  if (suspicious.routingBand === "agent-forced") return true;
  if (suspicious.routingBand !== "agent-candidate") return false;
  return suspicious.criticalMismatch || suspicious.distinctDetectors >= 2;
};

export const selectSuspiciousLinesForAgent = (
  packet: LLMReviewPacket
): SuspiciousLine[] => {
  const forced = packet.suspiciousLines
    .filter((line) => line.routingBand === "agent-forced")
    .sort((a, b) => b.escalationScore - a.escalationScore);

  const candidates = packet.suspiciousLines
    .filter(
      (line) =>
        line.routingBand === "agent-candidate" && shouldEscalateToAgent(line)
    )
    .sort((a, b) => b.escalationScore - a.escalationScore);

  if (forced.length === 0 && candidates.length === 0) return [];

  const maxToAgent = Math.max(
    1,
    Math.ceil(packet.totalReviewed * AGENT_REVIEW_MAX_RATIO)
  );
  if (forced.length >= maxToAgent) {
    return forced;
  }

  const remainingSlots = Math.max(0, maxToAgent - forced.length);
  return [...forced, ...candidates.slice(0, remainingSlots)];
};

const shouldSkipAgentReviewInRuntime = (): boolean => {
  if (typeof window === "undefined") return true;
  return false;
};

const waitBeforeRetry = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isRetryableHttpStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const toUniqueSortedIndexes = (values: readonly number[]): number[] =>
  [
    ...new Set(values.filter((value) => Number.isInteger(value) && value >= 0)),
  ].sort((a, b) => a - b);

/**
 * تحويل معرّفات الأوامر (UUIDs) إلى مصفوفة مرتبة فريدة.
 */
const toNormalizedMetaIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0
          )
        ),
      ].sort()
    : [];

/**
 * تحويل استجابة الوكيل إلى بيانات وصفية معتمدة (Command API v2).
 * يتعامل مع:
 * - commandCount (بدل decisionCount)
 * - missingItemIds (بدل missingItemIndexes)
 * - forcedItemIds (بدل forcedItemIndexes)
 * - unresolvedForcedItemIds (بدل unresolvedForcedItemIndexes)
 */
const toValidAgentReviewMeta = (
  raw: unknown
): AgentReviewResponseMeta | undefined => {
  if (!raw || typeof raw !== "object") return undefined;

  const record = raw as {
    requestedCount?: unknown;
    commandCount?: unknown;
    missingItemIds?: unknown;
    forcedItemIds?: unknown;
    unresolvedForcedItemIds?: unknown;
  };

  const requestedCount =
    typeof record.requestedCount === "number" &&
    Number.isFinite(record.requestedCount)
      ? Math.max(0, Math.trunc(record.requestedCount))
      : 0;

  const commandCount =
    typeof record.commandCount === "number" &&
    Number.isFinite(record.commandCount)
      ? Math.max(0, Math.trunc(record.commandCount))
      : 0;

  return {
    requestedCount,
    commandCount,
    missingItemIds: toNormalizedMetaIds(record.missingItemIds),
    forcedItemIds: toNormalizedMetaIds(record.forcedItemIds),
    unresolvedForcedItemIds: toNormalizedMetaIds(
      record.unresolvedForcedItemIds
    ),
  };
};

/**
 * تحويل استجابة الوكيل إلى أوامر معتمدة (Command API v2).
 * يتعامل مع نوعي الأوامر:
 * - relabel: إعادة تصنيف عنصر (itemId → newType)
 * - split: تقسيم عنصر إلى عنصرين (itemId → leftType + rightType)
 */
const toValidAgentCommands = (raw: unknown): AgentCommand[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      const opRaw = (entry as { op?: unknown }).op;
      const itemIdRaw = (entry as { itemId?: unknown }).itemId;
      const confidenceRaw = (entry as { confidence?: unknown }).confidence;
      const reasonRaw = (entry as { reason?: unknown }).reason;

      // التحقق من الحقول المشتركة
      if (typeof itemIdRaw !== "string" || !itemIdRaw.trim()) return null;
      const itemId = itemIdRaw.trim();

      const confidence =
        typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)
          ? Math.max(0, Math.min(1, confidenceRaw))
          : 0.85;

      const reason =
        typeof reasonRaw === "string" && reasonRaw.trim()
          ? reasonRaw.trim()
          : "أمر بدون سبب مفصل";

      // معالجة أوامر relabel
      if (opRaw === "relabel") {
        const newTypeRaw = (entry as { newType?: unknown }).newType;
        if (typeof newTypeRaw !== "string") return null;
        if (!VALID_AGENT_DECISION_TYPES.has(newTypeRaw as LineType))
          return null;

        return {
          op: "relabel" as const,
          itemId,
          newType: newTypeRaw as LineType,
          confidence,
          reason,
        };
      }

      // معالجة أوامر split
      if (opRaw === "split") {
        const splitAtRaw = (entry as { splitAt?: unknown }).splitAt;
        const leftTypeRaw = (entry as { leftType?: unknown }).leftType;
        const rightTypeRaw = (entry as { rightType?: unknown }).rightType;

        if (
          typeof splitAtRaw !== "number" ||
          !Number.isInteger(splitAtRaw) ||
          splitAtRaw <= 0
        )
          return null;
        if (typeof leftTypeRaw !== "string") return null;
        if (typeof rightTypeRaw !== "string") return null;

        if (!VALID_AGENT_DECISION_TYPES.has(leftTypeRaw as LineType))
          return null;
        if (!VALID_AGENT_DECISION_TYPES.has(rightTypeRaw as LineType))
          return null;

        return {
          op: "split" as const,
          itemId,
          splitAt: Number(splitAtRaw),
          leftType: leftTypeRaw as LineType,
          rightType: rightTypeRaw as LineType,
          confidence,
          reason,
        };
      }

      return null;
    })
    .filter((entry): entry is AgentCommand => entry !== null);
};

/**
 * تحويل استجابة الوكيل إلى بنية معتمدة (Command API v2).
 * يدعم:
 * - commands (بدل decisions)
 * - importOpId, requestId, apiVersion, mode
 * - status جديد: "applied" | "partial" | "skipped" | "error"
 *   (لم يعد هناك "warning")
 */
const normalizeAgentReviewPayload = (
  payload: unknown,
  fallbackText?: string
): AgentReviewResponsePayload => {
  if (!payload || typeof payload !== "object") {
    const parsedFallback = fallbackText
      ? parseReviewCommands(fallbackText)
      : [];
    return {
      status: parsedFallback.length > 0 ? "applied" : "skipped",
      model: AGENT_REVIEW_MODEL,
      commands: parsedFallback,
      message:
        parsedFallback.length > 0
          ? "تم التطبيق من تحليل نص الاستجابة (fallback)."
          : "بيانات استجابة فارغة أو غير صالحة.",
      latencyMs: 0,
      importOpId: crypto.randomUUID(),
      requestId: "",
      apiVersion: COMMAND_API_VERSION,
      mode: CLASSIFICATION_MODE,
      meta: undefined,
    };
  }

  const record = payload as {
    message?: unknown;
    status?: unknown;
    model?: unknown;
    commands?: unknown;
    latencyMs?: unknown;
    importOpId?: unknown;
    requestId?: unknown;
    apiVersion?: unknown;
    mode?: unknown;
    meta?: unknown;
  };

  // التحقق من الـ status وتحويل warning → partial
  let status: "applied" | "partial" | "skipped" | "error" = "error";
  if (
    record.status === "applied" ||
    record.status === "partial" ||
    record.status === "skipped" ||
    record.status === "error"
  ) {
    status = record.status;
  } else if (record.status === "warning") {
    // التحويل التلقائي من warning إلى partial
    status = "partial";
  }

  const directCommands = toValidAgentCommands(record.commands);
  const textCandidates = [
    typeof record.message === "string" ? record.message : "",
    fallbackText ?? "",
  ].filter(Boolean);

  let parsedCommands = directCommands;
  if (parsedCommands.length === 0) {
    for (const candidate of textCandidates) {
      const parsed = parseReviewCommands(candidate);
      if (parsed.length > 0) {
        parsedCommands = parsed;
        break;
      }
    }
  }

  // إذا كان لدينا أوامر لكن الـ status خطأ، غيّره إلى applied
  const normalizedStatus: "applied" | "partial" | "skipped" | "error" =
    parsedCommands.length > 0 && status === "error" ? "applied" : status;

  return {
    status: normalizedStatus,
    model:
      typeof record.model === "string" && record.model.trim()
        ? record.model.trim()
        : AGENT_REVIEW_MODEL,
    commands: parsedCommands,
    message:
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : normalizedStatus === "applied"
          ? "تم تطبيق أوامر الوكيل."
          : "لم يتم إرجاع أوامر قابلة للتطبيق من الوكيل.",
    latencyMs:
      typeof record.latencyMs === "number" && Number.isFinite(record.latencyMs)
        ? record.latencyMs
        : 0,
    importOpId:
      typeof record.importOpId === "string" && record.importOpId.trim()
        ? record.importOpId.trim()
        : crypto.randomUUID(),
    requestId:
      typeof record.requestId === "string" ? record.requestId.trim() : "",
    apiVersion:
      typeof record.apiVersion === "string" &&
      record.apiVersion.trim() === "2.0"
        ? "2.0"
        : COMMAND_API_VERSION,
    mode:
      typeof record.mode === "string" && record.mode.trim() === "auto-apply"
        ? "auto-apply"
        : CLASSIFICATION_MODE,
    meta: toValidAgentReviewMeta(record.meta),
  };
};

/**
 * إرسال طلب مراجعة إلى الوكيل عبر HTTP.
 * يدعم إعادة المحاولة المقتولة بالمهلة الزمنية والتعامل مع الأخطاء الشبكية.
 */
const requestAgentReview = async (
  request: AgentReviewRequestPayload
): Promise<AgentReviewResponsePayload> => {
  if (shouldSkipAgentReviewInRuntime()) {
    agentReviewLogger.error("request-runtime-not-supported", {
      sessionId: request.sessionId,
    });
    throw new Error(
      "Agent review backend path is mandatory and requires a browser runtime."
    );
  }

  if (!AGENT_REVIEW_ENDPOINT) {
    agentReviewLogger.error("request-missing-endpoint", {
      sessionId: request.sessionId,
    });
    throw new Error(
      "VITE_FILE_IMPORT_BACKEND_URL غير مضبوط؛ لا يمكن تشغيل Agent Review."
    );
  }

  let lastError: unknown = null;
  const startedAt = Date.now();
  const deadlineAt = startedAt + AGENT_REVIEW_DEADLINE_MS;

  for (let attempt = 1; attempt <= AGENT_REVIEW_MAX_ATTEMPTS; attempt += 1) {
    const remainingBeforeAttempt = deadlineAt - Date.now();
    if (remainingBeforeAttempt <= 0) {
      throw new Error(
        `Agent review exceeded deadline (${AGENT_REVIEW_DEADLINE_MS}ms).`
      );
    }

    if (pendingAgentAbortController) {
      pendingAgentAbortController.abort();
    }
    const controller = new AbortController();
    pendingAgentAbortController = controller;
    const timeoutForAttempt = Math.min(
      AGENT_REVIEW_MAX_TIMEOUT_MS,
      Math.max(AGENT_REVIEW_MIN_TIMEOUT_MS, remainingBeforeAttempt - 200)
    );
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      timeoutForAttempt
    );

    try {
      const response = await fetch(AGENT_REVIEW_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const isRetryable = isRetryableHttpStatus(response.status);
        agentReviewLogger.error("request-http-error", {
          sessionId: request.sessionId,
          status: response.status,
          body,
          attempt,
          isRetryable,
        });
        if (isRetryable && attempt < AGENT_REVIEW_MAX_ATTEMPTS) {
          await waitBeforeRetry(AGENT_REVIEW_RETRY_DELAY_MS * attempt);
          continue;
        }
        throw new Error(
          `Agent review route failed (${response.status}): ${body}`
        );
      }

      const responseText = await response.text();
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(responseText);
      } catch {
        parsedPayload = responseText;
      }
      const payload = normalizeAgentReviewPayload(parsedPayload, responseText);
      agentReviewLogger.telemetry("request-response", {
        sessionId: request.sessionId,
        status: payload.status,
        commands: payload.commands?.length ?? 0,
        model: payload.model,
        latencyMs: payload.latencyMs,
        apiVersion: payload.apiVersion,
        mode: payload.mode,
        requestedCount: payload.meta?.requestedCount ?? 0,
        commandCount: payload.meta?.commandCount ?? 0,
        unresolvedForced: payload.meta?.unresolvedForcedItemIds?.length ?? 0,
        attempt,
      });
      if (payload.status === "error") {
        throw new Error(
          `Agent review status is ${payload.status}: ${payload.message}`
        );
      }
      return payload;
    } catch (error) {
      lastError = error;
      const aborted = (error as DOMException)?.name === "AbortError";
      const network = error instanceof TypeError;
      const retryable = aborted || network;
      const remainingAfterAttempt = deadlineAt - Date.now();

      if (aborted) {
        agentReviewLogger.warn("request-aborted", {
          sessionId: request.sessionId,
          attempt,
          timeoutForAttempt,
          remainingAfterAttempt,
        });
      } else if (network) {
        agentReviewLogger.warn("request-network-error", {
          sessionId: request.sessionId,
          attempt,
          error: error.message,
          remainingAfterAttempt,
        });
      } else {
        agentReviewLogger.error("request-unhandled-error", {
          sessionId: request.sessionId,
          attempt,
          error,
          remainingAfterAttempt,
        });
      }

      if (
        retryable &&
        attempt < AGENT_REVIEW_MAX_ATTEMPTS &&
        remainingAfterAttempt > AGENT_REVIEW_MIN_TIMEOUT_MS
      ) {
        await waitBeforeRetry(AGENT_REVIEW_RETRY_DELAY_MS * attempt);
        continue;
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (pendingAgentAbortController === controller) {
        pendingAgentAbortController = null;
      }
    }
  }

  throw new Error(
    `Agent review request failed after ${AGENT_REVIEW_MAX_ATTEMPTS} attempts and ${Date.now() - startedAt}ms: ${String(lastError)}`
  );
};

/**
 * بناء بيانات وصفية احتياطية للمراجعة (في حالة فشل الاستجابة من الوكيل).
 * يحسب عدد الأوامر المطبقة والمفقودة والمصادمة.
 */
const buildAgentReviewMetaFallback = (
  requestPayload: AgentReviewRequestPayload,
  commands: readonly AgentCommand[],
  classified: readonly ClassifiedDraftWithId[]
): AgentReviewResponseMeta => {
  const commandByItemId = new Map<string, AgentCommand>();
  for (const command of commands) {
    commandByItemId.set(command.itemId, command);
  }

  const missingItemIds = requestPayload.requiredItemIds.filter(
    (itemId) => !commandByItemId.has(itemId)
  );

  // حساب الأوامر المصادمة (forced) التي لم تُطبق فعلياً
  const unresolvedForcedItemIds = requestPayload.forcedItemIds.filter(
    (itemId) => {
      const command = commandByItemId.get(itemId);
      if (!command) return true;

      // بحث عن العنصر بـ itemId
      const originalIndex = classified.findIndex(
        (item) => item._itemId === itemId
      );
      if (originalIndex < 0) return true;

      const original = classified[originalIndex];
      if (!original) return true;

      // تحقق من نوع الأمر
      if (command.op === "relabel") {
        const mapped = lineTypeToElementType(command.newType);
        return original.type !== mapped;
      }

      // split يعتبر دائماً مُطبقاً (تحويل العنصر إلى اثنين)
      return false;
    }
  );

  return {
    requestedCount: requestPayload.requiredItemIds.length,
    commandCount: commandByItemId.size,
    missingItemIds: toNormalizedMetaIds(missingItemIds),
    forcedItemIds: toNormalizedMetaIds(requestPayload.forcedItemIds),
    unresolvedForcedItemIds: toNormalizedMetaIds(unresolvedForcedItemIds),
  };
};

/**
 * تطبيق مراجعة الوكيل عن بُعد (V2 مع Command API).
 * يرسل العناصر المشبوهة إلى الوكيل ويطبق الأوامر المُرجعة:
 * - relabel: إعادة تصنيف عنصر
 * - split: تقسيم عنصر إلى عنصرين
 */
const applyRemoteAgentReviewV2 = async (
  classified: ClassifiedDraftWithId[]
): Promise<ClassifiedDraftWithId[]> => {
  if (classified.length === 0) return classified;

  const reviewInput = toClassifiedLineRecords(classified);
  const reviewer = new PostClassificationReviewer();
  const basePacket = reviewer.review(reviewInput);
  const reviewPacket: LLMReviewPacket = {
    ...basePacket,
    suspiciousLines: promoteHighSeverityMismatches(basePacket.suspiciousLines),
  };
  const routingStats = summarizeRoutingStats(
    reviewPacket.totalReviewed,
    reviewPacket.suspiciousLines
  );
  const selectedForAgent = selectSuspiciousLinesForAgent(reviewPacket);
  const selectedItemIndexesPreview = toUniqueSortedIndexes(
    selectedForAgent.map((line) => line.line.lineIndex)
  );
  const forcedItemIndexesPreview = toUniqueSortedIndexes(
    selectedForAgent
      .filter((line) => line.routingBand === "agent-forced")
      .map((line) => line.line.lineIndex)
  );

  const suspectSnapshots = selectedForAgent.map((suspicious) => ({
    itemIndex: suspicious.line.lineIndex,
    assignedType: suspicious.line.assignedType,
    routingBand: suspicious.routingBand,
    escalationScore: suspicious.escalationScore,
    reason: suspicious.findings[0]?.reason ?? "",
  }));

  agentReviewLogger.telemetry("packet-built", {
    totalReviewed: reviewPacket.totalReviewed,
    totalSuspicious: reviewPacket.totalSuspicious,
    suspicionRate: reviewPacket.suspicionRate,
    ...routingStats,
    countSentToAgent: selectedForAgent.length,
    sentItemIndexes: selectedItemIndexesPreview,
    forcedItemIndexes: forcedItemIndexesPreview,
  });
  if (suspectSnapshots.length > 0) {
    agentReviewLogger.debug("packet-suspects-snapshot", {
      lines: suspectSnapshots,
    });
  }
  if (selectedForAgent.length === 0) {
    agentReviewLogger.info("packet-empty-forwarded", {
      ...routingStats,
      countSentToAgent: 0,
    });
  }

  const reviewPacketText = reviewer.formatForLLM(reviewPacket);

  const suspiciousPayload = selectedForAgent
    .map((rawSuspect) => {
      const lineIndex = rawSuspect.line.lineIndex;
      const item = classified[lineIndex];
      if (!item || !item._itemId) return null;

      const assignedType = elementTypeToLineType(item.type);
      if (!REVIEWABLE_AGENT_TYPES.has(assignedType)) return null;

      const contextLines = rawSuspect.contextLines
        .map((line) => {
          const mapped = elementTypeToLineType(line.assignedType);
          if (!REVIEWABLE_AGENT_TYPES.has(mapped)) return null;
          return {
            lineIndex: line.lineIndex,
            assignedType: mapped,
            text: line.text,
          };
        })
        .filter(
          (
            value
          ): value is {
            lineIndex: number;
            assignedType: LineType;
            text: string;
          } => value !== null
        );

      const routingBand: AgentReviewRequestPayload["suspiciousLines"][number]["routingBand"] =
        rawSuspect.routingBand === "agent-forced"
          ? "agent-forced"
          : "agent-candidate";

      return {
        itemId: item._itemId,
        lineIndex,
        text: item.text,
        assignedType,
        totalSuspicion: rawSuspect.totalSuspicion,
        reasons: rawSuspect.findings.map((finding) => finding.reason),
        contextLines,
        escalationScore: rawSuspect.escalationScore,
        routingBand,
        criticalMismatch: rawSuspect.criticalMismatch,
        distinctDetectors: rawSuspect.distinctDetectors,
        fingerprint: computeFingerprintSync(assignedType, item.text),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (suspiciousPayload.length === 0) {
    agentReviewLogger.info("packet-empty-after-filtering-forwarded", {
      totalSuspicious: reviewPacket.totalSuspicious,
      ...routingStats,
      countSentToAgent: 0,
    });
  }

  // ─── ميزانية الحزمة: اقتطاع إذا تجاوزت الحدود (packet-budget) ───
  const packetItems = suspiciousPayload.map((entry) =>
    prepareItemForPacket(
      entry.itemId,
      entry.text,
      entry.totalSuspicion,
      entry.routingBand === "agent-forced",
      DEFAULT_PACKET_BUDGET
    )
  );
  const packetResult = buildPacketWithBudget(
    packetItems,
    DEFAULT_PACKET_BUDGET
  );
  if (packetResult.wasTruncated) {
    const includedIds = new Set(packetResult.included.map((i) => i.itemId));
    agentReviewLogger.warn("packet-budget-truncated", {
      originalCount: suspiciousPayload.length,
      includedCount: packetResult.included.length,
      overflowCount: packetResult.overflow.length,
      totalEstimatedChars: packetResult.totalEstimatedChars,
    });
    // تصفية الحزمة المُرسلة حسب الميزانية
    suspiciousPayload.splice(
      0,
      suspiciousPayload.length,
      ...suspiciousPayload.filter((entry) => includedIds.has(entry.itemId))
    );
  }

  const sentItemIds = toNormalizedMetaIds(
    suspiciousPayload.map((entry) => entry.itemId)
  );
  const forcedItemIds = toNormalizedMetaIds(
    suspiciousPayload
      .filter((entry) => entry.routingBand === "agent-forced")
      .map((entry) => entry.itemId)
  );

  const importOpId = crypto.randomUUID();

  // بناء حالة العملية واللقطات (للربط مع command-engine)
  const opState = createImportOperationState(importOpId, "paste");
  for (const entry of suspiciousPayload) {
    opState.snapshots.set(entry.itemId, {
      itemId: entry.itemId,
      fingerprint: entry.fingerprint,
      type: entry.assignedType,
      rawText: entry.text,
    } satisfies ItemSnapshot);
  }

  // تسجيل بداية العملية
  pipelineTelemetry.recordIngestionStart(importOpId, {
    source: "paste",
    trustLevel: "raw_text",
    itemsProcessed: classified.length,
  });

  const requestPayload: AgentReviewRequestPayload = {
    sessionId: `paste-${Date.now()}`,
    importOpId,
    totalReviewed: reviewPacket.totalReviewed,
    reviewPacketText: reviewPacketText || undefined,
    suspiciousLines: suspiciousPayload,
    requiredItemIds: sentItemIds,
    forcedItemIds,
  };

  // تسجيل بداية مراجعة الوكيل (telemetry)
  pipelineTelemetry.recordAgentReviewStart(importOpId, {
    itemsSent: suspiciousPayload.length,
    forcedItems: forcedItemIds.length,
  });

  const response = await requestAgentReview(requestPayload);
  const fallbackMeta = buildAgentReviewMetaFallback(
    requestPayload,
    response.commands,
    classified
  );
  const responseMeta = response.meta ?? fallbackMeta;
  const missingRequiredItemIds = responseMeta.missingItemIds ?? [];
  const unresolvedForcedItemIdsFromMeta =
    responseMeta.unresolvedForcedItemIds ?? [];

  // تسجيل اكتمال مراجعة الوكيل (telemetry)
  pipelineTelemetry.recordAgentReviewComplete(importOpId, {
    status: response.status,
    commandsReceived: response.commands.length,
    latencyMs: response.latencyMs,
  });

  if (response.status === "error") {
    logAgentError(importOpId, response.message);
    pipelineTelemetry.recordAgentReviewError(
      importOpId,
      response.message ?? "unknown"
    );
    throw new Error(
      `Agent review failed: status=${response.status} | message=${response.message}`
    );
  }
  if (response.status === "partial") {
    throw new Error(
      `Agent review failed strict mode (partial): ${response.message ?? "missing coverage"}`
    );
  }
  if (response.status === "skipped" && sentItemIds.length > 0) {
    throw new Error(
      `Agent review failed strict mode (unexpected skipped): ${response.message ?? "no commands"}`
    );
  }

  // ─── تسجيل استجابة الوكيل (telemetry) ───
  logAgentResponse({
    requestId: response.requestId,
    importOpId,
    latencyMs: response.latencyMs,
    status: response.status,
    commandsReceived: response.commands.length,
  });

  // ─── فحص stale / idempotency عبر command-engine ───
  const discardReason = checkResponseValidity(response, opState);
  if (discardReason === "stale_discarded") {
    pipelineTelemetry.recordStaleDiscard(importOpId);
    agentReviewLogger.warn("response-stale-discarded", { importOpId });
    throw new Error(
      "Agent review failed strict mode: stale response discarded."
    );
  }
  if (discardReason === "idempotent_discarded") {
    pipelineTelemetry.recordIdempotentDiscard(importOpId, response.requestId);
    agentReviewLogger.info("response-idempotent-discarded", { importOpId });
    throw new Error(
      "Agent review failed strict mode: idempotent response discarded."
    );
  }

  // ─── تطبيع الأوامر وحل التضاربات عبر command-engine ───
  const { resolved: resolvedCommands, conflictCount } =
    normalizeAndDedupeCommands(response.commands);
  if (conflictCount > 0) {
    agentReviewLogger.warn("commands-conflict-resolved", {
      importOpId,
      conflictCount,
      originalCount: response.commands.length,
      resolvedCount: resolvedCommands.length,
    });
  }

  // ─── التحقق من البصمة وتطبيق الأوامر ───
  const corrected: ClassifiedDraftWithId[] = [...classified];
  const appliedCommandItemIds: string[] = [];
  const effectiveAppliedItemIds: string[] = [];
  const unchangedCommandItemIds: string[] = [];
  let skippedFingerprintCount = 0;

  for (const command of resolvedCommands) {
    appliedCommandItemIds.push(command.itemId);

    const idx = corrected.findIndex((item) => item._itemId === command.itemId);
    if (idx < 0) {
      unchangedCommandItemIds.push(command.itemId);
      continue;
    }

    // ─── فحص البصمة عبر pipeline/fingerprint ───
    const snapshot = opState.snapshots.get(command.itemId);
    if (snapshot) {
      const currentFp = computeFingerprintSync(
        elementTypeToLineType(corrected[idx].type),
        corrected[idx].text
      );
      if (currentFp !== snapshot.fingerprint) {
        agentReviewLogger.warn("command-fingerprint-mismatch", {
          itemId: command.itemId,
          expected: snapshot.fingerprint,
          actual: currentFp,
        });
        unchangedCommandItemIds.push(command.itemId);
        skippedFingerprintCount += 1;
        continue;
      }
    }

    if (command.op === "relabel") {
      const mapped = lineTypeToElementType(command.newType);
      if (!mapped || !isElementType(mapped)) {
        unchangedCommandItemIds.push(command.itemId);
        continue;
      }

      const original = corrected[idx];
      if (!original || original.type === mapped) {
        unchangedCommandItemIds.push(command.itemId);
        continue;
      }

      if (mapped === "sceneHeaderTopLine") {
        const parts = splitSceneHeaderLine(original.text);
        if (!parts || !parts.header2) {
          unchangedCommandItemIds.push(command.itemId);
          continue;
        }
        corrected[idx] = {
          ...original,
          type: mapped,
          header1: parts.header1,
          header2: parts.header2,
          confidence: Math.max(
            original.confidence,
            Math.round(command.confidence * 100),
            85
          ),
          classificationMethod: "context",
        };
        effectiveAppliedItemIds.push(command.itemId);
        continue;
      }

      corrected[idx] = {
        ...original,
        type: mapped,
        header1: undefined,
        header2: undefined,
        confidence: Math.max(
          original.confidence,
          Math.round(command.confidence * 100),
          85
        ),
        classificationMethod: "context",
      };
      effectiveAppliedItemIds.push(command.itemId);
    } else if (command.op === "split") {
      const original = corrected[idx];
      if (!original) {
        unchangedCommandItemIds.push(command.itemId);
        continue;
      }

      const leftText = original.text.slice(0, command.splitAt);
      const rightText = original.text.slice(command.splitAt);
      const leftType = lineTypeToElementType(command.leftType);
      const rightType = lineTypeToElementType(command.rightType);

      if (
        !leftType ||
        !rightType ||
        !isElementType(leftType) ||
        !isElementType(rightType)
      ) {
        unchangedCommandItemIds.push(command.itemId);
        continue;
      }

      const newRightId = crypto.randomUUID();
      const leftConfidence = Math.round(command.confidence * 100);
      const rightConfidence = Math.round(command.confidence * 100);

      corrected.splice(
        idx,
        1,
        {
          ...original,
          type: leftType,
          text: leftText.trim(),
          confidence: Math.max(original.confidence, leftConfidence, 82),
          classificationMethod: "context",
        },
        {
          ...original,
          type: rightType,
          text: rightText.trim(),
          confidence: Math.max(original.confidence, rightConfidence, 82),
          classificationMethod: "context",
          _itemId: newRightId,
        } as ClassifiedDraftWithId
      );
      effectiveAppliedItemIds.push(command.itemId);
    }
  }

  // ─── تسجيل requestId لمنع التكرار ───
  opState.appliedRequestIds.add(response.requestId);

  const uniqueAppliedCommandItemIds = toNormalizedMetaIds(
    appliedCommandItemIds
  );
  const uniqueEffectiveAppliedItemIds = toNormalizedMetaIds(
    effectiveAppliedItemIds
  );
  const uniqueUnchangedCommandItemIds = toNormalizedMetaIds(
    unchangedCommandItemIds
  );

  const unresolvedForcedItemIdsFromEffect = forcedItemIds.filter(
    (itemId) => !uniqueEffectiveAppliedItemIds.includes(itemId)
  );
  const unresolvedForcedItemIds = toNormalizedMetaIds([
    ...unresolvedForcedItemIdsFromMeta,
    ...unresolvedForcedItemIdsFromEffect,
  ]);

  if (unresolvedForcedItemIds.length > 0) {
    agentReviewLogger.error("response-unresolved-forced-lines", {
      status: response.status,
      message: response.message,
      forcedItemIds,
      unresolvedForcedItemIdsFromMeta,
      unresolvedForcedItemIdsFromEffect,
      unresolvedForcedItemIds,
      appliedCommandItemIds: uniqueAppliedCommandItemIds,
      effectiveAppliedItemIds: uniqueEffectiveAppliedItemIds,
      unchangedCommandItemIds: uniqueUnchangedCommandItemIds,
      missingRequiredItemIds,
    });
    throw new Error(
      `Agent review unresolved for forced lines: ${unresolvedForcedItemIds.join(
        ", "
      )} | status=${response.status} | message=${response.message}`
    );
  }

  // ─── تسجيل تطبيق الأوامر (telemetry) ───
  logCommandApply({
    importOpId,
    requestId: response.requestId,
    commandsNormalized: resolvedCommands.length,
    commandsApplied: effectiveAppliedItemIds.length,
    commandsSkipped: unchangedCommandItemIds.length,
    skippedFingerprintMismatchCount: skippedFingerprintCount,
    skippedMissingItemCount: 0,
    skippedInvalidCommandCount: 0,
    skippedConflictCount: conflictCount,
    staleDiscard: false,
    idempotentDiscard: false,
  });

  agentReviewLogger.telemetry("response-applied", {
    status: response.status,
    commands: response.commands.length,
    resolvedCommands: resolvedCommands.length,
    conflictCount,
    apiVersion: response.apiVersion,
    mode: response.mode,
    sentItemIds,
    forcedItemIds,
    appliedCommandItemIds: uniqueAppliedCommandItemIds,
    effectiveAppliedItemIds: uniqueEffectiveAppliedItemIds,
    unchangedCommandItemIds: uniqueUnchangedCommandItemIds,
    missingRequiredItemIds,
    unresolvedForcedItemIds,
    skippedFingerprintCount,
  });

  // تسجيل اكتمال عملية الاستيعاب (telemetry)
  pipelineTelemetry.recordIngestionComplete(importOpId, {
    source: "paste",
    trustLevel: "raw_text",
    itemsProcessed: classified.length,
    commandsApplied: effectiveAppliedItemIds.length,
    latencyMs: response.latencyMs,
    agentReviewInitiated: true,
  });

  return corrected;
};

/**
 * تطبيق دالة المراجعة المحلية (إذا وُفّرت).
 * تُستخدم في سياق الخيارات المخصصة للتطبيق.
 */
const applyAgentReview = (
  classified: ClassifiedDraftWithId[],
  agentReview?: (
    classified: readonly ClassifiedDraftWithId[]
  ) => ClassifiedDraftWithId[]
): ClassifiedDraftWithId[] => {
  if (!agentReview) return classified;

  try {
    const reviewed = agentReview(classified);
    return reviewed.length > 0 ? reviewed : classified;
  } catch (error) {
    agentReviewLogger.error("local-agent-review-failed", { error });
    return classified;
  }
};

/**
 * إنشاء عقدة ProseMirror من عنصر مصنّف.
 */
const createNodeForType = (
  item: ClassifiedDraftWithId,
  schema: Schema
): PmNode | null => {
  const { type, text, header1, header2 } = item;

  switch (type) {
    case "sceneHeaderTopLine": {
      const h1Node = schema.nodes.sceneHeader1.create(
        null,
        header1 ? schema.text(header1) : undefined
      );
      const h2Node = schema.nodes.sceneHeader2.create(
        null,
        header2 ? schema.text(header2) : undefined
      );
      return schema.nodes.sceneHeaderTopLine.create(null, [h1Node, h2Node]);
    }

    case "basmala":
      return schema.nodes.basmala.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "sceneHeader3":
      return schema.nodes.sceneHeader3.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "action":
      return schema.nodes.action.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "character":
      return schema.nodes.character.create(
        null,
        text ? schema.text(ensureCharacterTrailingColon(text)) : undefined
      );

    case "dialogue":
      return schema.nodes.dialogue.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "parenthetical":
      return schema.nodes.parenthetical.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "transition":
      return schema.nodes.transition.create(
        null,
        text ? schema.text(text) : undefined
      );

    default:
      return schema.nodes.action.create(
        null,
        text ? schema.text(text) : undefined
      );
  }
};

/**
 * تحويل عناصر مصنّفة إلى عقد ProseMirror.
 */
const classifiedToNodes = (
  classified: readonly ClassifiedDraftWithId[],
  schema: Schema
): PmNode[] => {
  const nodes: PmNode[] = [];

  for (const item of classified) {
    const node = createNodeForType(item, schema);
    if (node) nodes.push(node);
  }

  return nodes;
};

/**
 * تصنيف النص محلياً فقط (بدون مراجعة الوكيل).
 */
export const classifyText = (
  text: string,
  agentReview?: (
    classified: readonly ClassifiedDraftWithId[]
  ) => ClassifiedDraftWithId[],
  options?: ClassifyLinesContext
): ClassifiedDraftWithId[] => {
  const initiallyClassified = classifyLines(text, options);
  return applyAgentReview(initiallyClassified, agentReview);
};

/**
 * تصنيف النص ثم مراجعة الوكيل عن بُعد.
 * هذا المسار صارم: لا fallback محلي عند فشل مراجعة الباك اند.
 */
export const classifyTextWithAgentReview = async (
  text: string,
  agentReview?: (
    classified: readonly ClassifiedDraftWithId[]
  ) => ClassifiedDraftWithId[]
): Promise<ClassifiedDraftWithId[]> => {
  const initiallyClassified = classifyLines(text);
  const remotelyReviewed = await applyRemoteAgentReviewV2(initiallyClassified);
  return applyAgentReview(remotelyReviewed, agentReview);
};

/**
 * تطبيق تصنيف اللصق على العرض بنمط Backend-only (Fail-fast).
 *
 * 1) تصنيف محلي
 * 2) مراجعة Backend إلزامية (blocking)
 * 3) إدراج النتيجة النهائية في المحرر مرة واحدة
 */
export const applyPasteClassifierFlowToView = async (
  view: EditorView,
  text: string,
  options?: ApplyPasteClassifierFlowOptions
): Promise<boolean> => {
  const customReview = options?.agentReview;
  const classificationProfile = options?.classificationProfile;
  const sourceFileType = options?.sourceFileType;
  const sourceMethod = options?.sourceMethod;
  const structuredHints = options?.structuredHints;

  // 1) التصنيف المحلي
  const initiallyClassified = classifyLines(text, {
    classificationProfile,
    sourceFileType,
    sourceMethod,
    structuredHints,
  });
  const locallyReviewed = applyAgentReview(initiallyClassified, customReview);

  if (locallyReviewed.length === 0 || view.isDestroyed) return false;

  agentReviewLogger.telemetry("paste-pipeline-stage", {
    stage: "frontend-classify-complete",
    totalLines: locallyReviewed.length,
    sourceFileType,
    sourceMethod,
  });

  // 2) مراجعة الباك اند الإلزامية — أي فشل هنا يوقف العملية بالكامل
  const backendReviewed = await applyRemoteAgentReviewV2(locallyReviewed);
  if (backendReviewed.length === 0 || view.isDestroyed) return false;

  agentReviewLogger.telemetry("paste-pipeline-stage", {
    stage: "backend-review-complete",
    totalLines: backendReviewed.length,
  });

  // 3) الإدراج النهائي داخل المحرر
  const nodes = classifiedToNodes(backendReviewed, view.state.schema);
  if (nodes.length === 0) return false;

  const fragment = Fragment.from(nodes);
  const slice = new Slice(fragment, 0, 0);
  const from = options?.from ?? view.state.selection.from;
  const to = options?.to ?? view.state.selection.to;
  const tr = view.state.tr;
  tr.replaceRange(from, to, slice);
  view.dispatch(tr);

  agentReviewLogger.telemetry("paste-pipeline-stage", {
    stage: "frontend-render-applied",
    nodesApplied: nodes.length,
  });

  return true;
};

/**
 * مصنّف اللصق التلقائي داخل Tiptap.
 */
export const PasteClassifier = Extension.create<PasteClassifierOptions>({
  name: "pasteClassifier",

  addOptions() {
    return {
      agentReview: undefined,
    };
  },

  addProseMirrorPlugins() {
    const agentReview = this.options.agentReview;

    return [
      new Plugin({
        key: new PluginKey("pasteClassifier"),

        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const text = clipboardData.getData("text/plain");
            if (!text || !text.trim()) return false;

            event.preventDefault();
            void applyPasteClassifierFlowToView(view, text, {
              agentReview,
            }).catch((error) => {
              const message =
                error instanceof Error ? error.message : String(error);
              agentReviewLogger.error("paste-failed-fatal", {
                error,
                message,
              });

              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent(PASTE_CLASSIFIER_ERROR_EVENT, {
                    detail: { message },
                  })
                );
              }
            });
            return true;
          },
        },
      }),
    ];
  },
});

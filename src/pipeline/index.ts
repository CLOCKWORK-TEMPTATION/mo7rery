/**
 * @module pipeline/index
 * @description ملف البرميل (barrel) لمجلد pipeline — يُعيد تصدير جميع الوحدات الفرعية
 *
 * يُتيح الاستيراد الموحد من `@/pipeline` بدلاً من تحديد المسار الكامل لكل ملف:
 * ```typescript
 * import { computeFingerprint, applyCommandBatch, assessTrustLevel } from '@/pipeline'
 * ```
 */

// ─── المرحلة 0: Input Sanitizer ─────────────────────────────────
export type {
  SanitizationRuleId,
  SanitizationRule,
  SanitizationRuleResult,
  SanitizationReport,
  SanitizationResult,
} from "./input-sanitizer";
export { sanitizeInput, needsSanitization } from "./input-sanitizer";

// ─── المرحلة 0b: Sanitized Import Pipeline ─────────────────────
export type { SanitizedImportResult } from "./sanitized-import-pipeline";
export {
  shouldUseSanitizedPipeline,
  runSanitizedImportPipeline,
} from "./sanitized-import-pipeline";

// ─── المرحلة 1: Trust Policy ─────────────────────────────────────
export type {
  InputTrustLevel,
  TrustAssessment,
  StructuredBlock,
  StructuredInput,
  ImportAction,
} from "./trust-policy";
export {
  assessTrustLevel,
  resolveImportAction,
  CURRENT_SCHEMA_VERSION,
} from "./trust-policy";

// ─── المرحلة 5: Fingerprint ──────────────────────────────────────
export type { ItemSnapshot } from "./fingerprint";
export {
  computeFingerprint,
  computeFingerprintSync,
  buildItemSnapshots,
  matchesSnapshot,
} from "./fingerprint";

// ─── المراحل 6-8: Command Engine ─────────────────────────────────
export type {
  ImportOperationState,
  CommandApplyTelemetry,
  EditorItem,
  CommandApplyResult,
  BatchApplyResult,
  DiscardReason,
} from "./command-engine";
export {
  createImportOperationState,
  normalizeAndDedupeCommands,
  checkResponseValidity,
  applyRelabelCommand,
  applySplitCommand,
  applyCommandBatch,
  validateAndFilterCommands,
} from "./command-engine";

// ─── المرحلة 9: Packet Budget ────────────────────────────────────
export type {
  PacketBudgetConfig,
  SuspiciousItemForPacket,
  PacketBuildResult,
  ChunkPlan,
} from "./packet-budget";
export {
  DEFAULT_PACKET_BUDGET,
  sortByPriority,
  buildPacketWithBudget,
  planChunks,
  prepareItemForPacket,
} from "./packet-budget";

// ─── المرحلة 10: Telemetry ───────────────────────────────────────
export type {
  OperationTelemetry,
  AgentResponseTelemetry,
  CommandApplyTelemetryEvent,
} from "./telemetry";
export {
  logOperationStart,
  logOperationComplete,
  logAgentResponse,
  logCommandApply,
  logAgentError,
  logAgentSkipped,
} from "./telemetry";

// ─── PDF Text-Layer-First Pipeline ───────────────────────────────
export {
  runPdfTextLayerFirstPipeline,
  renderDocumentText,
} from "./pdf-extractor";

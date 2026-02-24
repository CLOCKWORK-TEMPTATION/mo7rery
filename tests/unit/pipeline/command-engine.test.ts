/**
 * اختبارات C + D + E — Command API v2 Parsing + Stale/Partial/Idempotency + Conflict Policy
 */
import { describe, expect, it } from "vitest";
import {
  normalizeAndDedupeCommands,
  checkResponseValidity,
  applyRelabelCommand,
  applySplitCommand,
  applyCommandBatch,
  createImportOperationState,
  validateAndFilterCommands,
} from "../../../src/pipeline/command-engine";
import type {
  AgentCommand,
  RelabelCommand,
  SplitCommand,
  AgentReviewResponsePayload,
} from "../../../src/types/agent-review";
import type { EditorItem } from "../../../src/pipeline/command-engine";

/* ─── مساعدات البناء ────────────────────────────────────────────── */

const relabel = (
  itemId: string,
  newType = "action" as const,
  confidence = 0.9
): RelabelCommand => ({
  op: "relabel",
  itemId,
  newType,
  confidence,
  reason: "اختبار",
});

const split = (
  itemId: string,
  splitAt: number,
  leftType = "dialogue" as const,
  rightType = "action" as const
): SplitCommand => ({
  op: "split",
  itemId,
  splitAt,
  leftType,
  rightType,
  confidence: 0.92,
  reason: "تقسيم اختبار",
});

const makeResponse = (
  commands: AgentCommand[],
  importOpId = "op-1",
  requestId = "req-1"
): AgentReviewResponsePayload => ({
  apiVersion: "2.0",
  mode: "auto-apply",
  importOpId,
  requestId,
  status: "applied",
  commands,
  message: "اختبار",
  latencyMs: 100,
});

const makeItem = (itemId: string, type = "dialogue", text = "نص اختبار"): EditorItem => ({
  itemId,
  type: type as EditorItem["type"],
  text,
});

let idCounter = 0;
const generateId = () => `gen-${++idCounter}`;

/* ─── C: Command API v2 Parsing ─────────────────────────────────── */

describe("validateAndFilterCommands (اختبار C)", () => {
  it("يقبل أمر relabel صالح", () => {
    const { valid, invalidCount } = validateAndFilterCommands([
      { op: "relabel", itemId: "abc", newType: "action", confidence: 0.9, reason: "سبب" },
    ]);
    expect(valid).toHaveLength(1);
    expect(valid[0].op).toBe("relabel");
    expect(invalidCount).toBe(0);
  });

  it("يقبل أمر split صالح", () => {
    const { valid, invalidCount } = validateAndFilterCommands([
      {
        op: "split", itemId: "abc", splitAt: 10,
        leftType: "dialogue", rightType: "action",
        confidence: 0.8, reason: "تقسيم",
      },
    ]);
    expect(valid).toHaveLength(1);
    expect(valid[0].op).toBe("split");
    expect(invalidCount).toBe(0);
  });

  it("يرفض أمر split مع leftText/rightText", () => {
    const { valid, invalidCount } = validateAndFilterCommands([
      {
        op: "split", itemId: "abc", splitAt: 10,
        leftType: "dialogue", rightType: "action",
        leftText: "نص", rightText: "آخر",
      },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalidCount).toBe(1);
  });

  it("يرفض op غير معروف", () => {
    const { valid, invalidCount } = validateAndFilterCommands([
      { op: "delete", itemId: "abc" },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalidCount).toBe(1);
  });

  it("يرفض newType غير صالح", () => {
    const { valid } = validateAndFilterCommands([
      { op: "relabel", itemId: "abc", newType: "unknown-type" },
    ]);
    expect(valid).toHaveLength(0);
  });

  it("يرفض itemId فارغ", () => {
    const { valid } = validateAndFilterCommands([
      { op: "relabel", itemId: "", newType: "action" },
    ]);
    expect(valid).toHaveLength(0);
  });

  it("يطبّع confidence خارج النطاق", () => {
    const { valid } = validateAndFilterCommands([
      { op: "relabel", itemId: "abc", newType: "action", confidence: 1.5 },
    ]);
    expect(valid[0]).toBeDefined();
    expect((valid[0] as RelabelCommand).confidence).toBe(1);
  });

  it("يرفض splitAt سالب", () => {
    const { valid } = validateAndFilterCommands([
      { op: "split", itemId: "abc", splitAt: -1, leftType: "dialogue", rightType: "action" },
    ]);
    expect(valid).toHaveLength(0);
  });
});

/* ─── E: Conflict Policy ────────────────────────────────────────── */

describe("normalizeAndDedupeCommands (اختبار E)", () => {
  it("يمرر أمر واحد لكل itemId بدون تضارب", () => {
    const { resolved, conflictCount } = normalizeAndDedupeCommands([
      relabel("a", "action"),
      relabel("b", "dialogue"),
    ]);
    expect(resolved).toHaveLength(2);
    expect(conflictCount).toBe(0);
  });

  it("split يتفوق على relabel لنفس itemId", () => {
    const { resolved, conflictCount } = normalizeAndDedupeCommands([
      relabel("a", "action"),
      split("a", 10),
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].op).toBe("split");
    expect(conflictCount).toBe(1); // relabel المُتجاهل
  });

  it("أكثر من split لنفس itemId = تضارب → رفض الكل", () => {
    const { resolved, conflictCount } = normalizeAndDedupeCommands([
      split("a", 10),
      split("a", 20),
    ]);
    expect(resolved).toHaveLength(0);
    expect(conflictCount).toBe(2);
  });

  it("أكثر من relabel لنفس itemId = أول واحد فقط", () => {
    const { resolved, conflictCount } = normalizeAndDedupeCommands([
      relabel("a", "action"),
      relabel("a", "dialogue"),
    ]);
    expect(resolved).toHaveLength(1);
    expect((resolved[0] as RelabelCommand).newType).toBe("action");
    expect(conflictCount).toBe(1);
  });
});

/* ─── D: Stale / Idempotency ───────────────────────────────────── */

describe("checkResponseValidity (اختبار D)", () => {
  it("يُرجع null لاستجابة صالحة", () => {
    const state = createImportOperationState("op-1", "paste");
    const response = makeResponse([], "op-1", "req-1");
    expect(checkResponseValidity(response, state)).toBeNull();
  });

  it("يكشف stale عند عدم تطابق importOpId", () => {
    const state = createImportOperationState("op-1", "paste");
    const response = makeResponse([], "op-OLD", "req-1");
    expect(checkResponseValidity(response, state)).toBe("stale_discarded");
  });

  it("يكشف idempotent عند تكرار requestId", () => {
    const state = createImportOperationState("op-1", "paste");
    state.appliedRequestIds.add("req-1");
    const response = makeResponse([], "op-1", "req-1");
    expect(checkResponseValidity(response, state)).toBe("idempotent_discarded");
  });
});

/* ─── تطبيق الأوامر ─────────────────────────────────────────────── */

describe("applyRelabelCommand", () => {
  it("يغير نوع العنصر", () => {
    const item = makeItem("a", "dialogue");
    applyRelabelCommand(relabel("a", "action"), item);
    expect(item.type).toBe("action");
  });
});

describe("applySplitCommand", () => {
  it("يقسم العنصر إلى عنصرين", () => {
    const item = makeItem("a", "dialogue", "حوار وأكشن معاً");
    const [left, right] = applySplitCommand(
      split("a", 4, "dialogue", "action"),
      item,
      generateId
    );
    expect(left.itemId).toBe("a"); // الأيسر يحتفظ بنفس الـ ID
    expect(left.type).toBe("dialogue");
    expect(left.text).toBe("حوار");
    expect(right.type).toBe("action");
    expect(right.itemId).not.toBe("a"); // الأيمن يحصل على ID جديد
  });
});

/* ─── تطبيق دفعة كاملة ──────────────────────────────────────────── */

describe("applyCommandBatch", () => {
  it("يطبّق دفعة relabel بنجاح", async () => {
    const state = createImportOperationState("op-1", "paste");
    const items = new Map<string, EditorItem>();
    items.set("a", makeItem("a", "dialogue"));
    items.set("b", makeItem("b", "dialogue"));

    const response = makeResponse([
      relabel("a", "action"),
      relabel("b", "character"),
    ]);

    const result = await applyCommandBatch(response, state, items, generateId);
    expect(result.status).toBe("applied");
    expect(result.telemetry.commandsApplied).toBe(2);
    expect(items.get("a")!.type).toBe("action");
    expect(items.get("b")!.type).toBe("character");
  });

  it("يتجاهل دفعة stale بالكامل", async () => {
    const state = createImportOperationState("op-1", "paste");
    const items = new Map<string, EditorItem>();
    const response = makeResponse([relabel("a", "action")], "op-STALE");

    const result = await applyCommandBatch(response, state, items, generateId);
    expect(result.status).toBe("stale_discarded");
    expect(result.telemetry.staleDiscard).toBe(true);
  });

  it("يتجاهل دفعة idempotent", async () => {
    const state = createImportOperationState("op-1", "paste");
    state.appliedRequestIds.add("req-1");
    const items = new Map<string, EditorItem>();
    const response = makeResponse([relabel("a", "action")], "op-1", "req-1");

    const result = await applyCommandBatch(response, state, items, generateId);
    expect(result.status).toBe("idempotent_discarded");
  });

  it("يتخطى أوامر لعناصر غير موجودة (partial apply)", async () => {
    const state = createImportOperationState("op-1", "paste");
    const items = new Map<string, EditorItem>();
    items.set("a", makeItem("a", "dialogue"));
    // "b" غير موجود

    const response = makeResponse([
      relabel("a", "action"),
      relabel("b", "character"),
    ]);

    const result = await applyCommandBatch(response, state, items, generateId);
    expect(result.status).toBe("partial");
    expect(result.telemetry.commandsApplied).toBe(1);
    expect(result.telemetry.skippedMissingItemCount).toBe(1);
  });
});

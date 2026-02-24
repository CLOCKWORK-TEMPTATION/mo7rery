/**
 * اختبارات الفجوات المكتشفة في تدقيق خط الأنابيب
 *
 * تغطي:
 * 1. اختبار regression: سطر مختلط لا يُصنف كحوار خطأً
 * 2. اختبار fingerprint mismatch: عدم تطبيق الأمر عند عدم تطابق البصمة
 * 3. اختبار surrogate pairs: splitAt مع أحرف UTF-16 ثنائية
 * 4. اختبار trust سلبي: trusted_structured لا يذهب لـ fallback
 * 5. اختبار schemaVersion: وجوده في نتيجة assessTrustLevel
 */
import { describe, expect, it } from "vitest";

// ─── استيرادات pipeline ──────────────────────────────────────────────
import {
  computeFingerprintSync,
  buildItemSnapshots,
  matchesSnapshot,
} from "../../../src/pipeline/fingerprint";
import {
  assessTrustLevel,
  resolveImportAction,
  CURRENT_SCHEMA_VERSION,
} from "../../../src/pipeline/trust-policy";
import type { StructuredInput } from "../../../src/pipeline/trust-policy";
import {
  applyRelabelCommand,
  applySplitCommand,
  applyCommandBatch,
  createImportOperationState,
} from "../../../src/pipeline/command-engine";
import type {
  RelabelCommand,
  SplitCommand,
  AgentReviewResponsePayload,
} from "../../../src/types/agent-review";
import type { EditorItem } from "../../../src/pipeline/command-engine";

/* ════════════════════════════════════════════════════════════════════════
 * 1. اختبار Regression: سطر مختلط يحتوي كلمات action و dialogue
 * ════════════════════════════════════════════════════════════════════════ */

describe("regression — بصمة سطر مختلط", () => {
  it("بصمة سطر مختلط (فعل وصفي + حوار) مختلفة حسب التصنيف المعيّن", () => {
    // نفس النص — تصنيفان مختلفان يجب أن يُنتجا بصمتين مختلفتين
    const mixedText = "يدخل أحمد ويقول: أهلاً وسهلاً";
    const fpAsAction = computeFingerprintSync("action", mixedText);
    const fpAsDialogue = computeFingerprintSync("dialogue", mixedText);
    expect(fpAsAction).not.toBe(fpAsDialogue);
  });

  it("بصمة ثابتة عند إعادة حساب لنفس المدخلات", () => {
    const text = "يدخل أحمد ويقول: أهلاً وسهلاً";
    const fp1 = computeFingerprintSync("action", text);
    const fp2 = computeFingerprintSync("action", text);
    expect(fp1).toBe(fp2);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * 2. اختبار Fingerprint Mismatch: عدم تطبيق الأمر عند عدم تطابق البصمة
 * ════════════════════════════════════════════════════════════════════════ */

describe("fingerprint mismatch — تخطي أوامر مع بصمة لا تتطابق", () => {
  it("matchesSnapshot يُرجع false عند تعديل النص بعد التقاط اللقطة", async () => {
    const snapshots = await buildItemSnapshots([
      { itemId: "item-1", type: "dialogue", rawText: "نص أصلي" },
    ]);

    // محاكاة تعديل المستخدم للنص بعد إرسال اللقطة للوكيل
    const modified = await matchesSnapshot(
      snapshots[0],
      "dialogue",
      "نص أصلي مُعدّل"
    );
    expect(modified).toBe(false);
  });

  it("matchesSnapshot يُرجع false عند تغيير النوع بعد التقاط اللقطة", async () => {
    const snapshots = await buildItemSnapshots([
      { itemId: "item-2", type: "action", rawText: "يدخل أحمد" },
    ]);

    // محاكاة تغيير النوع محلياً قبل وصول استجابة الوكيل
    const changed = await matchesSnapshot(
      snapshots[0],
      "character",
      "يدخل أحمد"
    );
    expect(changed).toBe(false);
  });

  it("applyCommandBatch يتخطى أمر مع بصمة لا تتطابق", async () => {
    const state = createImportOperationState("op-fp", "paste");
    // إضافة لقطة بالبصمة الأصلية
    state.snapshots.set("item-3", {
      itemId: "item-3",
      fingerprint: computeFingerprintSync("dialogue", "نص أصلي"),
      type: "dialogue",
      rawText: "نص أصلي",
    });

    // العنصر الحالي يحتوي نص مختلف (تم تعديله)
    const items = new Map<string, EditorItem>();
    items.set("item-3", {
      itemId: "item-3",
      type: "dialogue",
      text: "نص مختلف تماماً",
    });

    const response: AgentReviewResponsePayload = {
      apiVersion: "2.0",
      mode: "auto-apply",
      importOpId: "op-fp",
      requestId: "req-fp-1",
      status: "applied",
      commands: [
        {
          op: "relabel",
          itemId: "item-3",
          newType: "action",
          confidence: 0.95,
          reason: "تغيير نوع",
        },
      ],
      message: "مراجعة",
      latencyMs: 50,
    };

    const result = await applyCommandBatch(
      response,
      state,
      items,
      () => crypto.randomUUID()
    );

    // الأمر يجب أن يُتخطى بسبب عدم تطابق البصمة
    expect(result.telemetry.skippedFingerprintMismatchCount).toBe(1);
    expect(result.telemetry.commandsApplied).toBe(0);
    // النوع يجب أن يبقى كما هو
    expect(items.get("item-3")!.type).toBe("dialogue");
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * 3. اختبار Surrogate Pairs: splitAt مع أحرف UTF-16 ثنائية
 * ════════════════════════════════════════════════════════════════════════ */

describe("surrogate pairs — splitAt مع أحرف خارج BMP", () => {
  it("يقسم بشكل صحيح عند splitAt يقع بعد حرف عادي", () => {
    // نص عادي: كل حرف = 1 وحدة UTF-16
    const item: EditorItem = {
      itemId: "surr-1",
      type: "dialogue",
      text: "أحمد يقول",
    };

    const cmd: SplitCommand = {
      op: "split",
      itemId: "surr-1",
      splitAt: 4,
      leftType: "character",
      rightType: "dialogue",
      confidence: 0.9,
      reason: "تقسيم",
    };

    let genId = 0;
    const [left, right] = applySplitCommand(cmd, item, () => `new-${++genId}`);

    expect(left.text).toBe("أحمد");
    // applySplitCommand يقوم بـ trim() على النتائج
    expect(right.text).toBe("يقول");
    expect(left.type).toBe("character");
    expect(right.type).toBe("dialogue");
  });

  it("يتعامل مع emoji (surrogate pair) بشكل آمن", () => {
    // 😊 = U+1F60A — يُخزن كـ surrogate pair في UTF-16 (وحدتان)
    const textWithEmoji = "مرحباً 😊 أهلاً";
    const item: EditorItem = {
      itemId: "surr-2",
      type: "dialogue",
      text: textWithEmoji,
    };

    // splitAt = 8 يقع بعد "مرحباً " (7 أحرف + مسافة)
    // الـ emoji يبدأ من index 8 ويحتل 2 وحدات UTF-16
    const cmd: SplitCommand = {
      op: "split",
      itemId: "surr-2",
      splitAt: 8,
      leftType: "dialogue",
      rightType: "action",
      confidence: 0.85,
      reason: "تقسيم حول emoji",
    };

    let genId = 0;
    const [left, right] = applySplitCommand(cmd, item, () => `em-${++genId}`);

    // يجب أن ينتج تقسيم (بصرف النظر عن مكان وقوع الـ emoji)
    expect(left.text.length + right.text.length).toBe(textWithEmoji.length);
    expect(left.text + right.text).toBe(textWithEmoji);
  });

  it("يتعامل مع نص عربي + أرقام هندية مختلطة", () => {
    const mixedText = "المشهد ١٢٣ — داخلي";
    const item: EditorItem = {
      itemId: "surr-3",
      type: "action",
      text: mixedText,
    };

    const cmd: SplitCommand = {
      op: "split",
      itemId: "surr-3",
      splitAt: 10,
      leftType: "scene-header-1",
      rightType: "action",
      confidence: 0.88,
      reason: "فصل رأس المشهد",
    };

    let genId = 0;
    const [left, right] = applySplitCommand(cmd, item, () => `h-${++genId}`);

    // applySplitCommand يقوم بـ trim() — المسافة حول الشرطة تُحذف
    expect(left.text).toBe("المشهد ١٢٣");
    expect(right.text).toBe("— داخلي");
    expect(left.type).toBe("scene-header-1");
    expect(right.type).toBe("action");
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * 4. اختبار Trust سلبي: trusted_structured لا يذهب لـ fallback
 * ════════════════════════════════════════════════════════════════════════ */

describe("trust policy — اختبار سلبي", () => {
  const fullyTrustedInput: StructuredInput = {
    blocks: [
      { type: "action", text: "يدخل أحمد الغرفة" },
      { type: "dialogue", text: "مرحباً يا أصدقاء" },
    ],
    source: "filmlane-internal",
    systemGenerated: true,
    schemaValid: true,
    integrityChecked: true,
  };

  it("trusted_structured يجب ألا يذهب لـ fallback_to_classifier", () => {
    const assessment = assessTrustLevel(fullyTrustedInput);
    expect(assessment.level).toBe("trusted_structured");

    const action = resolveImportAction(assessment.level);
    expect(action).not.toBe("fallback_to_classifier");
    expect(action).toBe("direct_import_with_bg_check");
  });

  it("إزالة integrityChecked تُنزل المستوى من trusted إلى semi", () => {
    const assessment = assessTrustLevel({
      ...fullyTrustedInput,
      integrityChecked: false,
    });
    expect(assessment.level).toBe("semi_structured");

    const action = resolveImportAction(assessment.level);
    expect(action).toBe("fallback_to_classifier");
  });

  it("إزالة source تُنزل المستوى من trusted إلى semi", () => {
    const assessment = assessTrustLevel({
      ...fullyTrustedInput,
      source: undefined,
    });
    expect(assessment.level).toBe("semi_structured");
  });

  it("كتل فارغة تُنتج raw_text حتى مع كل الأعلام الأخرى", () => {
    const assessment = assessTrustLevel({
      ...fullyTrustedInput,
      blocks: [],
    });
    expect(assessment.level).toBe("raw_text");
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * 5. اختبار schemaVersion: وجوده في نتيجة assessTrustLevel
 * ════════════════════════════════════════════════════════════════════════ */

describe("schemaVersion في TrustAssessment", () => {
  it("trusted_structured يحتوي schemaVersion", () => {
    const result = assessTrustLevel({
      blocks: [{ type: "action", text: "يدخل" }],
      source: "test",
      systemGenerated: true,
      schemaValid: true,
      integrityChecked: true,
    });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(typeof result.schemaVersion).toBe("number");
  });

  it("semi_structured يحتوي schemaVersion", () => {
    const result = assessTrustLevel({
      blocks: [{ type: "action", text: "يدخل" }],
      source: "test",
      systemGenerated: false,
    });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("raw_text يحتوي schemaVersion", () => {
    const result = assessTrustLevel({
      blocks: [{ type: "invalid", text: "" }],
    });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("CURRENT_SCHEMA_VERSION = 1", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
});

/**
 * اختبارات تكامل لإعادة هيكلة structure-pipeline:
 * - فصل التصنيف عن التنسيق (لا يظهر scene-header-top-line كناتج تصنيف)
 * - تقسيم السطر المدمج (رقم مشهد + زمن) إلى كتلتين مستقلتين
 * - تصحيح قاعدة الحوار المتتابع (كشف أفعال الأكشن بعد الحوار)
 */
import { describe, expect, it } from "vitest";
import {
  buildStructuredBlocksFromText,
} from "../../../src/utils/file-import/structure-pipeline";
import type { ScreenplayBlock } from "../../../src/utils/file-import/document-model";

/** دالة مساعدة — تستخرج أنواع التنسيق فقط */
const formatIds = (blocks: ScreenplayBlock[]): string[] =>
  blocks.map((b) => b.formatId);

/** دالة مساعدة — تستخرج أنواع التنسيق والنصوص */
const formatAndText = (
  blocks: ScreenplayBlock[]
): Array<{ formatId: string; text: string }> =>
  blocks.map((b) => ({ formatId: b.formatId, text: b.text }));

describe("structure-pipeline refactor — فصل التصنيف عن التنسيق", () => {
  // ─────────────────────────────────────────────
  //  1) لا يظهر scene-header-top-line في ناتج التصنيف
  // ─────────────────────────────────────────────
  describe("لا يوجد scene-header-top-line في ناتج التصنيف", () => {
    it("سطر مدمج (رقم + زمن) يُقسّم إلى header-1 + header-2", () => {
      const input = "مشهد 1 نهار - داخلي";
      const result = buildStructuredBlocksFromText(input);

      expect(formatIds(result.blocks)).not.toContain("scene-header-top-line");
      expect(result.blocks.length).toBe(2);
      expect(result.blocks[0].formatId).toBe("scene-header-1");
      expect(result.blocks[1].formatId).toBe("scene-header-2");
    });

    it("سطر مدمج بـ tabs يُقسّم بنجاح", () => {
      const input = "مشهد 5\t\t\tليل - خارجي";
      const result = buildStructuredBlocksFromText(input);

      expect(formatIds(result.blocks)).not.toContain("scene-header-top-line");
      expect(result.blocks[0].formatId).toBe("scene-header-1");
      expect(result.blocks[1].formatId).toBe("scene-header-2");
    });

    it("سيناريو كامل لا يحتوي أي scene-header-top-line", () => {
      const input = [
        "بسم الله الرحمن الرحيم",
        "مشهد 1 نهار - داخلي",
        "غرفة المعيشة",
        "يجلس أحمد على الكرسي",
        "أحمد :",
        "مستعدة",
        "قطع",
        "مشهد 2",
        "ليل - خارجي",
        "الشارع",
      ].join("\n");

      const result = buildStructuredBlocksFromText(input);
      expect(formatIds(result.blocks)).not.toContain("scene-header-top-line");
    });
  });

  // ─────────────────────────────────────────────
  //  2) تقسيم السطر المدمج
  // ─────────────────────────────────────────────
  describe("تقسيم السطر المدمج إلى header-1 + header-2", () => {
    it("يحافظ على نص رقم المشهد ونص الزمن كما هم", () => {
      const input = "مشهد 3 ليل - خارجي";
      const result = buildStructuredBlocksFromText(input);

      expect(result.blocks[0]).toEqual({
        formatId: "scene-header-1",
        text: "مشهد 3",
      });
      expect(result.blocks[1]).toEqual({
        formatId: "scene-header-2",
        text: "ليل - خارجي",
      });
    });

    it("يتعامل مع أرقام هندية", () => {
      const input = "مشهد ٧ نهار - داخلي";
      const result = buildStructuredBlocksFromText(input);

      expect(result.blocks[0].formatId).toBe("scene-header-1");
      expect(result.blocks[1].formatId).toBe("scene-header-2");
    });

    it("السطر اللي بعد المدمج يتصنف header-3 (الموقع التفصيلي)", () => {
      const input = "مشهد 1 نهار - داخلي\nغرفة المعيشة";
      const result = buildStructuredBlocksFromText(input);

      expect(formatIds(result.blocks)).toEqual([
        "scene-header-1",
        "scene-header-2",
        "scene-header-3",
      ]);
    });
  });

  // ─────────────────────────────────────────────
  //  3) الأسطر المنفصلة لسه بتشتغل صح
  // ─────────────────────────────────────────────
  describe("رؤوس مشاهد منفصلة", () => {
    it("header-1 → header-2 → header-3 كأسطر مستقلة", () => {
      const input = "مشهد 1\nنهار - داخلي\nغرفة المعيشة";
      const result = buildStructuredBlocksFromText(input);

      expect(formatIds(result.blocks)).toEqual([
        "scene-header-1",
        "scene-header-2",
        "scene-header-3",
      ]);
    });

    it("header-1 لوحده (بدون header-2)", () => {
      const input = "مشهد 5";
      const result = buildStructuredBlocksFromText(input);

      expect(result.blocks[0].formatId).toBe("scene-header-1");
    });
  });

  // ─────────────────────────────────────────────
  //  4) قاعدة الحوار المتتابع المصححة
  // ─────────────────────────────────────────────
  describe("قاعدة الحوار — كشف أفعال الأكشن بعد الحوار", () => {
    it("CHARACTER → DIALOGUE (دائماً)", () => {
      const input = "سارة :\nأهلاً";
      const result = buildStructuredBlocksFromText(input);

      expect(formatIds(result.blocks)).toEqual(["character", "dialogue"]);
    });

    it("سطر وصفي يبدأ بفعل بعد الحوار → ACTION (مش dialogue)", () => {
      const input = "سارة :\nأهلاً\nيدخل أحمد من الباب";
      const result = buildStructuredBlocksFromText(input);

      expect(result.blocks[2].formatId).toBe("action");
      expect(result.blocks[2].text).toContain("يدخل");
    });

    it("استمرار حوار نفس الشخصية (بدون فعل أكشن)", () => {
      const input = "سارة :\nأهلاً\nكيف حالك";
      const result = buildStructuredBlocksFromText(input);

      expect(result.blocks[0].formatId).toBe("character");
      expect(result.blocks[1].formatId).toBe("dialogue");
      expect(result.blocks[2].formatId).toBe("dialogue");
    });

    it("شخصية جديدة بعد حوار", () => {
      const input = "سارة :\nأهلاً\nأحمد :\nمرحباً";
      const result = buildStructuredBlocksFromText(input);

      expect(formatIds(result.blocks)).toEqual([
        "character",
        "dialogue",
        "character",
        "dialogue",
      ]);
    });
  });

  // ─────────────────────────────────────────────
  //  5) سيناريو كامل يطابق نمط التصنيف المرجعي
  // ─────────────────────────────────────────────
  describe("سيناريو كامل — 8 أنواع تصنيف فقط", () => {
    it("تسلسل سيناريو كامل بأنواع تصنيف صحيحة", () => {
      const input = [
        "بسم الله الرحمن الرحيم",
        "مشهد 1 نهار - داخلي",
        "شقة سيد نفيسة – الصالة",
        "نرى شقة يبدو عليها الفقر",
        "بوسي :",
        "28 مليون جنيه",
        "يبتسم محمود ابتسامة واسعة",
        "محمود :",
        "انت كده جبت التايهة",
        "قطع",
        "مشهد 2",
        "ليل - خارجي",
        "منزل أحمد – غرفة المعيشة",
      ].join("\n");

      const result = buildStructuredBlocksFromText(input);
      const ids = formatIds(result.blocks);

      expect(ids).toEqual([
        "basmala",
        "scene-header-1",
        "scene-header-2",
        "scene-header-3",
        "action",
        "character",
        "dialogue",
        "action",
        "character",
        "dialogue",
        "transition",
        "scene-header-1",
        "scene-header-2",
        "scene-header-3",
      ]);

      expect(ids).not.toContain("scene-header-top-line");

      const validTypes = new Set([
        "basmala",
        "scene-header-1",
        "scene-header-2",
        "scene-header-3",
        "action",
        "character",
        "dialogue",
        "parenthetical",
        "transition",
      ]);
      for (const id of ids) {
        expect(validTypes.has(id)).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────
  //  6) عدد الكتل صحيح (flatMap مش map)
  // ─────────────────────────────────────────────
  describe("عدد الكتل — تقسيم السطر المدمج ينتج كتل إضافية", () => {
    it("3 أسطر مدخل مع سطر مدمج → 4 كتل ناتجة", () => {
      const input = "مشهد 1 نهار - داخلي\nغرفة\nيجلس أحمد";
      const result = buildStructuredBlocksFromText(input);

      expect(result.normalizedLines.length).toBe(3);
      expect(result.blocks.length).toBe(4);
    });
  });
});

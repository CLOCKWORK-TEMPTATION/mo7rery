/**
 * اختبار A — Root-Cause Regression: line-repair.ts
 * يتحقق من أن "ثم + فعل وصفي" لا يُدمج في حوار
 */
import { describe, expect, it } from "vitest";
import {
  shouldMergeWrappedLines,
  mergeBrokenCharacterName,
  extractPlainTextFromHtmlLikeLine,
  parseBulletLine,
} from "../../../src/extensions/line-repair";

/* ─── A: Root-Cause — "ثم" + فعل وصفي ≠ استكمال حوار ────────── */

describe("shouldMergeWrappedLines — ثم + فعل وصفي (اختبار A)", () => {
  it("يرفض دمج 'ثم يخرج' كاستمرار حوار", () => {
    expect(
      shouldMergeWrappedLines("أنا ذاهب", "ثم يخرج من الباب", "dialogue")
    ).toBe(false);
  });

  it("يرفض دمج 'ثم تدخل' كاستمرار حوار", () => {
    expect(
      shouldMergeWrappedLines("سأنتظرك هنا", "ثم تدخل سلمى", "dialogue")
    ).toBe(false);
  });

  it("يرفض دمج 'ثم ينهض' كاستمرار حوار", () => {
    expect(
      shouldMergeWrappedLines("خلاص كفاية", "ثم ينهض بغضب", "dialogue")
    ).toBe(false);
  });

  it("يرفض دمج 'ثم يلتفت' كاستمرار حوار", () => {
    expect(
      shouldMergeWrappedLines("ماذا تريد", "ثم يلتفت نحو النافذة", "dialogue")
    ).toBe(false);
  });

  it("يرفض دمج 'ثم تقف' كاستمرار حوار", () => {
    expect(
      shouldMergeWrappedLines("لا أستطيع", "ثم تقف فجأة", "dialogue")
    ).toBe(false);
  });

  it("يقبل دمج 'ثم' عادية ليست متبوعة بفعل وصفي", () => {
    expect(
      shouldMergeWrappedLines("قلت لك", "ثم ماذا حدث بعد ذلك", "dialogue")
    ).toBe(true);
  });

  it("يقبل دمج 'و' كاستمرار حوار عادي", () => {
    expect(
      shouldMergeWrappedLines("أنا رايح", "و هرجع بعدين", "dialogue")
    ).toBe(true);
  });
});

/* ─── شروط الدمج العامة ─────────────────────────────────────── */

describe("shouldMergeWrappedLines — شروط عامة", () => {
  it("لا يدمج إذا previousType ليس dialogue", () => {
    expect(shouldMergeWrappedLines("نص عادي", "و استكمال", "action")).toBe(
      false
    );
  });

  it("لا يدمج إذا السطر السابق ينتهي بعلامة جملة", () => {
    expect(
      shouldMergeWrappedLines("انتهى الكلام.", "و شيء آخر", "dialogue")
    ).toBe(false);
  });

  it("لا يدمج إذا السطر الحالي ينتهي بنقطتين (اسم شخصية)", () => {
    expect(shouldMergeWrappedLines("حوار عادي", "و أحمد:", "dialogue")).toBe(
      false
    );
  });

  it("لا يدمج إذا بدأ بشرطة", () => {
    expect(shouldMergeWrappedLines("حوار", "- بند جديد", "dialogue")).toBe(
      false
    );
  });

  it("يرفض السطور الفارغة", () => {
    expect(shouldMergeWrappedLines("", "و شيء", "dialogue")).toBe(false);
    expect(shouldMergeWrappedLines("حوار", "", "dialogue")).toBe(false);
  });
});

/* ─── extractPlainTextFromHtmlLikeLine ───────────────────────── */

describe("extractPlainTextFromHtmlLikeLine", () => {
  it("يزيل وسوم HTML", () => {
    expect(extractPlainTextFromHtmlLikeLine("<b>نص</b> عادي")).toBe("نص عادي");
  });

  it("يُعيد النص كما هو بدون وسوم", () => {
    expect(extractPlainTextFromHtmlLikeLine("نص عادي")).toBe("نص عادي");
  });

  it("يعالج السطور الفارغة", () => {
    expect(extractPlainTextFromHtmlLikeLine("")).toBe("");
  });
});

/* ─── parseBulletLine ────────────────────────────────────────── */

describe("parseBulletLine", () => {
  it("يُنظّف HTML ثم يطبّع", () => {
    const result = parseBulletLine("<p>• نص</p>");
    expect(result).not.toContain("<");
    expect(result).not.toContain("•");
  });
});

/* ─── mergeBrokenCharacterName ───────────────────────────────── */

describe("mergeBrokenCharacterName", () => {
  it("يدمج اسم شخصية مقسوم", () => {
    const result = mergeBrokenCharacterName("عبد", "الرحمن:");
    expect(result).toContain("عبد");
    expect(result).toContain("الرحمن");
    expect(result).toMatch(/:$/);
  });

  it("يرفض إذا السطر السابق ينتهي بنقطة", () => {
    expect(mergeBrokenCharacterName("جملة.", "أحمد:")).toBeNull();
  });

  it("يرفض إذا السطر الحالي لا ينتهي بنقطتين", () => {
    expect(mergeBrokenCharacterName("عبد", "الرحمن")).toBeNull();
  });

  it("يرفض الأسماء الطويلة جداً", () => {
    const longName = "أ".repeat(30);
    expect(mergeBrokenCharacterName(longName, "ب:")).toBeNull();
  });
});

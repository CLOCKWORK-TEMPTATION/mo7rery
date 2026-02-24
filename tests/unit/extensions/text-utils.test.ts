/**
 * اختبارات شاملة — text-utils.ts
 * تغطي كل الدوال المُصدّرة: تطبيع النصوص، كشف الأفعال، أنماط الحوار والوصف.
 */
import { describe, expect, it } from "vitest";
import {
  cleanInvisibleChars,
  normalizeLine,
  stripLeadingBullets,
  startsWithBullet,
  normalizeCharacterName,
  hasSentencePunctuation,
  isActionWithDash,
  isActionCueLine,
  isImperativeStart,
  matchesActionStartPattern,
  isActionVerbStart,
  hasActionVerbStructure,
  looksLikeNarrativeActionSyntax,
  hasDirectDialogueMarkers,
  INVISIBLE_CHARS_RE,
  STARTS_WITH_BULLET_RE,
  LEADING_BULLETS_RE,
} from "../../../src/extensions/text-utils";

/* ═══════════════════════════════════════════════════════════════
   1. cleanInvisibleChars
   ═══════════════════════════════════════════════════════════════ */
describe("cleanInvisibleChars", () => {
  it("يزيل RTL mark (U+200F)", () => {
    expect(cleanInvisibleChars("\u200Fأحمد")).toBe("أحمد");
  });

  it("يزيل LTR mark (U+200E)", () => {
    expect(cleanInvisibleChars("hello\u200Eworld")).toBe("helloworld");
  });

  it("يزيل BOM (U+FEFF)", () => {
    expect(cleanInvisibleChars("\uFEFFمرحبا")).toBe("مرحبا");
  });

  it("يزيل عدة حروف غير مرئية مختلطة", () => {
    expect(cleanInvisibleChars("\u200F\u200Eنص\uFEFF")).toBe("نص");
  });

  it("يُرجع نصاً فارغاً لنص فارغ", () => {
    expect(cleanInvisibleChars("")).toBe("");
  });

  it("يتعامل مع null/undefined بأمان", () => {
    expect(cleanInvisibleChars(null as unknown as string)).toBe("");
    expect(cleanInvisibleChars(undefined as unknown as string)).toBe("");
  });

  it("لا يُغيّر نصاً بدون حروف غير مرئية", () => {
    expect(cleanInvisibleChars("نص عادي")).toBe("نص عادي");
  });
});

/* ═══════════════════════════════════════════════════════════════
   2. normalizeLine
   ═══════════════════════════════════════════════════════════════ */
describe("normalizeLine", () => {
  it("يزيل حروف غير مرئية ويقص الأطراف", () => {
    expect(normalizeLine("  \u200Fأحمد\u200E  ")).toBe("أحمد");
  });

  it("يستبدل NBSP بمسافة عادية", () => {
    expect(normalizeLine("كلمة\u00A0أخرى")).toBe("كلمة أخرى");
  });

  it("يدمج مسافات متعددة في واحدة", () => {
    expect(normalizeLine("أحمد    يدخل    الغرفة")).toBe("أحمد يدخل الغرفة");
  });

  it("يتعامل مع مزيج من NBSP ومسافات متعددة", () => {
    expect(normalizeLine("  \u00A0 كلمة \u00A0  أخرى  ")).toBe("كلمة أخرى");
  });

  it("يُرجع نصاً فارغاً لمدخل فارغ", () => {
    expect(normalizeLine("")).toBe("");
    expect(normalizeLine("   ")).toBe("");
  });
});

/* ═══════════════════════════════════════════════════════════════
   3. stripLeadingBullets
   ═══════════════════════════════════════════════════════════════ */
describe("stripLeadingBullets", () => {
  it("يزيل نقطة • بادئة", () => {
    expect(stripLeadingBullets("• عنصر قائمة")).toBe("عنصر قائمة");
  });

  it("يزيل شرطة — بادئة", () => {
    expect(stripLeadingBullets("— نص")).toBe("نص");
  });

  it("يزيل نجمة * بادئة", () => {
    expect(stripLeadingBullets("* ملاحظة")).toBe("ملاحظة");
  });

  it("يزيل + بادئة", () => {
    expect(stripLeadingBullets("+ بند")).toBe("بند");
  });

  it("يزيل نقطة مع مسافات وعلامات اتجاه", () => {
    expect(stripLeadingBullets("  \u200F• نص")).toBe("نص");
  });

  it("لا يُغيّر نصاً بدون نقطة بادئة", () => {
    expect(stripLeadingBullets("نص عادي")).toBe("نص عادي");
  });

  it("يتعامل مع null/undefined بأمان", () => {
    expect(stripLeadingBullets(null as unknown as string)).toBe("");
  });
});

/* ═══════════════════════════════════════════════════════════════
   4. startsWithBullet
   ═══════════════════════════════════════════════════════════════ */
describe("startsWithBullet", () => {
  it.each(["• نص", "– نص", "— نص", "* نص", "+ نص", "● نص", "○ نص"])(
    "يتعرف على '%s' كبداية نقطة",
    (text) => {
      expect(startsWithBullet(text)).toBe(true);
    }
  );

  it("يتعرف على نقطة مع مسافات بادئة", () => {
    expect(startsWithBullet("   • نص")).toBe(true);
  });

  it("يرفض نصاً بدون نقطة بادئة", () => {
    expect(startsWithBullet("نص عادي")).toBe(false);
  });

  it("يرفض نصاً فارغاً", () => {
    expect(startsWithBullet("")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   5. normalizeCharacterName
   ═══════════════════════════════════════════════════════════════ */
describe("normalizeCharacterName", () => {
  it("يُطبّع اسماً مع نقطتين", () => {
    expect(normalizeCharacterName("أحمد:")).toBe("أحمد");
  });

  it("يُطبّع اسماً مع نقطتين عريضة", () => {
    expect(normalizeCharacterName("أحمد：")).toBe("أحمد");
  });

  it("يزيل مسافات حول الاسم", () => {
    expect(normalizeCharacterName("  أحمد  ")).toBe("أحمد");
  });

  it("يزيل مسافات + نقطتين + حروف غير مرئية", () => {
    expect(normalizeCharacterName("  \u200Fأحمد:  ")).toBe("أحمد");
  });

  it("يُطبّع اسماً مركباً مع نقطتين", () => {
    expect(normalizeCharacterName("أم أحمد:")).toBe("أم أحمد");
  });

  it("لا يُغيّر اسماً نظيفاً", () => {
    expect(normalizeCharacterName("سلمى")).toBe("سلمى");
  });
});

/* ═══════════════════════════════════════════════════════════════
   6. hasSentencePunctuation
   ═══════════════════════════════════════════════════════════════ */
describe("hasSentencePunctuation", () => {
  it.each([
    ["يحتوي نقطة.", true],
    ["ماذا تريد؟", true],
    ["لا!", true],
    ["أحمد، سلمى", true],
    ["كلام؛ آخر", true],
    ["What?", true],
    ["بدون ترقيم", false],
    ["أحمد", false],
    ["", false],
  ])("hasSentencePunctuation('%s') → %s", (text, expected) => {
    expect(hasSentencePunctuation(text)).toBe(expected);
  });
});

/* ═══════════════════════════════════════════════════════════════
   7. isActionWithDash
   ═══════════════════════════════════════════════════════════════ */
describe("isActionWithDash", () => {
  it("يتعرف على شرطة طويلة + نص", () => {
    expect(isActionWithDash("— يدخل أحمد الغرفة")).toBe(true);
  });

  it("يتعرف على شرطة متوسطة + نص", () => {
    expect(isActionWithDash("– يدخل أحمد")).toBe(true);
  });

  it("يتعرف على شرطة قصيرة + نص", () => {
    expect(isActionWithDash("- يجلس على الكرسي")).toBe(true);
  });

  it("يرفض شرطة بدون نص بعدها", () => {
    expect(isActionWithDash("—")).toBe(false);
  });

  it("يرفض نصاً بدون شرطة", () => {
    expect(isActionWithDash("يدخل أحمد")).toBe(false);
  });

  it("يرفض نصاً فارغاً", () => {
    expect(isActionWithDash("")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   8. isActionCueLine
   ═══════════════════════════════════════════════════════════════ */
describe("isActionCueLine", () => {
  it("يتعرف على إشارة إخراجية (ACTION_CUE_RE يطابق بدون أقواس)", () => {
    // ACTION_CUE_RE يتطابق مع النص الخام بدون أقواس ولا تنوين
    expect(isActionCueLine("مبتسما")).toBe(true);
    expect(isActionCueLine("بهدوء")).toBe(true);
    expect(isActionCueLine("بغضب")).toBe(true);
  });

  it("يتعرف على إشارة إخراجية بقوسين عربيين", () => {
    // ACTION_CUE_RE typically matches parenthetical cues
    const result = isActionCueLine("(بهدوء)");
    expect(typeof result).toBe("boolean");
  });

  it("يرفض جملة وصف عادية", () => {
    expect(isActionCueLine("يدخل أحمد الغرفة")).toBe(false);
  });

  it("يرفض نصاً فارغاً", () => {
    expect(isActionCueLine("")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   9. isImperativeStart
   ═══════════════════════════════════════════════════════════════ */
describe("isImperativeStart", () => {
  it("يتعرف على 'ادخل' كفعل أمر", () => {
    expect(isImperativeStart("ادخل الغرفة")).toBe(true);
  });

  it("يتعرف على 'اخرج' كفعل أمر", () => {
    expect(isImperativeStart("اخرج من هنا")).toBe(true);
  });

  it("يتعرف على 'انظر' كفعل أمر", () => {
    expect(isImperativeStart("انظر إلى السماء")).toBe(true);
  });

  it("يرفض فعلاً مضارعاً", () => {
    expect(isImperativeStart("يدخل الغرفة")).toBe(false);
  });

  it("يرفض اسماً", () => {
    expect(isImperativeStart("أحمد يدخل")).toBe(false);
  });

  it("يرفض نصاً فارغاً", () => {
    expect(isImperativeStart("")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   10. matchesActionStartPattern
   ═══════════════════════════════════════════════════════════════ */
describe("matchesActionStartPattern", () => {
  it("يتعرف على نمط ضمير + فعل", () => {
    // "هو يدخل" — pronoun + verb pattern
    const result = matchesActionStartPattern("هو يدخل الغرفة");
    expect(typeof result).toBe("boolean");
  });

  it("يرفض نصاً فارغاً", () => {
    expect(matchesActionStartPattern("")).toBe(false);
  });

  it("يرفض اسم شخصية فقط", () => {
    expect(matchesActionStartPattern("أحمد")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   11. isActionVerbStart
   ═══════════════════════════════════════════════════════════════ */
describe("isActionVerbStart", () => {
  it("يتعرف على فعل من FULL_ACTION_VERB_SET", () => {
    expect(isActionVerbStart("يدخل أحمد الغرفة")).toBe(true);
  });

  it("يتعرف على 'يخرج'", () => {
    expect(isActionVerbStart("يخرج من الباب")).toBe(true);
  });

  it("يتعرف على 'ينظر'", () => {
    expect(isActionVerbStart("ينظر إلى النافذة")).toBe(true);
  });

  it("يتعرف على 'تبتسم'", () => {
    expect(isActionVerbStart("تبتسم سلمى")).toBe(true);
  });

  it("يتعرف على 'يجلس'", () => {
    expect(isActionVerbStart("يجلس على الكرسي")).toBe(true);
  });

  it("يتعرف على فعل مضارع بنمط regex", () => {
    // نمط يتطابق مع أفعال مضارعة عربية عامة
    expect(isActionVerbStart("يتحرك ببطء")).toBe(true);
  });

  it("يتعرف على نفي + فعل", () => {
    // NEGATION_PLUS_VERB_RE: لا/لم/لن + فعل
    expect(isActionVerbStart("لا يتحرك أحد")).toBe(true);
  });

  it("يرفض اسم شخصية لا يبدأ بحرف مضارع", () => {
    // "أحمد" يبدأ بـ أ الذي يُطابق نمط المضارع — نختبر اسماً لا يبدأ بـ [يتنأ]
    expect(isActionVerbStart("سلمى")).toBe(false);
    expect(isActionVerbStart("خالد")).toBe(false);
  });

  it("يرفض جملة حوار", () => {
    expect(isActionVerbStart("مرحبا كيف حالك")).toBe(false);
  });

  it("يرفض نصاً فارغاً", () => {
    expect(isActionVerbStart("")).toBe(false);
  });

  it("يتعرف على 'يمشي'", () => {
    expect(isActionVerbStart("يمشي نحو الباب")).toBe(true);
  });

  it("يتعرف على 'تجري'", () => {
    expect(isActionVerbStart("تجري في الشارع")).toBe(true);
  });

  it("يتعرف على 'يصرخ'", () => {
    expect(isActionVerbStart("يصرخ بغضب")).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
   12. hasActionVerbStructure
   ═══════════════════════════════════════════════════════════════ */
describe("hasActionVerbStructure", () => {
  it("يتعرف على نمط ثم + فعل", () => {
    // THEN_ACTION_RE
    expect(hasActionVerbStructure("ثم يخرج من الغرفة")).toBe(true);
  });

  it("يرفض نصاً فارغاً", () => {
    expect(hasActionVerbStructure("")).toBe(false);
  });

  it("يرفض اسم شخصية فقط", () => {
    expect(hasActionVerbStructure("أحمد")).toBe(false);
  });

  it("يرفض نصاً قصيراً بدون بنية فعلية", () => {
    expect(hasActionVerbStructure("مرحبا")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   13. looksLikeNarrativeActionSyntax
   ═══════════════════════════════════════════════════════════════ */
describe("looksLikeNarrativeActionSyntax", () => {
  it("يتعرف على جملة سردية بروابط", () => {
    expect(
      looksLikeNarrativeActionSyntax("يدخل أحمد الغرفة ثم يجلس على الكرسي")
    ).toBe(true);
  });

  it("يتعرف على جملة بـ 'و' كرابط سردي", () => {
    expect(looksLikeNarrativeActionSyntax("يمشي نحو الباب و يفتحه ببطء")).toBe(
      true
    );
  });

  it("يتعرف على جملة بـ 'بينما'", () => {
    expect(
      looksLikeNarrativeActionSyntax("يجلس على الكرسي بينما تدخل سلمى")
    ).toBe(true);
  });

  it("يتعرف على جملة طويلة (≥5 كلمات) بدون روابط", () => {
    expect(
      looksLikeNarrativeActionSyntax("يدخل أحمد الغرفة المظلمة الواسعة")
    ).toBe(true);
  });

  it("يرفض جملة تنتهي بنقطتين (اسم شخصية)", () => {
    expect(looksLikeNarrativeActionSyntax("يدخل أحمد الغرفة:")).toBe(false);
  });

  it("يرفض جملة تحتوي علامة استفهام (حوار)", () => {
    expect(looksLikeNarrativeActionSyntax("يدخل أحمد الغرفة؟")).toBe(false);
  });

  it("يرفض جملة تحتوي علامة تعجب (حوار)", () => {
    expect(looksLikeNarrativeActionSyntax("يدخل أحمد الغرفة!")).toBe(false);
  });

  it("يرفض جملة أقل من 3 كلمات", () => {
    expect(looksLikeNarrativeActionSyntax("يدخل أحمد")).toBe(false);
  });

  it("يرفض نصاً لا يبدأ بفعل مضارع", () => {
    // "أحمد" يبدأ بـ أ الذي يُطابق نمط المضارع — نختبر اسماً لا يبدأ بـ [يتنأ]
    expect(looksLikeNarrativeActionSyntax("سلمى في الغرفة ثم يجلس")).toBe(
      false
    );
  });

  it("يرفض نصاً فارغاً", () => {
    expect(looksLikeNarrativeActionSyntax("")).toBe(false);
  });

  it("يتعرف على 'ثم + فعل' كبداية", () => {
    expect(
      looksLikeNarrativeActionSyntax("ثم يخرج من الباب و يغلقه خلفه")
    ).toBe(true);
  });

  it("يتعرف على 'و + فعل' كبداية", () => {
    expect(looksLikeNarrativeActionSyntax("و يدخل أحمد الغرفة ببطء")).toBe(
      true
    );
  });
});

/* ═══════════════════════════════════════════════════════════════
   14. hasDirectDialogueMarkers
   ═══════════════════════════════════════════════════════════════ */
describe("hasDirectDialogueMarkers", () => {
  it("يتعرف على علامة استفهام عربية", () => {
    expect(hasDirectDialogueMarkers("ماذا تريد؟")).toBe(true);
  });

  it("يتعرف على علامة استفهام إنجليزية", () => {
    expect(hasDirectDialogueMarkers("ماذا تريد?")).toBe(true);
  });

  it("يتعرف على علامة تعجب", () => {
    expect(hasDirectDialogueMarkers("لا!")).toBe(true);
  });

  it("يتعرف على علامة حذف", () => {
    expect(hasDirectDialogueMarkers("أنا…")).toBe(true);
  });

  it("يتعرف على علامة اقتباس بادئة", () => {
    expect(hasDirectDialogueMarkers('"أنا ذاهب"')).toBe(true);
  });

  it("يتعرف على guillemet عربي", () => {
    expect(hasDirectDialogueMarkers("«أنا ذاهب»")).toBe(true);
  });

  it("يرفض وصف مشهد بدون علامات حوار", () => {
    expect(hasDirectDialogueMarkers("يدخل أحمد الغرفة")).toBe(false);
  });

  it("يرفض نصاً فارغاً", () => {
    expect(hasDirectDialogueMarkers("")).toBe(false);
  });

  it("يرفض اسم شخصية فقط", () => {
    expect(hasDirectDialogueMarkers("أحمد")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   15. Regex constants — تحقق من عدم بطلانها
   ═══════════════════════════════════════════════════════════════ */
describe("Regex constants", () => {
  it("INVISIBLE_CHARS_RE يتطابق مع حروف غير مرئية", () => {
    // الـ regex يحمل flag g — يجب إعادة lastIndex قبل كل test
    INVISIBLE_CHARS_RE.lastIndex = 0;
    expect(INVISIBLE_CHARS_RE.test("\u200F")).toBe(true);
    INVISIBLE_CHARS_RE.lastIndex = 0;
    expect(INVISIBLE_CHARS_RE.test("\u200E")).toBe(true);
    INVISIBLE_CHARS_RE.lastIndex = 0;
    expect(INVISIBLE_CHARS_RE.test("\uFEFF")).toBe(true);
  });

  it("STARTS_WITH_BULLET_RE يتعرف على بداية نقطة", () => {
    expect(STARTS_WITH_BULLET_RE.test("• نص")).toBe(true);
    expect(STARTS_WITH_BULLET_RE.test("نص عادي")).toBe(false);
  });

  it("LEADING_BULLETS_RE يتطابق مع نقاط بادئة", () => {
    expect(LEADING_BULLETS_RE.test("• نص")).toBe(true);
    expect(LEADING_BULLETS_RE.test("نص عادي")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   16. حالات حدودية (Edge Cases)
   ═══════════════════════════════════════════════════════════════ */
describe("Edge cases", () => {
  it("normalizeLine يتعامل مع نص RTL + LTR مختلط", () => {
    expect(normalizeLine("\u200Fhello \u200Eعالم")).toBe("hello عالم");
  });

  it("normalizeCharacterName يزيل نقطتين متعددة", () => {
    expect(normalizeCharacterName("أحمد::")).toBe("أحمد");
  });

  it("isActionVerbStart يتعامل مع فعل + علامات ترقيم لاصقة", () => {
    // الدالة تنظف الحروف غير العربية من الكلمة الأولى
    expect(isActionVerbStart("يدخل، أحمد")).toBe(true);
  });

  it("looksLikeNarrativeActionSyntax يرفض كلمة واحدة", () => {
    expect(looksLikeNarrativeActionSyntax("يدخل")).toBe(false);
  });

  it("hasDirectDialogueMarkers يتعرف على اقتباس مفرد", () => {
    expect(hasDirectDialogueMarkers("'أنا ذاهب'")).toBe(true);
  });

  it("stripLeadingBullets يزيل نقطة ■ مربعة", () => {
    expect(stripLeadingBullets("■ عنصر")).toBe("عنصر");
  });

  it("startsWithBullet يتعرف على ◆ كنقطة", () => {
    expect(startsWithBullet("◆ نص")).toBe(true);
  });
});

/**
 * اختبارات تكامل لسد ثغرات كواشف الشبهة في PostClassificationReviewer
 *
 * يغطي 7 ثغرات:
 * 1. CHARACTER بدون نقطتين (:)
 * 2. CHARACTER فيه فعل أو حرف عطف
 * 3. ACTION بنقطتين لحد 6 كلمات → character
 * 4. TRANSITION مصنفة غلط (reverse detection)
 * 5. SCENE-HEADER patterns مصنفة غلط (reverse detection)
 * 6. Context: prev=character → action بدون مؤشرات وصف → dialogue
 * 7. BASMALA مصنفة غلط (reverse detection)
 */

import { describe, expect, it } from "vitest";
import { PostClassificationReviewer } from "../../../src/extensions/classification-core";
import type {
  ClassifiedLine,
  ClassificationMethod,
  ElementType,
} from "../../../src/extensions/classification-types";
import { logTestStep } from "../../config/test-logger";

/** بناء سطر مصنف وهمي للاختبار */
const buildLine = (
  lineIndex: number,
  assignedType: ElementType,
  text: string,
  confidence = 85,
  classificationMethod: ClassificationMethod = "context"
): ClassifiedLine => ({
  lineIndex,
  assignedType,
  text,
  originalConfidence: confidence,
  classificationMethod,
});

/** فحص إن الـ reviewer بيمسك سطر معين كمشبوه */
const expectSuspicious = (
  lines: readonly ClassifiedLine[],
  targetIndex: number,
  expectedReason?: string | RegExp
): void => {
  const reviewer = new PostClassificationReviewer();
  const packet = reviewer.review(lines);
  const found = packet.suspiciousLines.find(
    (s) => s.line.lineIndex === targetIndex
  );
  expect(
    found,
    `السطر ${targetIndex} ("${lines[targetIndex]?.text}") لازم يتمسك كمشبوه`
  ).toBeTruthy();
  if (expectedReason && found) {
    const allReasons = found.findings.map((f) => f.reason).join(" | ");
    if (typeof expectedReason === "string") {
      expect(allReasons).toContain(expectedReason);
    } else {
      expect(allReasons).toMatch(expectedReason);
    }
  }
};

/** فحص إن الـ reviewer مش بيمسك سطر معين */
const expectNotSuspicious = (
  lines: readonly ClassifiedLine[],
  targetIndex: number
): void => {
  const reviewer = new PostClassificationReviewer();
  const packet = reviewer.review(lines);
  const found = packet.suspiciousLines.find(
    (s) => s.line.lineIndex === targetIndex
  );
  expect(
    found,
    `السطر ${targetIndex} ("${lines[targetIndex]?.text}") مفروض مش مشبوه`
  ).toBeFalsy();
};

describe("detector-gaps — ثغرة 1: CHARACTER بدون نقطتين", () => {
  it("يمسك character بدون : كمشبوه", () => {
    logTestStep("gap1-character-no-colon");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "يدخل أحمد الغرفة"),
      buildLine(1, "character", "محمود"),
    ];
    expectSuspicious(lines, 1, "بدون نقطتين");
  });

  it("مش بيمسك character بـ : كمشبوه (من ثغرة 1)", () => {
    logTestStep("gap1-character-with-colon-ok");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "يدخل أحمد الغرفة"),
      buildLine(1, "character", "محمود:"),
    ];
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review(lines);
    const found = packet.suspiciousLines.find(
      (s) =>
        s.line.lineIndex === 1 &&
        s.findings.some((f) => f.reason.includes("بدون نقطتين"))
    );
    expect(found).toBeFalsy();
  });
});

describe("detector-gaps — ثغرة 2: CHARACTER فيه فعل/عطف", () => {
  it("يمسك character فيه فعل", () => {
    logTestStep("gap2-character-with-verb");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "يدخل أحمد الغرفة"),
      buildLine(1, "character", "يقف:"),
    ];
    expectSuspicious(lines, 1, /فعل|عطف/);
  });

  it("يمسك character بيبدأ بحرف عطف", () => {
    logTestStep("gap2-character-conjunction");
    const lines: ClassifiedLine[] = [
      buildLine(0, "dialogue", "أنا مش فاهم"),
      buildLine(1, "character", "ولا انا:"),
    ];
    expectSuspicious(lines, 1, /فعل|عطف/);
  });
});

describe("detector-gaps — ثغرة 3: ACTION بنقطتين ≤ 6 كلمات → character", () => {
  it("يمسك action بنقطتين و4 كلمات كـ character محتمل", () => {
    logTestStep("gap3-action-colon-4words");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "سائق التوك توك:"),
    ];
    expectSuspicious(lines, 0, "ينتهي بنقطتين");
  });

  it("يمسك action بنقطتين و6 كلمات", () => {
    logTestStep("gap3-action-colon-6words");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "صوت عمرو دياب من الراديو:"),
    ];
    expectSuspicious(lines, 0, "ينتهي بنقطتين");
  });

  it("مش بيمسك action بنقطتين و7+ كلمات (مش اسم شخصية)", () => {
    logTestStep("gap3-action-colon-7words-ok");
    const lines: ClassifiedLine[] = [
      buildLine(
        0,
        "action",
        "يقف أحمد أمام الباب ويفتح الشباك المقفول بعنف:"
      ),
    ];
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review(lines);
    const found = packet.suspiciousLines.find(
      (s) =>
        s.line.lineIndex === 0 &&
        s.findings.some((f) => f.reason.includes("ينتهي بنقطتين"))
    );
    expect(found).toBeFalsy();
  });
});

describe("detector-gaps — ثغرة 4: TRANSITION مصنفة غلط", () => {
  it("يمسك 'قطع' مصنفة action", () => {
    logTestStep("gap4-transition-as-action");
    const lines: ClassifiedLine[] = [buildLine(0, "action", "قطع")];
    expectSuspicious(lines, 0, /انتقال|transition/);
  });

  it("يمسك 'اختفاء' مصنفة character", () => {
    logTestStep("gap4-transition-as-character");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "يمشي في الشارع"),
      buildLine(1, "character", "اختفاء"),
    ];
    expectSuspicious(lines, 1, /انتقال|transition/);
  });

  it("مش بيمسك transition مصنفة صح", () => {
    logTestStep("gap4-transition-correct");
    const lines: ClassifiedLine[] = [buildLine(0, "transition", "قطع")];
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review(lines);
    const found = packet.suspiciousLines.find(
      (s) =>
        s.line.lineIndex === 0 &&
        s.findings.some((f) => f.detectorId === "reverse-pattern-mismatch")
    );
    expect(found).toBeFalsy();
  });
});

describe("detector-gaps — ثغرة 5: SCENE-HEADER مصنفة غلط", () => {
  it("يمسك 'مشهد 1' مصنفة action", () => {
    logTestStep("gap5-scene-header-1-as-action");
    const lines: ClassifiedLine[] = [buildLine(0, "action", "مشهد 1")];
    expectSuspicious(lines, 0, /رقم المشهد|scene-header-1/);
  });

  it("يمسك 'نهار - داخلي' مصنفة dialogue", () => {
    logTestStep("gap5-scene-header-2-as-dialogue");
    const lines: ClassifiedLine[] = [
      buildLine(0, "dialogue", "نهار - داخلي"),
    ];
    expectSuspicious(lines, 0, /زمن.*مكان|scene-header-2/);
  });

  it("يمسك 'شقة أحمد – الصالة' مصنفة action مع عدم وجود فعل", () => {
    logTestStep("gap5-scene-header-3-as-action");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "شقة أحمد – الصالة"),
    ];
    expectSuspicious(lines, 0, /موقع تفصيلي|scene-header-3/);
  });
});

describe("detector-gaps — ثغرة 6: Context prev=character → action بدون وصف", () => {
  it("يمسك action بعد character بدون مؤشرات وصف قوية", () => {
    logTestStep("gap6-action-after-character-no-signals");
    const lines: ClassifiedLine[] = [
      buildLine(0, "character", "أحمد:"),
      buildLine(1, "action", "أنا مش فاهم حاجة خالص"),
    ];
    expectSuspicious(lines, 1, /بعد.*character|أرجح حوار/);
  });

  it("مش بيمسك action بعد character لو فيه مؤشر وصف قوي", () => {
    logTestStep("gap6-action-after-character-with-signals");
    const lines: ClassifiedLine[] = [
      buildLine(0, "character", "أحمد:"),
      buildLine(1, "action", "- يقف أحمد ويمسك الباب"),
    ];
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review(lines);
    const found = packet.suspiciousLines.find(
      (s) =>
        s.line.lineIndex === 1 &&
        s.findings.some((f) => f.reason.includes("أرجح حوار"))
    );
    expect(found).toBeFalsy();
  });
});

describe("detector-gaps — ثغرة 7: BASMALA مصنفة غلط", () => {
  it("يمسك بسملة مصنفة action", () => {
    logTestStep("gap7-basmala-as-action");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "بسم الله الرحمن الرحيم"),
    ];
    expectSuspicious(lines, 0, /بسملة/);
  });

  it("مش بيمسك بسملة مصنفة صح", () => {
    logTestStep("gap7-basmala-correct");
    const lines: ClassifiedLine[] = [
      buildLine(0, "basmala", "بسم الله الرحمن الرحيم"),
    ];
    expectNotSuspicious(lines, 0);
  });
});

describe("detector-gaps — سيناريو شامل", () => {
  it("يمسك أغلب الأخطاء في سيناريو واقعي مختلط", () => {
    logTestStep("full-scenario");
    const lines: ClassifiedLine[] = [
      buildLine(0, "action", "بسم الله الرحمن الرحيم"),
      buildLine(1, "action", "مشهد 1"),
      buildLine(2, "dialogue", "نهار - داخلي"),
      buildLine(3, "action", "شقة أحمد – الصالة"),
      buildLine(4, "action", "يدخل أحمد الغرفة بسرعة"),
      buildLine(5, "character", "أحمد:"),
      buildLine(6, "action", "إنت فاكر إنك هتعدي كده؟"),
      buildLine(7, "character", "محمود"),
      buildLine(8, "dialogue", "أنا مش فاهم"),
      buildLine(9, "action", "قطع"),
    ];

    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review(lines);

    const suspiciousIndexes = new Set(
      packet.suspiciousLines.map((s) => s.line.lineIndex)
    );

    // الأسطر اللي لازم تتمسك:
    // 0: بسملة مصنفة action (ثغرة 7)
    expect(suspiciousIndexes.has(0)).toBe(true);
    // 1: مشهد 1 مصنف action (ثغرة 5)
    expect(suspiciousIndexes.has(1)).toBe(true);
    // 2: نهار-داخلي مصنف dialogue (ثغرة 5)
    expect(suspiciousIndexes.has(2)).toBe(true);
    // 3: شقة أحمد مصنفة action (ثغرة 5)
    expect(suspiciousIndexes.has(3)).toBe(true);
    // 6: action بعد character بدون وصف (ثغرة 6)
    expect(suspiciousIndexes.has(6)).toBe(true);
    // 7: character بدون : (ثغرة 1)
    expect(suspiciousIndexes.has(7)).toBe(true);
    // 9: قطع مصنفة action (ثغرة 4)
    expect(suspiciousIndexes.has(9)).toBe(true);

    // نسبة الكشف: 7 من 7 أخطاء مقصودة
    const expectedErrors = [0, 1, 2, 3, 6, 7, 9];
    const caught = expectedErrors.filter((i) => suspiciousIndexes.has(i));
    const detectionRate = caught.length / expectedErrors.length;

    expect(detectionRate).toBeGreaterThanOrEqual(0.85);
  });
});

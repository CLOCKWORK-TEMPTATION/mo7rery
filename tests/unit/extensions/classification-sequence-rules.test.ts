/**
 * اختبارات شاملة — classification-sequence-rules.ts
 * تغطي: خريطة التسلسلات الصالحة، درجات خطورة الانتهاكات، ودالة اقتراح النوع.
 */
import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_VALID_SEQUENCES,
  CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY,
  suggestTypeFromClassificationSequence,
  type ClassificationSequenceSuggestionFeatures,
} from "../../../src/extensions/classification-sequence-rules";

/* ═══════════════════════════════════════════════════════════════
   مساعد — خصائص افتراضية لـ features
   ═══════════════════════════════════════════════════════════════ */
const defaultFeatures: ClassificationSequenceSuggestionFeatures = {
  isParenthetical: false,
  endsWithColon: false,
  wordCount: 5,
  hasPunctuation: false,
  startsWithDash: false,
  hasActionIndicators: false,
};

const withFeatures = (
  overrides: Partial<ClassificationSequenceSuggestionFeatures>
): ClassificationSequenceSuggestionFeatures => ({
  ...defaultFeatures,
  ...overrides,
});

/* ═══════════════════════════════════════════════════════════════
   1. CLASSIFICATION_VALID_SEQUENCES — بنية الخريطة وصحة التسلسلات
   ═══════════════════════════════════════════════════════════════ */
describe("CLASSIFICATION_VALID_SEQUENCES", () => {
  it("خريطة من نوع Map وغير فارغة", () => {
    expect(CLASSIFICATION_VALID_SEQUENCES).toBeInstanceOf(Map);
    expect(CLASSIFICATION_VALID_SEQUENCES.size).toBeGreaterThan(0);
  });

  it("تحتوي جميع أنواع العناصر الأساسية", () => {
    const expectedKeys = [
      "character",
      "parenthetical",
      "dialogue",
      "action",
      "transition",
      "scene-header-top-line",
      "scene-header-1",
      "scene-header-2",
      "scene-header-3",
      "basmala",
    ];

    for (const key of expectedKeys) {
      expect(
        CLASSIFICATION_VALID_SEQUENCES.has(key),
        `المفتاح '${key}' يجب أن يكون موجوداً`
      ).toBe(true);
    }
  });

  it("كل قيمة هي Set غير فارغ", () => {
    for (const [key, value] of CLASSIFICATION_VALID_SEQUENCES) {
      expect(value, `قيمة '${key}' يجب أن تكون Set`).toBeInstanceOf(Set);
      expect(
        value.size,
        `Set لـ '${key}' يجب أن يحتوي عنصراً واحداً على الأقل`
      ).toBeGreaterThan(0);
    }
  });

  /* — تسلسلات character — */
  describe("character →", () => {
    it("يسمح بـ dialogue و parenthetical فقط", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("character")!;
      expect(allowed.has("dialogue")).toBe(true);
      expect(allowed.has("parenthetical")).toBe(true);
      expect(allowed.size).toBe(2);
    });

    it("لا يسمح بـ action بعد character", () => {
      expect(
        CLASSIFICATION_VALID_SEQUENCES.get("character")!.has("action")
      ).toBe(false);
    });

    it("لا يسمح بـ character بعد character", () => {
      expect(
        CLASSIFICATION_VALID_SEQUENCES.get("character")!.has("character")
      ).toBe(false);
    });
  });

  /* — تسلسلات parenthetical — */
  describe("parenthetical →", () => {
    it("يسمح بـ dialogue فقط", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("parenthetical")!;
      expect(allowed.has("dialogue")).toBe(true);
      expect(allowed.size).toBe(1);
    });
  });

  /* — تسلسلات dialogue — */
  describe("dialogue →", () => {
    it("يسمح بـ dialogue, action, character, transition, parenthetical", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("dialogue")!;
      expect(allowed.has("dialogue")).toBe(true);
      expect(allowed.has("action")).toBe(true);
      expect(allowed.has("character")).toBe(true);
      expect(allowed.has("transition")).toBe(true);
      expect(allowed.has("parenthetical")).toBe(true);
    });
  });

  /* — تسلسلات action — */
  describe("action →", () => {
    it("يسمح بـ action, character, transition, scene-header-1, scene-header-top-line", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("action")!;
      expect(allowed.has("action")).toBe(true);
      expect(allowed.has("character")).toBe(true);
      expect(allowed.has("transition")).toBe(true);
      expect(allowed.has("scene-header-1")).toBe(true);
      expect(allowed.has("scene-header-top-line")).toBe(true);
    });

    it("لا يسمح بـ dialogue مباشرة بعد action", () => {
      expect(
        CLASSIFICATION_VALID_SEQUENCES.get("action")!.has("dialogue")
      ).toBe(false);
    });
  });

  /* — تسلسلات transition — */
  describe("transition →", () => {
    it("يسمح بـ scene-header-1, scene-header-top-line, action", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("transition")!;
      expect(allowed.has("scene-header-1")).toBe(true);
      expect(allowed.has("scene-header-top-line")).toBe(true);
      expect(allowed.has("action")).toBe(true);
    });

    it("لا يسمح بـ dialogue بعد transition", () => {
      expect(
        CLASSIFICATION_VALID_SEQUENCES.get("transition")!.has("dialogue")
      ).toBe(false);
    });
  });

  /* — تسلسلات scene headers — */
  describe("scene-header-1 →", () => {
    it("يسمح بـ scene-header-2, scene-header-3, action, scene-header-top-line", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("scene-header-1")!;
      expect(allowed.has("scene-header-2")).toBe(true);
      expect(allowed.has("scene-header-3")).toBe(true);
      expect(allowed.has("action")).toBe(true);
      expect(allowed.has("scene-header-top-line")).toBe(true);
    });
  });

  describe("scene-header-2 →", () => {
    it("يسمح بـ scene-header-3, action", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("scene-header-2")!;
      expect(allowed.has("scene-header-3")).toBe(true);
      expect(allowed.has("action")).toBe(true);
      expect(allowed.size).toBe(2);
    });
  });

  describe("scene-header-3 →", () => {
    it("يسمح بـ action, character", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("scene-header-3")!;
      expect(allowed.has("action")).toBe(true);
      expect(allowed.has("character")).toBe(true);
      expect(allowed.size).toBe(2);
    });
  });

  /* — تسلسلات basmala — */
  describe("basmala →", () => {
    it("يسمح بـ scene-header-top-line, scene-header-1, action, character", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get("basmala")!;
      expect(allowed.has("scene-header-top-line")).toBe(true);
      expect(allowed.has("scene-header-1")).toBe(true);
      expect(allowed.has("action")).toBe(true);
      expect(allowed.has("character")).toBe(true);
    });
  });

  /* — تسلسلات scene-header-top-line — */
  describe("scene-header-top-line →", () => {
    it("يسمح بـ action, character, transition, scene-header-1, scene-header-top-line", () => {
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get(
        "scene-header-top-line"
      )!;
      expect(allowed.has("action")).toBe(true);
      expect(allowed.has("character")).toBe(true);
      expect(allowed.has("transition")).toBe(true);
      expect(allowed.has("scene-header-1")).toBe(true);
      expect(allowed.has("scene-header-top-line")).toBe(true);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   2. CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY — درجات الخطورة
   ═══════════════════════════════════════════════════════════════ */
describe("CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY", () => {
  it("خريطة من نوع Map وغير فارغة", () => {
    expect(CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY).toBeInstanceOf(Map);
    expect(CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.size).toBeGreaterThan(0);
  });

  it("كل الدرجات أرقام بين 0 و 100", () => {
    for (const [key, severity] of CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY) {
      expect(typeof severity, `قيمة '${key}' يجب أن تكون رقماً`).toBe("number");
      expect(severity, `درجة '${key}' يجب أن تكون ≥ 0`).toBeGreaterThanOrEqual(
        0
      );
      expect(severity, `درجة '${key}' يجب أن تكون ≤ 100`).toBeLessThanOrEqual(
        100
      );
    }
  });

  it("المفاتيح بصيغة 'type→type'", () => {
    for (const key of CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.keys()) {
      expect(key, `المفتاح '${key}' يجب أن يحتوي '→'`).toContain("→");
      const parts = key.split("→");
      expect(parts.length, `المفتاح '${key}' يجب أن يحتوي جزئين بالضبط`).toBe(
        2
      );
    }
  });

  /* — درجات خطورة محددة — */
  it("character→character بأعلى خطورة (95)", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("character→character")
    ).toBe(95);
  });

  it("parenthetical→action بخطورة 90", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("parenthetical→action")
    ).toBe(90);
  });

  it("parenthetical→character بخطورة 90", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("parenthetical→character")
    ).toBe(90);
  });

  it("parenthetical→transition بخطورة 90", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("parenthetical→transition")
    ).toBe(90);
  });

  it("transition→dialogue بخطورة 80", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("transition→dialogue")
    ).toBe(80);
  });

  it("transition→character بخطورة 75", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("transition→character")
    ).toBe(75);
  });

  it("scene-header→dialogue بخطورة 70 لجميع مستويات الرأس", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("scene-header-1→dialogue")
    ).toBe(70);
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("scene-header-2→dialogue")
    ).toBe(70);
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("scene-header-3→dialogue")
    ).toBe(70);
  });

  it("الانتهاكات المرتبطة بالخطورة مرتبة: character→character > parenthetical→* > transition→dialogue", () => {
    const charChar = CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get(
      "character→character"
    )!;
    const parentAction = CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get(
      "parenthetical→action"
    )!;
    const transDialogue = CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get(
      "transition→dialogue"
    )!;

    expect(charChar).toBeGreaterThan(parentAction);
    expect(parentAction).toBeGreaterThan(transDialogue);
  });

  it("انتهاكات غير موجودة تُرجع undefined", () => {
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("action→action")
    ).toBeUndefined();
    expect(
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("dialogue→dialogue")
    ).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════
   3. suggestTypeFromClassificationSequence — دالة الاقتراح
   ═══════════════════════════════════════════════════════════════ */
describe("suggestTypeFromClassificationSequence", () => {
  /* — prevType: character — */
  describe("بعد character", () => {
    it("يقترح parenthetical إذا كان السطر parenthetical", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "character",
          withFeatures({ isParenthetical: true })
        )
      ).toBe("parenthetical");
    });

    it("يقترح dialogue إذا لم يكن parenthetical", () => {
      expect(
        suggestTypeFromClassificationSequence("character", defaultFeatures)
      ).toBe("dialogue");
    });

    it("يقترح dialogue حتى مع endsWithColon", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "character",
          withFeatures({ endsWithColon: true })
        )
      ).toBe("dialogue");
    });

    it("يقترح parenthetical بغض النظر عن الخصائص الأخرى", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "character",
          withFeatures({
            isParenthetical: true,
            startsWithDash: true,
            hasActionIndicators: true,
          })
        )
      ).toBe("parenthetical");
    });
  });

  /* — prevType: parenthetical — */
  describe("بعد parenthetical", () => {
    it("يقترح dialogue دائماً", () => {
      expect(
        suggestTypeFromClassificationSequence("parenthetical", defaultFeatures)
      ).toBe("dialogue");
    });

    it("يقترح dialogue بغض النظر عن الخصائص", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "parenthetical",
          withFeatures({
            startsWithDash: true,
            hasActionIndicators: true,
            endsWithColon: true,
          })
        )
      ).toBe("dialogue");
    });
  });

  /* — prevType: dialogue — */
  describe("بعد dialogue", () => {
    it("يقترح action إذا يبدأ بشرطة", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ startsWithDash: true })
        )
      ).toBe("action");
    });

    it("يقترح action إذا يحتوي مؤشرات وصف", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ hasActionIndicators: true })
        )
      ).toBe("action");
    });

    it("يقترح action إذا يبدأ بشرطة ويحتوي مؤشرات وصف", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ startsWithDash: true, hasActionIndicators: true })
        )
      ).toBe("action");
    });

    it("يقترح character إذا ينتهي بنقطتين", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ endsWithColon: true })
        )
      ).toBe("character");
    });

    it("يقترح character إذا كان قصيراً (≤3 كلمات) بدون ترقيم", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ wordCount: 2, hasPunctuation: false })
        )
      ).toBe("character");
    });

    it("يقترح character لكلمة واحدة بدون ترقيم", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ wordCount: 1, hasPunctuation: false })
        )
      ).toBe("character");
    });

    it("يقترح action لسطر قصير مع ترقيم (ليس character)", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ wordCount: 2, hasPunctuation: true })
        )
      ).toBe("action");
    });

    it("يقترح action لسطر طويل بدون مؤشرات خاصة", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ wordCount: 10 })
        )
      ).toBe("action");
    });

    it("يقترح action كافتراضي بعد dialogue", () => {
      expect(
        suggestTypeFromClassificationSequence("dialogue", defaultFeatures)
      ).toBe("action");
    });

    it("الشرطة تأخذ أولوية على endsWithColon", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({ startsWithDash: true, endsWithColon: true })
        )
      ).toBe("action");
    });

    it("مؤشرات الوصف تأخذ أولوية على wordCount المنخفض", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "dialogue",
          withFeatures({
            hasActionIndicators: true,
            wordCount: 1,
            hasPunctuation: false,
          })
        )
      ).toBe("action");
    });
  });

  /* — prevType: transition — */
  describe("بعد transition", () => {
    it("يقترح scene-header-1 دائماً", () => {
      expect(
        suggestTypeFromClassificationSequence("transition", defaultFeatures)
      ).toBe("scene-header-1");
    });

    it("يقترح scene-header-1 بغض النظر عن الخصائص", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "transition",
          withFeatures({ startsWithDash: true, endsWithColon: true })
        )
      ).toBe("scene-header-1");
    });
  });

  /* — prevType: scene headers — */
  describe("بعد scene-header-1", () => {
    it("يقترح scene-header-2", () => {
      expect(
        suggestTypeFromClassificationSequence("scene-header-1", defaultFeatures)
      ).toBe("scene-header-2");
    });
  });

  describe("بعد scene-header-2", () => {
    it("يقترح scene-header-3", () => {
      expect(
        suggestTypeFromClassificationSequence("scene-header-2", defaultFeatures)
      ).toBe("scene-header-3");
    });
  });

  describe("بعد scene-header-3", () => {
    it("يقترح action", () => {
      expect(
        suggestTypeFromClassificationSequence("scene-header-3", defaultFeatures)
      ).toBe("action");
    });
  });

  /* — prevType: أنواع غير معروفة — */
  describe("أنواع غير مغطاة", () => {
    it("يُرجع null لنوع غير موجود", () => {
      expect(
        suggestTypeFromClassificationSequence("unknown-type", defaultFeatures)
      ).toBeNull();
    });

    it("يُرجع null لنوع action", () => {
      expect(
        suggestTypeFromClassificationSequence("action", defaultFeatures)
      ).toBeNull();
    });

    it("يُرجع null لنوع basmala", () => {
      expect(
        suggestTypeFromClassificationSequence("basmala", defaultFeatures)
      ).toBeNull();
    });

    it("يُرجع null لنوع scene-header-top-line", () => {
      expect(
        suggestTypeFromClassificationSequence(
          "scene-header-top-line",
          defaultFeatures
        )
      ).toBeNull();
    });

    it("يُرجع null لسلسلة فارغة", () => {
      expect(
        suggestTypeFromClassificationSequence("", defaultFeatures)
      ).toBeNull();
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   4. اتساق بين الخرائط — تحقق تكاملي
   ═══════════════════════════════════════════════════════════════ */
describe("اتساق بين VALID_SEQUENCES و VIOLATION_SEVERITY", () => {
  it("انتهاكات غير صالحة تماماً يجب ألا تكون في VALID_SEQUENCES", () => {
    // بعض التسلسلات مسجلة كـ "مشبوهة" رغم أنها صالحة تقنياً
    // (مثل scene-header-1→action) — هذا تصميم مقصود لكشف التسلسلات المشكوك فيها.
    // نتحقق فقط من الانتهاكات ذات الخطورة العالية (≥ 80) التي يجب أن تكون غير صالحة.
    const strictViolations = [
      "character→character",
      "parenthetical→action",
      "parenthetical→character",
      "parenthetical→transition",
      "transition→dialogue",
    ];

    for (const key of strictViolations) {
      const [from, to] = key.split("→");
      const allowed = CLASSIFICATION_VALID_SEQUENCES.get(from!);
      if (allowed) {
        expect(
          allowed.has(to!),
          `'${key}' بخطورة عالية ويجب أن يكون غير صالح في VALID_SEQUENCES`
        ).toBe(false);
      }
    }
  });

  it("بعض الانتهاكات تمثل تسلسلات صالحة لكن مشبوهة", () => {
    // scene-header-1→action صالح تقنياً لكن مسجل بخطورة لأنه يتخطى header-2/3
    const suspiciousButValid = [
      "scene-header-1→action",
      "scene-header-2→action",
    ];

    for (const key of suspiciousButValid) {
      const [from, to] = key.split("→");
      expect(
        CLASSIFICATION_VALID_SEQUENCES.get(from!)?.has(to!),
        `'${key}' يجب أن يكون صالحاً في VALID_SEQUENCES`
      ).toBe(true);
      expect(
        CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.has(key),
        `'${key}' يجب أن يكون مسجلاً في VIOLATION_SEVERITY`
      ).toBe(true);
    }
  });

  it("الاقتراحات من suggestType تنتج دائماً تسلسلات صالحة", () => {
    const testPrevTypes = [
      "character",
      "parenthetical",
      "dialogue",
      "transition",
      "scene-header-1",
      "scene-header-2",
      "scene-header-3",
    ];

    const featureVariations: ClassificationSequenceSuggestionFeatures[] = [
      defaultFeatures,
      withFeatures({ isParenthetical: true }),
      withFeatures({ startsWithDash: true }),
      withFeatures({ hasActionIndicators: true }),
      withFeatures({ endsWithColon: true }),
      withFeatures({ wordCount: 1, hasPunctuation: false }),
      withFeatures({ wordCount: 10, hasPunctuation: true }),
    ];

    for (const prevType of testPrevTypes) {
      for (const features of featureVariations) {
        const suggestion = suggestTypeFromClassificationSequence(
          prevType,
          features
        );

        if (suggestion !== null) {
          const allowed = CLASSIFICATION_VALID_SEQUENCES.get(prevType);
          if (allowed) {
            expect(
              allowed.has(suggestion),
              `اقتراح '${suggestion}' بعد '${prevType}' غير موجود في VALID_SEQUENCES`
            ).toBe(true);
          }
        }
      }
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   5. حالات حدودية — Edge Cases
   ═══════════════════════════════════════════════════════════════ */
describe("Edge cases", () => {
  it("VALID_SEQUENCES هي ReadonlyMap (غير قابلة للتعديل عبر الواجهة)", () => {
    // نتحقق أن الخريطة لا تسمح بإضافة عناصر عبر TypeScript type system
    // في وقت التشغيل نتحقق من نوعها
    expect(CLASSIFICATION_VALID_SEQUENCES).toBeInstanceOf(Map);
  });

  it("VIOLATION_SEVERITY هي ReadonlyMap", () => {
    expect(CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY).toBeInstanceOf(Map);
  });

  it("dialogue → character: الحد الأقصى لعدد الكلمات هو 3", () => {
    // wordCount = 3 بدون ترقيم → character
    expect(
      suggestTypeFromClassificationSequence(
        "dialogue",
        withFeatures({ wordCount: 3, hasPunctuation: false })
      )
    ).toBe("character");

    // wordCount = 4 بدون ترقيم → action (تجاوز الحد)
    expect(
      suggestTypeFromClassificationSequence(
        "dialogue",
        withFeatures({ wordCount: 4, hasPunctuation: false })
      )
    ).toBe("action");
  });

  it("dialogue → character: wordCount = 0 يُعامل كـ character", () => {
    expect(
      suggestTypeFromClassificationSequence(
        "dialogue",
        withFeatures({ wordCount: 0, hasPunctuation: false })
      )
    ).toBe("character");
  });

  it("تسلسل رؤوس المشاهد الكامل: 1 → 2 → 3 → action", () => {
    expect(
      suggestTypeFromClassificationSequence("scene-header-1", defaultFeatures)
    ).toBe("scene-header-2");
    expect(
      suggestTypeFromClassificationSequence("scene-header-2", defaultFeatures)
    ).toBe("scene-header-3");
    expect(
      suggestTypeFromClassificationSequence("scene-header-3", defaultFeatures)
    ).toBe("action");
  });

  it("تسلسل الحوار الكامل: character → dialogue → character → dialogue", () => {
    const step1 = suggestTypeFromClassificationSequence(
      "character",
      defaultFeatures
    );
    expect(step1).toBe("dialogue");

    const step2 = suggestTypeFromClassificationSequence(
      "dialogue",
      withFeatures({ wordCount: 1, hasPunctuation: false })
    );
    expect(step2).toBe("character");

    const step3 = suggestTypeFromClassificationSequence(
      "character",
      defaultFeatures
    );
    expect(step3).toBe("dialogue");
  });
});

/**
 * اختبارات metrics.ts
 * يختبر دوال قياس المسافة بين النصوص (Levenshtein distance)
 */
import { describe, expect, it } from "vitest";
import { levenshtein, editDistanceRatio } from "../../../src/pipeline/metrics";

describe("levenshtein", () => {
  describe("الحالات الأساسية", () => {
    it("يعيد 0 للنصوص المتطابقة", () => {
      expect(levenshtein("hello", "hello")).toBe(0);
      expect(levenshtein("مرحبا", "مرحبا")).toBe(0);
      expect(levenshtein("", "")).toBe(0);
    });

    it("يعيد طول النص الثاني عندما يكون الأول فارغاً", () => {
      expect(levenshtein("", "hello")).toBe(5);
      expect(levenshtein("", "abc")).toBe(3);
      expect(levenshtein("", "مرحبا")).toBe(5);
    });

    it("يعيد طول النص الأول عندما يكون الثاني فارغاً", () => {
      expect(levenshtein("hello", "")).toBe(5);
      expect(levenshtein("abc", "")).toBe(3);
      expect(levenshtein("مرحبا", "")).toBe(5);
    });
  });

  describe("عمليات التحرير الأساسية", () => {
    it("يحسب الإدراج (insertion)", () => {
      expect(levenshtein("hel", "hell")).toBe(1);
      expect(levenshtein("cat", "cats")).toBe(1);
      expect(levenshtein("car", "cart")).toBe(1);
    });

    it("يحسب الحذف (deletion)", () => {
      expect(levenshtein("hell", "hel")).toBe(1);
      expect(levenshtein("cats", "cat")).toBe(1);
      expect(levenshtein("cart", "car")).toBe(1);
    });

    it("يحسب الاستبدال (substitution)", () => {
      expect(levenshtein("cat", "cut")).toBe(1);
      expect(levenshtein("hello", "hallo")).toBe(1);
      expect(levenshtein("كتاب", "كثاب")).toBe(1);
    });

    it("يحسب عدة عمليات متتالية", () => {
      // استبدال + إدراج
      expect(levenshtein("cat", "cut")).toBe(1);
      // إدراجان
      expect(levenshtein("car", "carte")).toBe(2);
      // حذفان
      expect(levenshtein("hello", "he")).toBe(3);
    });
  });

  describe("النصوص العربية", () => {
    it("يحسب المسافة للنصوص العربية المتطابقة", () => {
      expect(levenshtein("مرحبا", "مرحبا")).toBe(0);
      expect(levenshtein("بسم الله", "بسم الله")).toBe(0);
    });

    it("يحسب الإدراج في النص العربي", () => {
      // "مرحبا" (5) → "مرحبا يا" (8): +3 (space + ي + ا)
      expect(levenshtein("مرحبا", "مرحبا يا")).toBe(3);
      // "كتاب" (4) → "الكتاب" (6): +2 (ال)
      expect(levenshtein("كتاب", "الكتاب")).toBe(2);
    });

    it("يحسب الحذف في النص العربي", () => {
      // "مرحبا يا" (8) → "مرحبا" (5): -3 (space + ي + ا)
      expect(levenshtein("مرحبا يا", "مرحبا")).toBe(3);
      // "الكتاب" (6) → "كتاب" (4): -2 (ال)
      expect(levenshtein("الكتاب", "كتاب")).toBe(2);
    });

    it("يحسب الاستبدال في النص العربي", () => {
      expect(levenshtein("مرحبا", "مرحبي")).toBe(1); // ا ← ي
      expect(levenshtein("كتاب", "كثاب")).toBe(1); // ت ← ث
    });

    it("يحسب المسافة لنصوص سيناريو عربية", () => {
      // "يدخل أحمد" → "يخرج أحمد": 3 عمليات (د→خ, ل→ر, ج+ )
      expect(levenshtein("يدخل أحمد", "يخرج أحمد")).toBe(3);
      // "مشهد داخلي" → "مشهد خارجي": 3 عمليات (د→خ, ا+ , ل← ج)
      expect(levenshtein("مشهد داخلي", "مشهد خارجي")).toBe(3);
    });
  });

  describe("الحالات الخاصة والمعقدة", () => {
    it("يعامل الأحرف الكبيرة والصغيرة بشكل مختلف (case-sensitive)", () => {
      expect(levenshtein("Hello", "hello")).toBe(1);
      expect(levenshtein("CAT", "cat")).toBe(3);
    });

    it("يحسب المسافة للنصوص الطويلة", () => {
      const a = "السلام عليكم ورحمة الله وبركاته";
      const b = "السلام عليكم ورحمة الله";
      // " وبركاته" = مسافة + 7 أحرف = 8 أحرف
      expect(levenshtein(a, b)).toBe(8);
    });

    it("يحسب المسافة للنصوص مع أرقام ورموز", () => {
      expect(levenshtein("scene-12", "scene-13")).toBe(1);
      expect(levenshtein("2024-02-24", "2024-02-25")).toBe(1);
      expect(levenshtein("price: $50", "price: $500")).toBe(1);
    });

    it("يحسب المسافة للنصوص المتشابهة جزئياً", () => {
      expect(levenshtein("kitten", "sitting")).toBe(3);
      // kitten → sitten (استبدال)
      // sitten → sittin (استبدال)
      // sittin → sitting (إدراج)
    });

    it("يحسب المسافة لنصوص متشابهة في البداية مختلفة في النهاية", () => {
      // "أحمد يدخل" → "أحمد يخرج": 3 عمليات (د→خ, ل→ر, ج+ )
      expect(levenshtein("أحمد يدخل", "أحمد يخرج")).toBe(3);
    });

    it("يحسب المسافة لنصوص مختلفة تماماً", () => {
      expect(levenshtein("abc", "xyz")).toBe(3);
      expect(levenshtein("hello", "world")).toBe(4);
    });
  });

  describe("أحرف Unicode خاصة", () => {
    it("يتعامل مع التشكيل العربي كأحرف منفصلة", () => {
      // التشكيل يُعتبر أحرفاً منفصلة في Unicode
      expect(levenshtein("كتاب", "كِتاب")).toBe(1); // إضافة كسرة
      expect(levenshtein("مَكتَب", "مكتب")).toBe(2); // حذف فتحتين
    });

    it("يتعامل مع الرموز الإيموجي", () => {
      expect(levenshtein("hello", "hello👋")).toBe(2); // إضافة إيموجي
      expect(levenshtein("🎬🎭", "🎬")).toBe(2); // حذف إيموجي
    });

    it("يتعامل مع المسافات البيضاء المختلفة", () => {
      expect(levenshtein("hello world", "hello  world")).toBe(1); // مسافة إضافية
      expect(levenshtein("hello\tworld", "hello world")).toBe(1); // تبويب ← مسافة
    });
  });

  describe("أداء الخوارزمية", () => {
    it("يحسب المسافة بكفاءة للنصوص المتوسطة الطول", () => {
      const text1 = "هذا نص متوسط الطول للاختبار";
      const text2 = "هذا نص مختلف قليلاً للاختبار";
      const start = Date.now();
      const distance = levenshtein(text1, text2);
      const duration = Date.now() - start;

      // "هذا نص " متطابق، ثم اختلاف "متوسط" vs "مختلف قليلاً"، ثم " الطول للاختبار" vs " للاختبار"
      expect(distance).toBe(9);
      expect(duration).toBeLessThan(100); // يجب أن يكون سريعاً
    });
  });
});

describe("editDistanceRatio", () => {
  describe("الحالات الأساسية", () => {
    it("يعيد 0 للنصوص المتطابقة", () => {
      expect(editDistanceRatio("hello", "hello")).toBe(0);
      expect(editDistanceRatio("", "")).toBe(0);
      expect(editDistanceRatio("مرحبا", "مرحبا")).toBe(0);
    });

    it("يعيد 1 عندما يكون النص الأول فارغاً والثاني غير فارغ", () => {
      expect(editDistanceRatio("", "hello")).toBe(1);
      expect(editDistanceRatio("", "a")).toBe(1);
    });

    it("يعيد 1 عندما يكون النص الثاني فارغاً والأول غير فارغ", () => {
      expect(editDistanceRatio("hello", "")).toBe(1);
      expect(editDistanceRatio("abc", "")).toBe(1);
    });
  });

  describe("النسب المنطقية", () => {
    it("يعيد نسبة 0.5 للنصوص التي تحتاج لتحرير نصف أحرفها", () => {
      // "ab" → "ac": مسافة 1، أقصى طول 2، النسبة = 0.5
      expect(editDistanceRatio("ab", "ac")).toBe(0.5);
    });

    it("يعيد نسبة صحيحة للتحريرات الجزئية", () => {
      // "hello" → "hallo": مسافة 1، أقصى طول 5، النسبة = 0.2
      expect(editDistanceRatio("hello", "hallo")).toBe(0.2);
    });

    it("يعيد نسبة صحيحة للنصوص المختلفة في الطول", () => {
      // "car" → "cart": مسافة 1، أقصى طول 4، النسبة = 0.25
      expect(editDistanceRatio("car", "cart")).toBe(0.25);
    });
  });

  describe("النصوص العربية", () => {
    it("يحسب النسبة للنصوص العربية", () => {
      // "مرحبا" (5) → "مرحبا يا" (8): مسافة 3، أقصى طول 8، النسبة = 0.375
      expect(editDistanceRatio("مرحبا", "مرحبا يا")).toBe(0.375);
    });

    it("يحسب النسبة للنصوص السيناريو العربية", () => {
      const original = "يدخل أحمد إلى الغرفة";
      const modified = "يخرج أحمد من الغرفة";
      const ratio = editDistanceRatio(original, modified);

      // التحقق من أن النسبة بين 0 و 1
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1);
    });
  });

  describe("الحالات الحدية", () => {
    it("يتعامل مع نص واحد حرف", () => {
      expect(editDistanceRatio("a", "a")).toBe(0);
      expect(editDistanceRatio("a", "b")).toBe(1);
      expect(editDistanceRatio("a", "")).toBe(1);
      expect(editDistanceRatio("", "a")).toBe(1);
    });

    it("يعيد قيماً بين 0 و 1 دائماً", () => {
      const testCases = [
        ["hello", "world"],
        ["كتاب", "مكتبة"],
        ["12345", "123"],
        ["abcde", "edcba"],
      ];

      for (const [a, b] of testCases) {
        const ratio = editDistanceRatio(a, b);
        expect(ratio).toBeGreaterThanOrEqual(0);
        expect(ratio).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("الاستخدامات العملية", () => {
    it("يُستخدم للكشف عن التشابه الشديد (نسبة < 0.2)", () => {
      // نصوص متشابهة جداً
      expect(editDistanceRatio("hello world", "hello worlds")).toBeLessThan(
        0.2
      );
      // "أحمد" (4) → "أحمد يدخل" (10): مسافة 6، أقصى طول 10، النسبة = 0.6
      // هذه النسبة ليست < 0.2 لذا نختبر نصاً أقرب
      expect(editDistanceRatio("أحمد", "أحمد.")).toBeLessThanOrEqual(0.2);
    });

    it("يُستخدم للكشف عن الاختلاف الكبير (نسبة > 0.5)", () => {
      // نصوص مختلفة كثيراً
      expect(editDistanceRatio("hello", "goodbye")).toBeGreaterThan(0.5);
      expect(editDistanceRatio("cat", "elephant")).toBeGreaterThan(0.5);
    });

    it("يساعد في تحديد حاجة النص للتصحيح", () => {
      const original = "أحمد يدخل إلى المشهد";
      const ocrResult = "أحمد يدخل إلي المشهد"; // خطأ إملائي شائع
      const ratio = editDistanceRatio(original, ocrResult);

      // اختلاف بسيط يمكن تصحيحه تلقائياً
      expect(ratio).toBeLessThan(0.1);
    });
  });
});

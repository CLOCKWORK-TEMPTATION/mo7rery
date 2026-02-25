## خطة حاسمة: مسار PDF واحد فقط (الجديد) وتفعيله فعليًا

> **الإصدار:** 2.0  
> **الحالة:** قيد التنفيذ  
> **آخر تحديث:** 2026-02-24  
> **المسؤول:** فريق التطوير

---

## جدول المحتويات

1. [الملخص التنفيذي](#الملخص-التنفيذي)
2. [القرارات المقفولة](#القرارات-المقفولة)
3. [التعديلات التنفيذية](#التعديلات-التنفيذية)
4. [تغييرات الواجهات والعقود](#تغييرات-الواجهات-والعقود)
5. [نظام التسجيل (Logging)](#نظام-التسجيل-logging)
6. [سيناريوهات التحقق](#سيناريوهات-التحقق)
7. [إدارة المخاطر](#إدارة-المخاطر)
8. [خطة الطوارئ](#خطة-الطوارئ)

---

## الملخص التنفيذي

### الهدف

تحويل فتح PDF إلى مسار واحد إلزامي: **Selective OCR Fallback Pipeline**، مع إزالة كاملة للمسار القديم.

### المبادئ التوجيهية

| المبدأ           | الوصف                                                             |
| ---------------- | ----------------------------------------------------------------- |
| **Backend-only** | فتح PDF دائمًا عبر الخادم، بدون أي fallback للمتصفح               |
| **OCR اختياري**  | الاستمرار بدون OCR عند الفشل مع تحذير واضح                        |
| **عزل المسار**   | نطاق العمل: PDF فقط، بدون تغييرات على `doc/docx/txt/fountain/fdx` |

### النطاق

```
✅ مشمول                    ❌ غير مشمول
─────────────────────────────────────────────
PDF extraction pipeline     doc/docx handlers
Backend endpoint changes    txt/fountain/fdx
Frontend PDF branch         agent-review logic
Test updates                Classification pipeline
```

---

## القرارات المقفولة

| القرار          | السياسة              | المبرر                       |
| --------------- | -------------------- | ---------------------------- |
| مسار PDF القديم | **حذف كامل**         | تبسيط الصيانة، إزالة التعقيد |
| فشل OCR         | **استمرار مع تحذير** | تجنب كسر الاستيراد           |
| نطاق العمل      | **PDF فقط**          | تقليل مخاطر الانحدار         |

---

## التعديلات التنفيذية

### 1. توصيل Backend endpoint بالمسار الجديد

**الملف المستهدف:** [`server/file-import-server.mjs`](server/file-import-server.mjs)

#### المهام

| #   | المهمة                                                              | الأولوية  | الحالة |
| --- | ------------------------------------------------------------------- | --------- | ------ |
| 1.1 | استبدال `pdf-textlayer-runner` بـ Runner جديد                       | 🔴 عالية  | ⬜     |
| 1.2 | إزالة `LEGACY_PDF_PIPELINE_ENABLED` و `DISABLE_LEGACY_PDF_PIPELINE` | 🔴 عالية  | ⬜     |
| 1.3 | إنشاء دالة استخراج موحدة                                            | 🔴 عالية  | ⬜     |
| 1.4 | تحديث `SUPPORTED_EXTRACTION_METHODS`                                | 🟡 متوسطة | ⬜     |
| 1.5 | تعديل `/health` endpoint                                            | 🟡 متوسطة | ⬜     |

#### مواصفات دالة الاستخراج الموحدة

```typescript
interface PdfExtractionResult {
  text: string;
  attempts: ExtractionAttempt[];
  warnings: string[];
  usedOcr: boolean;
  traceSummary?: PdfTraceSummary;
}

interface ExtractionAttempt {
  stage: "text-layer" | "ocr-selection" | "ocr-patch";
  method: string;
  success: boolean;
  duration?: number;
}
```

---

### 2. Runner/CLI: تشغيل المسار الجديد

**الملفات المستهدفة:**

- `server/pdf-single-pipeline-runner.mjs` (جديد)
- [`src/cli.ts`](src/cli.ts)

#### المهام

| #   | المهمة                                                    | الأولوية  | الحالة |
| --- | --------------------------------------------------------- | --------- | ------ |
| 2.1 | إنشاء `pdf-single-pipeline-runner.mjs`                    | 🔴 عالية  | ⬜     |
| 2.2 | حذف `pdf-textlayer-runner.mjs`                            | 🔴 عالية  | ⬜     |
| 2.3 | تحديث `cli.ts` لاستخدام `runSelectiveOcrFallbackPipeline` | 🔴 عالية  | ⬜     |
| 2.4 | تفعيل `MistralOcrProvider` شرطيًا                         | 🟡 متوسطة | ⬜     |
| 2.5 | إخراج JSON مع stats كاملة                                 | 🟡 متوسطة | ⬜     |

#### شروط تفعيل OCR

```typescript
// تفعيل OCR فقط عند تحقق جميع الشروط
const shouldUseOcr =
  process.env.OCR_PROVIDER !== "none" &&
  Boolean(process.env.MISTRAL_API_KEY) &&
  (await validateOcrKey(process.env.MISTRAL_API_KEY));
```

#### سلوك الفشل

```typescript
// عند فشل OCR: تحذير وليس استثناء
if (ocrError) {
  warnings.push({
    code: "OCR_UNAVAILABLE",
    message: "OCR provider unavailable, continuing with text-layer only",
    severity: "warning", // ليس 'error'
  });
  // استمرار التنفيذ بدون رمي استثناء
}
```

---

### 3. Frontend: مسار PDF backend-only إلزامي

**الملف المستهدف:** [`src/utils/file-import/extract/index.ts`](src/utils/file-import/extract/index.ts)

#### المهام

| #   | المهمة                                   | الأولوية  | الحالة |
| --- | ---------------------------------------- | --------- | ------ |
| 3.1 | جعل فرع `pdf` backend-only               | 🔴 عالية  | ⬜     |
| 3.2 | حذف fallback المتصفح                     | 🔴 عالية  | ⬜     |
| 3.3 | إزالة `VITE_DISABLE_LEGACY_PDF_PIPELINE` | 🟡 متوسطة | ⬜     |
| 3.4 | تحديث رسائل الخطأ                        | 🟢 منخفضة | ⬜     |

#### رسائل الخطأ الموحدة

```typescript
const PDF_ERROR_MESSAGES = {
  BACKEND_UNAVAILABLE:
    "PDF requires backend service. Please ensure the server is running on port 8787.",
  EXTRACTION_FAILED:
    "PDF extraction failed. The file may be corrupted or password-protected.",
  OCR_UNAVAILABLE:
    "PDF imported successfully. OCR enhancement was unavailable.",
} as const;
```

---

### 4. إزالة PDF Browser pipeline القديم

**الملف المستهدف:** [`src/utils/file-import/extract/browser-extract.ts`](src/utils/file-import/extract/browser-extract.ts)

#### المهام

| #   | المهمة                                      | الأولوية  | الحالة |
| --- | ------------------------------------------- | --------- | ------ |
| 4.1 | إزالة `extractPdfTextLayer`                 | 🔴 عالية  | ⬜     |
| 4.2 | تحديث `isBrowserExtractionSupported("pdf")` | 🔴 عالية  | ⬜     |
| 4.3 | تحديث التعليقات والوثائق                    | 🟢 منخفضة | ⬜     |

#### النتيجة الإيجابية

```
✅ إنهاء warning تضارب dynamic/static import لـ pdfjs-dist
✅ تقليل bundle size بحذف pdfjs-dist من الواجهة
```

---

### 5. تحديث العقود والاختبارات

**الملفات المستهدفة:**

- [`tests/harness/backend-file-extract.contract.test.ts`](tests/harness/backend-file-extract.contract.test.ts)
- [`tests/harness/backend-server-harness.ts`](tests/harness/backend-server-harness.ts)

#### المهام

| #   | المهمة                        | الأولوية  | الحالة |
| --- | ----------------------------- | --------- | ------ |
| 5.1 | تحديث health contract tests   | 🔴 عالية  | ⬜     |
| 5.2 | إضافة اختبار PDF backend-only | 🔴 عالية  | ⬜     |
| 5.3 | الحفاظ على fidelity tests     | 🟡 متوسطة | ⬜     |

#### اختبارات مطلوبة

```typescript
describe("PDF Extraction - Backend Only", () => {
  it("should reject browser extraction for PDF", () => {
    expect(isBrowserExtractionSupported("pdf")).toBe(false);
  });

  it("should fail when backend is unavailable", async () => {
    // محاكاة غياب الخادم
    await expect(extractFile(pdfFile)).rejects.toThrow(/backend/);
  });

  it("should succeed with OCR_PROVIDER=none", async () => {
    process.env.OCR_PROVIDER = "none";
    const result = await extractFile(validPdf);
    expect(result.usedOcr).toBe(false);
    expect(result.text).toBeTruthy();
  });
});
```

---

## تغييرات الواجهات والعقود

### GET /health

**قبل:**

```json
{
  "status": "ok",
  "pdf": {
    "legacyReady": true,
    "textLayerReady": true
  }
}
```

**بعد:**

```json
{
  "status": "ok",
  "pdf": {
    "pipeline": "selective-ocr-fallback",
    "pythonBridge": true,
    "ocrProvider": "mistral" | "none"
  }
}
```

### FileExtractionResult.method

القيم المقبولة للـ PDF:

| القيمة                  | الوصف                      |
| ----------------------- | -------------------------- |
| `pdf-backend-textlayer` | استخراج عبر text-layer فقط |
| `pdf-backend-ocr`       | استخراج مع OCR patches     |

---

## نظام التسجيل (Logging)

### مراحل التسجيل

```
┌─────────────────────────────────────────────────────────────┐
│                    PDF Pipeline Flow                         │
├─────────────────────────────────────────────────────────────┤
│  1. pdf-pipeline-start                                      │
│     ↓                                                        │
│  2. python-bridge-start ──→ python-bridge-done              │
│     ↓                                                        │
│  3. ocr-targets-selected (optional)                         │
│     ↓                                                        │
│  4. ocr-patch-summary (optional)                            │
│     ↓                                                        │
│  5. pdf-pipeline-complete                                   │
└─────────────────────────────────────────────────────────────┘
```

### تنسيق اللوج

#### Server logs (Terminal)

```
[pdf-pipeline] start file=example.pdf size=1.2MB
[pdf-pipeline] python-bridge-start bin=python3 script=extract_pdf_textlayer.py
[pdf-pipeline] python-bridge-done pages=12 methods={pymupdf:10,pdfplumber:2} duration=340ms
[pdf-pipeline] ocr-targets-selected count=3 pages=[4,7,9]
[pdf-pipeline] ocr-patch-summary patched=45 rejected=2
[pdf-pipeline] complete total_lines=892 duration=1.2s
```

#### Browser logs (DevTools)

```javascript
[file-import.extract] telemetry:pdf-pipeline-trace {
  method: "pdf-backend-ocr",
  usedOcr: true,
  attempts: [
    { stage: "text-layer", method: "pymupdf", success: true },
    { stage: "ocr-patch", method: "mistral", success: true }
  ],
  warnings: [],
  traceSummary: {
    pages_total: 12,
    methods_count: { pymupdf: 10, pdfplumber: 2 },
    ocr_pages_requested: 3,
    lines_patched: 45,
    lines_patch_rejected: 2
  }
}
```

### Trace Summary Schema

```typescript
interface PdfTraceSummary {
  pages_total: number;
  methods_count: Record<"pymupdf" | "pdfplumber" | "pdfminer", number>;
  ocr_pages_requested: number;
  ocr_fallback_lines: number;
  lines_patched: number;
  lines_patch_rejected: number;
  duration_ms: number;
}
```

---

## سيناريوهات التحقق

### 1. التحقق الوظيفي

| السيناريو    | المدخلات            | المتوقع                |
| ------------ | ------------------- | ---------------------- |
| PDF بدون OCR | `OCR_PROVIDER=none` | نجاح + `usedOcr=false` |
| PDF مع OCR   | key صالح            | نجاح + patch stats     |
| OCR فاشل     | key خاطئ            | نجاح + warnings        |

### 2. التحقق من عزل المسار

```bash
# التأكد من عدم وجود استدعاءات للمسار القديم
rg "runPdfTextLayerFirstPipeline|extractPdfTextLayer" src/ server/

# يجب أن يكون الناتج فارغًا
```

### 3. التحقق من الجودة

```bash
# تشغيل جميع الاختبارات
pnpm validate

# التحقق من عدم وجود warnings في البناء
pnpm build 2>&1 | grep -i "pdfjs-dist"
# يجب أن يكون الناتج فارغًا
```

---

## إدارة المخاطر

### المخاطر المحتملة

| المخاطرة             | الاحتمالية | التأثير | التخفيف                      |
| -------------------- | ---------- | ------- | ---------------------------- |
| فشل Python bridge    | متوسطة     | عالي    | fallback إلى رسالة خطأ واضحة |
| تأخر استجابة OCR     | متوسطة     | متوسط   | timeout + استمرار بدون OCR   |
| انحدار في الاختبارات | منخفضة     | متوسط   | تشغيل الاختبارات قبل الدمج   |

### نقاط المراقبة

- [ ] جميع اختبارات `pnpm test` تمر
- [ ] لا توجد warnings في `pnpm build`
- [ ] health endpoint يستجيب بشكل صحيح
- [ ] PDF extraction يعمل مع وبدون OCR

---

## خطة الطوارئ

### سيناريو: فشل Python bridge

```typescript
// في file-import-server.mjs
try {
  const result = await runPythonBridge(pdfPath);
  return result;
} catch (error) {
  // تسجيل الخطأ
  logger.error("pdf-pipeline", "Python bridge failed", { error });

  // إرجاع خطأ واضح للمستخدم
  return {
    text: "",
    error: "PDF_EXTRACTION_FAILED",
    message:
      "Unable to extract text from PDF. Please ensure Python 3 is installed.",
    attempts: [{ stage: "text-layer", success: false, error: error.message }],
  };
}
```

### سيناريو: تراجع عن التغييرات

```bash
# في حالة الحاجة للتراجع
git revert <commit-hash>

# أو استخدام feature flag للتبديل السريع
ENABLE_LEGACY_PDF_PIPELINE=true pnpm dev
```

---

## الافتراضات المعتمدة

| #   | الافتراض                                                 | المبرر             |
| --- | -------------------------------------------------------- | ------------------ |
| 1   | "لا تواجد للمسار القديم" = إزالة كاملة من التشغيل والكود | تبسيط الصيانة      |
| 2   | OCR اختياري تحسيني وليس شرط فتح الملف                    | تجنب كسر الاستيراد |
| 3   | مشاكل `agent-review` خارج النطاق                         | عزل المخاطر        |

---

## الملخص النهائي

### ما سيتم تحقيقه

1. ✅ مسار PDF واحد موحد عبر Backend
2. ✅ إزالة كاملة للمسار القديم
3. ✅ نظام تسجيل شامل في Server + Browser
4. ✅ OCR اختياري مع fallback آمن
5. ✅ اختبارات محدثة وشاملة

### ما لن يتم تغييره

- ❌ معالجات `doc/docx/txt/fountain/fdx`
- ❌ منطق `agent-review`
- ❌ بايبلاين التصنيف

---

## المراجع

- [AGENTS.md](.kilocode/rules/AGENTS.md) - قواعد المشروع
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - هيكل المشروع
- [CORE_MECHANISM.md](docs/CORE_MECHANISM.md) - الآلية الأساسية

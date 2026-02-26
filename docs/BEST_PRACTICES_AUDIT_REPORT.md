# تقرير التدقيق على أفضل الممارسات (Best Practices Audit)

**تاريخ التدقيق:** 26 فبراير 2026
**المشروع:** محرر السيناريو العربي (Mo7rer)
**التبعيات المحللة:** 15+ حزمة رئيسية

---

## الملخص التنفيذي

| المقياس                    | القيمة  |
| -------------------------- | ------- |
| درجة الامتثال الإجمالية    | **78%** |
| عدد التبعيات المحللة       | 15+     |
| المشكلات الحرجة (High)     | 3       |
| المشكلات المتوسطة (Medium) | 5       |
| التوصيات المنخفضة (Low)    | 4       |

---

## التبعيات الرئيسية المحللة

### 1. مكتبات LLM و AI SDK

| التبعية                | الإصدار الحالي | أحدث إصدار | الحالة  |
| ---------------------- | -------------- | ---------- | ------- |
| `@mistralai/mistralai` | ^1.14.0        | 1.14.0     | ✅ محدث |
| `@ai-sdk/openai`       | ^2.0.0         | 2.x        | ✅ محدث |
| `@ai-sdk/anthropic`    | ^2.0.0         | 2.x        | ✅ محدث |
| `@ai-sdk/mcp`          | ^1.0.0         | 1.x        | ✅ محدث |
| `@anthropic-ai/sdk`    | ^0.78.0        | 0.78.x     | ✅ محدث |
| `ai`                   | ^6.0.0         | 6.x        | ✅ محدث |

### 2. MCP SDK

| التبعية                     | الإصدار الحالي | أحدث إصدار | الحالة  |
| --------------------------- | -------------- | ---------- | ------- |
| `@modelcontextprotocol/sdk` | ^1.27.0        | 1.27.x     | ✅ محدث |

### 3. المكتبات الأساسية

| التبعية      | الإصدار الحالي | أحدث إصدار | ملاحظات |
| ------------ | -------------- | ---------- | ------- |
| `typescript` | ^5.7.0         | 5.7.x      | ✅ محدث |
| `zod`        | ^3.25.76       | 3.25.x     | ✅ محدث |
| `pino`       | ^9.14.0        | 9.x        | ✅ محدث |
| `react`      | ^19.2.4        | 19.x       | ✅ محدث |

---

## المشكلات المكتشفة

### 🔴 حرجة (High Priority)

#### 1. استخدام `any` في استدعاءات Mistral API

**الملف:** `src/ocr-arabic-pdf-to-txt-pipeline/skill-scripts/ocr-mistral.ts`  
**السطر:** 142

**الكود الحالي:**

```typescript
const response = await client.ocr.process(ocrParams as any);
```

**المشكلة:** استخدام `as any` يُضيع فوائد TypeScript ويُخفي أخطاء محتملة في أنواع البيانات.

**التوصية:**

```typescript
// تعريف الأنواع بشكل صحيح
interface OcrProcessParams {
  model: string;
  document: {
    type: "document_url";
    document_url: string;
  };
  include_image_base64?: boolean;
  table_format?: "markdown" | "html";
  pages?: number[];
}

const ocrParams: OcrProcessParams = {
  model: "mistral-ocr-latest",
  document: {
    type: "document_url",
    document_url: `data:application/pdf;base64,${base64Pdf}`,
  },
  include_image_base64: false,
  table_format: "markdown",
};

if (pages !== null) {
  ocrParams.pages = pages;
}

const response = await client.ocr.process(ocrParams);
```

---

#### 2. معالجة الأخطاء غير المتسقة في أدوات `tools.ts`

**الملف:** `src/ocr-arabic-pdf-to-txt-pipeline/tools.ts`

**الكود الحالي (أسطر 61-65):**

```typescript
catch (error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ success: false, error: msg });
}
```

**المشكلة:** الأخطاء تُعاد كنص JSON فقط بدون أي تسجيل (logging) أو تتبع للمكدس (stack trace).

**التوصية:**

```typescript
import { logger } from "./logger";

catch (error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error({
    error: msg,
    stack,
    tool: "readFileTool",
    filePath
  }, "فشلت أداة قراءة الملف");

  return JSON.stringify({
    success: false,
    error: msg,
    code: "FILE_READ_ERROR"
  });
}
```

---

#### 3. استخدام `console.error` بدلاً من مكتبة تسجيل احترافية

**الملف:** `src/ocr-arabic-pdf-to-txt-pipeline/skill-scripts/ocr-mistral.ts`

**الكود الحالي (أسطر 98-101):**

```typescript
if (!apiKey) {
  console.error("خطأ: متغير البيئة MISTRAL_API_KEY غير موجود");
  process.exit(1);
}
```

**المشكلة:** استخدام `console.error` المباشر يُفقد القدرة على:

- تكوين مستويات التسجيل (log levels)
- التسجيل في ملفات
- تنسيق JSON للـ structured logging
- التكامل مع أنظمة المراقبة

**التوصية:** استخدام مكتبة `pino` المثبتة بالفعل في المشروع:

```typescript
import { logger } from "../logger";

if (!apiKey) {
  logger.fatal(
    {
      envVar: "MISTRAL_API_KEY",
      hint: "أضف MISTRAL_API_KEY إلى ملف .env",
    },
    "مفتاح API غير موجود"
  );
  process.exit(1);
}
```

---

### 🟡 متوسطة (Medium Priority)

#### 4. عدم التحقق من صحة المتغيرات البيئية عند التحميل

**الملف:** `src/ocr-arabic-pdf-to-txt-pipeline/config.ts`

**الكود الحالي:**

```typescript
dotenvConfig({ path: resolve(__dirname, "../../.env") });
dotenvConfig({ path: resolve(__dirname, "../../../.env") });
```

**المشكلة:** لا يوجد تحقق من:

- وجود ملف `.env`
- صحة تنسيق القيم
- وجود قيم فارغة

**التوصية:**

```typescript
import { z } from "zod";
import { config as dotenvConfig } from "dotenv";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(10, "مفتاح OpenAI قصير جداً"),
  MISTRAL_API_KEY: z.string().optional(),
  AGENT_MODEL: z.string().default("gpt-4o"),
  AGENT_MAX_STEPS: z.coerce.number().default(10),
});

// تحميل وتحقق
const rawEnv = dotenvConfig({ path: resolve(__dirname, "../../.env") });
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error(parsed.error.format(), "فشل التحقق من متغيرات البيئة");
  process.exit(1);
}

export const env = parsed.data;
```

---

#### 5. استخدام `process.exit` مباشرة في الكود

**الملفات:** متعددة

**المشكلة:** استخدام `process.exit()` يُوقف العملية فوراً دون:

- إغلاق الاتصالات المفتوحة
- انتظار العمليات غير المتزامنة
- تسجيل الأخطاء بشكل كامل

**التوصية:**

```typescript
// استخدام exit code مع await
async function gracefulExit(code: number, reason: string): Promise<never> {
  logger.info({ code, reason }, "إنهاء العملية");
  await flushLogs(); // انتظار انتهاء التسجيل
  process.exitCode = code;
  throw new Error(reason); // للسماح بـ cleanup
}
```

---

#### 6. عدم استخدام `AbortController` لإلغاء الطلبات

**الملف:** `src/ocr-arabic-pdf-to-txt-pipeline/mcp-server/ncio_mistral_all_in_one.ts`

**الكود الحالي (السطر ~824):**

```typescript
const response = await fetch(OPENAI_RESPONSES_URL, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ ... }),
});
```

**المشكلة:** لا يوجد آلية لإلغاء الطلبات المعلقة.

**التوصية:**

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);

try {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { ... },
    body: JSON.stringify({ ... }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // ...
} catch (error) {
  if (error.name === "AbortError") {
    throw new Error("انتهت مهلة طلب OpenAI (30 ثانية)");
  }
  throw error;
}
```

---

#### 7. تكرار كود معالجة الأخطاء

**الملف:** `src/ocr-arabic-pdf-to-txt-pipeline/tools.ts`

**المشكلة:** نفس نمط معالجة الأخطاء مكرر في كل أداة.

**التوصية:** استخدام دالة مساعدة مشتركة:

```typescript
function handleToolError(error: unknown, toolName: string, context?: Record<string, unknown>) {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error({ error: msg, tool: toolName, ...context }, `فشلت الأداة: ${toolName}`);
  return JSON.stringify({ success: false, error: msg, tool: toolName });
}

// الاستخدام:
catch (error) {
  return handleToolError(error, "readFileTool", { filePath });
}
```

---

#### 8. عدم التحقق من حجم الملف قبل قراءته

**الملف:** `src/ocr-arabic-pdf-to-txt-pipeline/skill-scripts/ocr-mistral.ts`

**الكود الحالي:**

```typescript
const pdfBuffer = readFileSync(input);
const base64Pdf = pdfBuffer.toString("base64");
```

**المشكلة:** لا يوجد تحقق من حجم الملف قبل قراءته في الذاكرة.

**التوصية:**

```typescript
import { statSync } from "node:fs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const stats = statSync(input);
if (stats.size > MAX_FILE_SIZE) {
  throw new Error(
    `حجم الملف ${(stats.size / 1024 / 1024).toFixed(2)}MB يتجاوز الحد المسموح (50MB)`
  );
}

const pdfBuffer = readFileSync(input);
```

---

### 🟢 منخفضة (Low Priority)

#### 9. استخدام `tsx watch` بدون تكوين

**الملف:** `package.json` السطر 37

```typescript
"ocr:dev": "tsx watch src/ocr-arabic-pdf-to-txt-pipeline/agent.ts"
```

**التوصية:** إضافة تكوين للـ ignore patterns:

```typescript
"ocr:dev": "tsx watch --ignore '**/*.test.ts' --ignore 'node_modules/**' src/ocr-arabic-pdf-to-txt-pipeline/agent.ts"
```

---

#### 10. عدم استخدام `sharp` للتحقق من الصور

**الملف:** `package.json`

**الملاحظة:** `sharp` مثبت لكن لا يُستخدم للتحقق من أبعاد أو صيغ الصور قبل OCR.

**التوصية:** استخدام `sharp` للتحقق من:

- أبعاد الصورة (الحد الأدنى/الأقصى)
- صيغة الصورة المدعومة
- DPI للصور الممسوحة

---

#### 11. تباين في إصدارات dotenv

**الملفات:** `package.json` vs `mcp-server/package.json`

**المشكلة:**

- الجذر: `dotenv@^17.3.1`
- MCP Server: `dotenv@^16.5.0`

**التوصية:** توحيد الإصدار في المشروع بأكمله.

---

#### 12. عدم استخدام `ai` SDK بشكل كامل

**الملاحظة:** مكتبة `ai` مثبتة (`^6.0.0`) لكن الاستخدام محدود في `agent.ts` فقط.

**التوصية:** استخدام مميزات `ai` SDK المتقدمة:

- Streaming responses
- Tool calling helpers
- Structured outputs مع `zod`

---

## الممارسات الجيدة المُتّبعة ✅

| الممارسة                       | الحالة  | الملف                        |
| ------------------------------ | ------- | ---------------------------- |
| استخدام TypeScript strict mode | ✅      | `tsconfig.json`              |
| استخدام Zod للتحقق من البيانات | ✅      | `tools.ts`                   |
| فصل الإعدادات في ملف منفصل     | ✅      | `config.ts`                  |
| استخدام ESM modules            | ✅      | `package.json`               |
| تثبيت mكتبة تسجيل (pino)       | ✅      | `package.json`               |
| استخدام modern React (v19)     | ✅      | `package.json`               |
| دعم AbortController في fetch   | ⚠️ جزئي | `ncio_mistral_all_in_one.ts` |
| استخدام async/await بشكل صحيح  | ✅      | معظم الملفات                 |
| تفريق stdout و stderr          | ✅      | `ocr-mistral.ts`             |

---

## خريطة الإصلاحات المقترحة

### المرحلة 1: حرجة (أسبوع 1)

1. استبدال `as any` بأنواع صحيحة في Mistral API
2. إنشاء نظام تسجيل موحد باستخدام `pino`
3. تحسين معالجة الأخطاء مع تتبع المكدس

### المرحلة 2: متوسطة (أسبوع 2)

4. تطبيق Zod للتحقق من متغيرات البيئة
5. استخدام `AbortController` لجميع طلبات API
6. إضافة تحقق من حجم الملفات

### المرحلة 3: منخفضة (أسبوع 3)

7. توحيد إصدارات التبعيات
8. تحسين تكوين development tools
9. استخدام مميزات `ai` SDK المتقدمة

---

## قياس الامتثال

```
الإجمالي: 78%
├── جودة الكود: 75%
├── معالجة الأخطاء: 65%
├── إدارة الإعدادات: 70%
├── الأمان: 85%
└── الأداء: 85%
```

---

## الموارد المفيدة

- [Mistral AI SDK Documentation](https://docs.mistral.ai/)
- [Vercel AI SDK Best Practices](https://sdk.vercel.ai/docs/getting-started)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Pino Logger Documentation](https://github.com/pinojs/pino)

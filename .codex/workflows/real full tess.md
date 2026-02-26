---
description: complete, production-ready testing environment for an Arabic script editor and classification t wep app
auto_execution_mode: 3
---

## التقنيات المستخدمة

- **اللغة**: TypeScript 5.x
- **الإطار**: React + Vite
- **اختبارات التكامل**: Vitest + Supertest
- **اختبارات E2E**: Playwright
- **إدارة الإعدادات**: Zod + dotenv
- **التسجيل**: Pino
- **مدير الحزم**: pnpm

## هيكل بيئة الاختبار المستهدف

```
mo7rer/
├── tests/
│   ├── config/
│   │   ├── test-config-manager.ts       # إدارة إعدادات بيئة الاختبار (Zod + dotenv)
│   │   ├── test-logger.ts               # نظام تسجيل احترافي (Pino)
│   │   └── test-fixtures.ts             # بيانات اختبار حقيقية (نصوص سيناريو عربية)
│   ├── integration/
│   │   ├── extensions/
│   │   │   ├── hybrid-classifier.integration.test.ts
│   │   │   ├── classification-core.integration.test.ts
│   │   │   ├── classification-decision.integration.test.ts
│   │   │   ├── classification-sequence-rules.integration.test.ts
│   │   │   ├── context-memory-manager.integration.test.ts
│   │   │   ├── paste-classifier.integration.test.ts
│   │   │   └── line-repair.integration.test.ts
│   │   ├── pipeline/
│   │   │   ├── ingestion-orchestrator.integration.test.ts
│   │   │   ├── sanitized-import-pipeline.integration.test.ts
│   │   │   ├── input-sanitizer.integration.test.ts
│   │   │   ├── normalize.integration.test.ts
│   │   │   ├── command-engine.integration.test.ts
│   │   │   ├── fingerprint.integration.test.ts
│   │   │   └── trust-policy.integration.test.ts
│   │   ├── pipeline-quality/
│   │   │   ├── line-quality.integration.test.ts
│   │   │   ├── raw-screenplay-validator.integration.test.ts
│   │   │   ├── suspicion-fusion.integration.test.ts
│   │   │   └── suspicious-detector.integration.test.ts
│   │   ├── pipeline-patch/
│   │   │   ├── align.integration.test.ts
│   │   │   ├── constrained-corrector.integration.test.ts
│   │   │   └── patch-apply.integration.test.ts
│   │   └── server/
│   │       ├── file-import-server.integration.test.ts
│   │       ├── doc-converter-flow.integration.test.ts
│   │       └── mistral-ocr-request-adapter.integration.test.ts
│   ├── e2e/
│   │   ├── full-import-classify-flow.e2e.test.ts
│   │   ├── editor-interaction.e2e.test.ts
│   │   ├── paste-and-classify.e2e.test.ts
│   │   └── export-screenplay.e2e.test.ts
│   ├── fixtures/
│   │   ├── sample-screenplay-action.txt
│   │   ├── sample-screenplay-dialogue.txt
│   │   ├── sample-screenplay-full-scene.txt
│   │   ├── sample-screenplay-mixed.txt
│   │   ├── sample-dirty-input.txt
│   │   ├── sample.docx
│   │   └── sample.doc
│   └── helpers/
│       ├── assertion-helpers.ts         # مساعدات تأكيد مخصصة للتصنيف
│       └── screenplay-builders.ts       # بُناة نصوص سيناريو للاختبار
├── .env.test                             # متغيرات بيئة الاختبار
├── vitest.pipeline.config.ts             # (موجود — يُعدَّل)
└── playwright.config.ts                  # (موجود — يُعدَّل)
```

## المتطلبات المسبقة

- Node.js 20+
- pnpm 9+
- متصفحات Playwright مُثبّتة (`pnpm exec playwright install`)
- متغيرات البيئة في `.env.test` (مفاتيح API إن لزمت لاختبار OCR)

---

## خطوات التنفيذ

---

## المرحلة 1: البنية التحتية لبيئة الاختبار (خطوات 1-4)

### الخطوة 1: تثبيت تبعيات الاختبار وتحديث إعدادات المشروع

**الهدف**: تجهيز كافة الحزم اللازمة لبيئة الاختبار مع ضمان التوافق مع الإعدادات القائمة.

**الملفات**:

- `package.json` — تعديل: إضافة تبعيات التطوير
- `.env.test` — إنشاء: متغيرات بيئة الاختبار
- `.env.test.example` — إنشاء: نموذج متغيرات البيئة (بدون أسرار)

**التنفيذ**:
نفّذ الأوامر التالية لتثبيت التبعيات:

```bash
pnpm add -D vitest @vitest/coverage-v8 supertest @types/supertest
pnpm add -D @playwright/test
pnpm add -D pino pino-pretty
pnpm add -D zod dotenv
pnpm exec playwright install chromium
```

أنشئ ملف `.env.test` يحتوي على:

```env
NODE_ENV=test
TEST_LOG_LEVEL=info
TEST_LOG_FILE=./test-results/test-run.log
MISTRAL_API_KEY=__REPLACE_IF_TESTING_OCR__
VITE_APP_PORT=5174
TEST_FIXTURES_DIR=./tests/fixtures
TEST_TIMEOUT_MS=30000
```

أنشئ `.env.test.example` بنفس المتغيرات لكن بقيم فارغة أو وهمية.

أضف السكريبتات التالية إلى `package.json` ضمن `"scripts"`:

```json
{
  "test:integration": "vitest run --config vitest.pipeline.config.ts",
  "test:integration:watch": "vitest --config vitest.pipeline.config.ts",
  "test:e2e": "playwright test --config playwright.config.ts",
  "test:e2e:ui": "playwright test --ui --config playwright.config.ts",
  "test:all": "pnpm run test:integration && pnpm run test:e2e",
  "test:coverage": "vitest run --config vitest.pipeline.config.ts --coverage"
}
```

**✅ معيار القبول**: تشغيل `pnpm install` ينجح بدون أخطاء، وملف `.env.test` موجود بالقيم الصحيحة.

---

### الخطوة 2: إنشاء ConfigManager لبيئة الاختبار

**الهدف**: بناء فئة `TestConfigManager` تعتمد على Zod للتحقق من صحة متغيرات البيئة وتضمن أمان واستقلالية بيئة الاختبار.

**الملفات**:

- `tests/config/test-config-manager.ts` — إنشاء

**التنفيذ**:
أنشئ فئة `TestConfigManager` باستخدام نمط Singleton تقوم بما يلي:

1. تحمّل متغيرات البيئة من `.env.test` باستخدام `dotenv` مع `path: '.env.test'`.
2. تعرّف `Zod schema` للتحقق من جميع المتغيرات:
   - `NODE_ENV`: يجب أن يكون `'test'` حصرياً (باستخدام `z.literal('test')`) — كإجراء أمان لمنع تشغيل الاختبارات على بيئة إنتاج.
   - `TEST_LOG_LEVEL`: `z.enum(['debug', 'info', 'warn', 'error']).default('info')`
   - `TEST_LOG_FILE`: `z.string().min(1)`
   - `MISTRAL_API_KEY`: `z.string().optional()` (اختياري — فقط لاختبارات OCR)
   - `VITE_APP_PORT`: `z.coerce.number().int().min(1024).max(65535).default(5174)`
   - `TEST_FIXTURES_DIR`: `z.string().default('./tests/fixtures')`
   - `TEST_TIMEOUT_MS`: `z.coerce.number().int().min(5000).default(30000)`
3. تصدّر دالة `getTestConfig()` ترجع الكائن المُتحقق منه.
4. في حالة فشل التحقق، تطرح خطأً مفصلاً يعرض المتغيرات الناقصة أو غير الصالحة باستخدام `ZodError.format()`.
5. تلفّ عملية التحميل والتحقق بالكامل في `try/catch`.

استورد `z` من `'zod'` و `config` من `'dotenv'`.
صدّر كلاً من: النوع `TestConfig` (مستنتج من `z.infer<typeof schema>`) والدالة `getTestConfig`.

**✅ معيار القبول**: استيراد `getTestConfig()` في ملف اختبار تجريبي وتنفيذه ينجح ويُرجع كائناً مُتحققاً فيه `NODE_ENV === 'test'`، وحذف متغير إلزامي من `.env.test` يؤدي لرمي `ZodError`.

---

### الخطوة 3: إنشاء نظام التسجيل الاحترافي للاختبارات

**الهدف**: بناء نظام تسجيل مركزي باستخدام Pino يتتبع مسار الاختبارات ونتائجها ويمنع استخدام `console.log` نهائياً.

**الملفات**:

- `tests/config/test-logger.ts` — إنشاء

**التنفيذ**:
أنشئ وحدة `test-logger.ts` تقوم بما يلي:

1. تستورد `getTestConfig` من `./test-config-manager.ts` و `pino` من `'pino'`.
2. تُنشئ مُسجّل Pino بالإعدادات التالية:
   - `level`: من `getTestConfig().TEST_LOG_LEVEL`
   - `transport` في بيئة التطوير: `pino-pretty` مع `colorize: true` و `translateTime: 'SYS:HH:MM:ss'`
   - `base`: يتضمن `pid: false` و `hostname: false` (لتنظيف المخرجات)
3. تصدّر الدوال التالية (كلها تستخدم `logger` الداخلي):
   - `logTestSuiteStart(suiteName: string)`: تسجّل بداية مجموعة اختبار بمستوى `info`
   - `logTestSuiteEnd(suiteName: string, passed: number, failed: number, duration: number)`: تسجّل نهاية مجموعة بالإحصائيات
   - `logTestStep(stepName: string, details?: Record<string, unknown>)`: تسجّل خطوة داخل اختبار بمستوى `debug`
   - `logTestError(testName: string, error: Error)`: تسجّل خطأ بمستوى `error` مع تضمين `error.message` و `error.stack`
   - `getLogger()`: تُرجع مُسجّل Pino الخام للاستخدام المتقدم
4. تلفّ إنشاء المُسجّل في `try/catch` — في حالة فشل تحميل الإعدادات، تستخدم `pino({ level: 'info' })` كاحتياطي.

**✅ معيار القبول**: استيراد `logTestSuiteStart('test')` وتنفيذه يطبع سطر تسجيل منسّق بمستوى `info` بدون استخدام `console.log`.

---

### الخطوة 4: إنشاء بيانات الاختبار الحقيقية (Fixtures) ومساعدات التأكيد

**الهدف**: بناء مجموعة بيانات اختبار حقيقية من نصوص سيناريو عربية فعلية، مع مساعدات تأكيد مخصصة لنتائج التصنيف.

**الملفات**:

- `tests/fixtures/sample-screenplay-action.txt` — إنشاء
- `tests/fixtures/sample-screenplay-dialogue.txt` — إنشاء
- `tests/fixtures/sample-screenplay-full-scene.txt` — إنشاء
- `tests/fixtures/sample-screenplay-mixed.txt` — إنشاء
- `tests/fixtures/sample-dirty-input.txt` — إنشاء
- `tests/config/test-fixtures.ts` — إنشاء
- `tests/helpers/assertion-helpers.ts` — إنشاء
- `tests/helpers/screenplay-builders.ts` — إنشاء

**التنفيذ**:

**أولاً — ملفات النصوص** (بترميز UTF-8):

`sample-screenplay-action.txt`: يحتوي 5-8 أسطر وصف حركة (Action) بالعربية مثل:

```
يدخل أحمد الغرفة بخطوات متثاقلة. يلقي نظرة سريعة على المكان.
يجلس على الكرسي بجوار النافذة ويشعل سيجارة.
```

`sample-screenplay-dialogue.txt`: يحتوي 5-8 أسطر حوار بتنسيق سيناريو عربي قياسي:

```
أحمد
إنت فاكر إنك هتعدي بالسهولة دي؟

سارة
(بحزم)
أنا مش محتاجة إذنك.
```

`sample-screenplay-full-scene.txt`: مشهد كامل يتضمن: عنوان مشهد (`داخلي - شقة أحمد - ليل`)، وصف حركة، حوار، إشارة قوسية (Parenthetical)، وانتقال (Transition).

`sample-screenplay-mixed.txt`: خليط من أنواع الأسطر بترتيب واقعي — لاختبار التصنيف التسلسلي.

`sample-dirty-input.txt`: نص يحتوي مشاكل شائعة: مسافات زائدة، أسطر فارغة متعددة، علامات ترقيم مكسورة، أحرف Unicode غير قياسية — لاختبار التنظيف والتطهير.

**ثانياً — `tests/config/test-fixtures.ts`**:
فئة `TestFixtureLoader` تقوم بـ:

1. تحمّل ملفات النصوص من `TEST_FIXTURES_DIR` (من ConfigManager) باستخدام `fs/promises.readFile` مع ترميز `'utf-8'`.
2. تقسّم النص إلى أسطر باستخدام `split(/\r?\n/)`.
3. تصدّر دالة `loadFixture(name: string): Promise<string[]>` تُرجع مصفوفة أسطر.
4. تصدّر دالة `loadRawFixture(name: string): Promise<string>` تُرجع النص الخام.
5. تلفّ عمليات القراءة في `try/catch` مع تسجيل الأخطاء عبر `logTestError`.

**ثالثاً — `tests/helpers/assertion-helpers.ts`**:
مجموعة دوال تأكيد مخصصة:

- `assertClassificationType(result: ClassificationResult, expected: LineType)`: تتحقق أن نوع التصنيف يطابق المتوقع.
- `assertClassificationConfidence(result: ClassificationResult, minConfidence: number)`: تتحقق أن مستوى الثقة أعلى من الحد الأدنى.
- `assertAllLinesClassified(results: ClassificationResult[])`: تتحقق أن كل الأسطر مُصنّفة (لا يوجد `undefined` أو `null`).
- `assertSequenceValid(results: ClassificationResult[])`: تتحقق أن التسلسل منطقي (مثلاً: لا يأتي Parenthetical بدون Character قبله).

استورد أنواع `ClassificationResult` و `LineType` من `src/extensions/classification-types.ts`.

**رابعاً — `tests/helpers/screenplay-builders.ts`**:
فئة `ScreenplayBuilder` بنمط Builder Pattern:

- `addSceneHeader(text: string)`: تضيف عنوان مشهد
- `addAction(text: string)`: تضيف وصف حركة
- `addCharacter(name: string)`: تضيف اسم شخصية
- `addDialogue(text: string)`: تضيف حوار
- `addParenthetical(text: string)`: تضيف إشارة قوسية
- `addTransition(text: string)`: تضيف انتقال
- `build(): string[]`: تُرجع مصفوفة الأسطر الناتجة
- `buildRaw(): string`: تُرجع نصاً مجمّعاً

**✅ معيار القبول**: تشغيل `loadFixture('sample-screenplay-full-scene')` يُرجع مصفوفة أسطر غير فارغة، و`new ScreenplayBuilder().addSceneHeader('داخلي - مكتب - نهار').addAction('يجلس على الكرسي').build()` يُرجع مصفوفة من سطرين.

---

## المرحلة 2: تحديث ملفات الإعداد القائمة (خطوة 5)

### الخطوة 5: تحديث إعدادات Vitest و Playwright

**الهدف**: ضبط ملفات الإعداد القائمة لتعمل مع بنية الاختبار الجديدة مع الحفاظ على التوافق.

**الملفات**:

- `vitest.pipeline.config.ts` — تعديل: توسيع الإعدادات
- `playwright.config.ts` — تعديل: ضبط لاختبارات E2E

**التنفيذ**:

**`vitest.pipeline.config.ts`** — أضف أو عدّل الإعدادات التالية:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    exclude: ["tests/e2e/**"],
    testTimeout: 30000,
    hookTimeout: 15000,
    setupFiles: ["./tests/config/vitest-setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
    coverage: {
      provider: "v8",
      include: ["src/extensions/**", "src/pipeline/**", "server/**"],
      exclude: ["**/*.d.ts", "**/*.test.ts", "node_modules/**"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./test-results/coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

أنشئ ملف `tests/config/vitest-setup.ts`:

```typescript
// ملف إعداد يُنفَّذ قبل كل ملف اختبار — يحمّل الإعدادات ويهيئ المسجّل
import { getTestConfig } from "./test-config-manager";
import { logTestSuiteStart } from "./test-logger";

// التحقق من بيئة الاختبار عند البدء
const config = getTestConfig();
logTestSuiteStart(`Vitest Suite — ENV: ${config.NODE_ENV}`);
```

**`playwright.config.ts`** — اضبط الإعدادات لتشمل:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.test.ts",
  fullyParallel: false, // تسلسلي لضمان الاستقرار
  retries: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ["html", { outputFolder: "./test-results/playwright-report" }],
    ["list"],
  ],
  outputDir: "./test-results/playwright-artifacts",
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm run dev --port 5174",
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

**✅ معيار القبول**: تشغيل `pnpm run test:integration --run --reporter=verbose` يعرض "no test files found" (بدون أخطاء إعداد)، وتشغيل `pnpm exec playwright test --list` لا يُظهر أخطاء إعداد.

---

## المرحلة 3: اختبارات تكامل محرك التصنيف (خطوات 6-10)

### الخطوة 6: اختبار تكامل classification-core — النواة الأساسية للتصنيف

**الهدف**: التحقق من أن دوال التصنيف الأساسية تُصنّف أسطر السيناريو العربي بدقة لكل نوع سطر منفرداً.

**الملفات**:

- `tests/integration/extensions/classification-core.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد مباشرةً من `src/extensions/classification-core.ts` ويختبر المسارات الحرجة التالية:

1. **مجموعة: تصنيف عناوين المشاهد** — مرّر أسطراً حقيقية مثل `"داخلي - شقة أحمد - ليل"` و `"خارجي - شارع المعز - نهار"` وتحقق أن النتيجة `scene-header`. اختبر أيضاً الحالات الحدية: عنوان مشهد بدون فاصل، عنوان بمسافات زائدة.

2. **مجموعة: تصنيف أسماء الشخصيات** — مرّر `"أحمد"` و `"سارة (صوت خارجي)"` وتحقق من النوع `character`.

3. **مجموعة: تصنيف الحوار** — بعد تمرير سطر شخصية، مرّر سطر حوار وتحقق من النوع `dialogue`.

4. **مجموعة: تصنيف وصف الحركة** — مرّر أسطر وصفية سردية وتحقق من النوع `action`.

5. **مجموعة: تصنيف الإشارات القوسية** — مرّر `"(بحزم)"` و `"(هامساً)"` وتحقق من النوع `parenthetical`.

6. **مجموعة: تصنيف الانتقالات** — مرّر `"قطع إلى:"` و `"تلاشي إلى:"` وتحقق من النوع `transition`.

استخدم `loadFixture` لتحميل النصوص الحقيقية، و`assertClassificationType` من `assertion-helpers.ts` لكل تأكيد.
لفّ كل `describe` و `it` بتسجيل عبر `logTestStep`.
لا تستخدم بيانات وهمية (Mocks) — كل استدعاء يمر عبر الدوال الحقيقية.

**✅ معيار القبول**: تشغيل `pnpm run test:integration -- tests/integration/extensions/classification-core.integration.test.ts` ينجح بكل الاختبارات (0 فشل).

---

### الخطوة 7: اختبار تكامل classification-decision — محرك القرار

**الهدف**: التحقق من أن منطق اتخاذ القرار يتعامل بشكل صحيح مع الحالات الغامضة وتعارض النتائج.

**الملفات**:

- `tests/integration/extensions/classification-decision.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `src/extensions/classification-decision.ts` ويختبر:

1. **مجموعة: القرار في حالة نتيجة واحدة واضحة** — مرّر سطراً ذا تصنيف واضح (عنوان مشهد صريح) وتحقق أن القرار يُرجع النوع الصحيح بثقة عالية (> 0.8).

2. **مجموعة: القرار في حالة تعارض** — مرّر سطراً يمكن أن يكون حركة أو حوار (مثل سطر قصير غامض) وتحقق أن النظام يتخذ قراراً (لا يُرجع `undefined`) وأن مستوى الثقة أقل من الحالة الواضحة.

3. **مجموعة: القرار مع سياق سابق** — مرّر سلسلة أسطر متتالية (شخصية ثم سطر غامض) وتحقق أن النظام يستخدم السياق لتصنيف السطر الغامض كحوار.

4. **مجموعة: الحالات الحدية** — أسطر فارغة، أسطر من مسافات فقط، أسطر من أرقام فقط، أسطر بترميز Unicode غير قياسي.

استخدم `assertClassificationConfidence` و `ScreenplayBuilder` من المساعدات.

**✅ معيار القبول**: تشغيل `pnpm run test:integration -- tests/integration/extensions/classification-decision.integration.test.ts` ينجح بكل الاختبارات.

---

### الخطوة 8: اختبار تكامل classification-sequence-rules — قواعد التسلسل

**الهدف**: التحقق من أن قواعد التسلسل تمنع التصنيفات غير المنطقية (مثل حوار بدون شخصية قبله).

**الملفات**:

- `tests/integration/extensions/classification-sequence-rules.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `src/extensions/classification-sequence-rules.ts` ويختبر:

1. **مجموعة: تسلسلات صحيحة** — مرّر تسلسل `[scene-header → action → character → dialogue]` وتحقق أن القواعد تقبلها جميعاً.

2. **مجموعة: تسلسلات مرفوضة**:
   - `dialogue` بدون `character` قبله → يجب أن تُصحّح أو تُرفض
   - `parenthetical` بدون `character` قبله → يجب أن تُصحّح
   - `transition` بعد `character` مباشرةً → تسلسل غير منطقي

3. **مجموعة: تسلسلات حدية مقبولة**:
   - `action` بعد `action` → مقبول (وصف مستمر)
   - `scene-header` بعد `transition` → مقبول (بداية مشهد جديد)
   - `character` بعد `character` → مقبول (حوار متبادل سريع)

4. **مجموعة: سيناريو كامل** — حمّل `sample-screenplay-full-scene.txt` ومرّره عبر قواعد التسلسل وتحقق أن كل التسلسلات مقبولة (بافتراض أن الملف يحتوي نصاً مُنسّقاً بشكل صحيح).

استخدم `assertSequenceValid` و `ScreenplayBuilder` لبناء التسلسلات.

**✅ معيار القبول**: تشغيل الاختبار ينجح — التسلسلات الصحيحة مقبولة والتسلسلات الخاطئة مُصحّحة أو مرفوضة.

---

### الخطوة 9: اختبار تكامل context-memory-manager — مدير ذاكرة السياق

**الهدف**: التحقق من أن مدير ذاكرة السياق يحتفظ بالمعلومات بشكل صحيح عبر سلسلة الأسطر ويؤثر على قرارات التصنيف.

**الملفات**:

- `tests/integration/extensions/context-memory-manager.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `src/extensions/context-memory-manager.ts` ويختبر:

1. **مجموعة: تهيئة الذاكرة** — أنشئ مثيل جديد وتحقق أن الذاكرة فارغة.

2. **مجموعة: إضافة سياق** — أضف سطراً مُصنّفاً (character) وتحقق أن الذاكرة تحتفظ به وتُرجعه عند الاستعلام عن آخر شخصية.

3. **مجموعة: سلسلة سياقات** — أضف تسلسل `[scene-header, action, character, dialogue, character, dialogue]` وتحقق من:
   - آخر عنوان مشهد محفوظ
   - آخر شخصية محفوظة (الثانية)
   - عدد الأسطر المُعالجة صحيح

4. **مجموعة: إعادة تعيين الذاكرة** — بعد إضافة عدة أسطر، نفّذ `reset()` وتحقق أن الذاكرة فارغة تماماً.

5. **مجموعة: تأثير الذاكرة على التصنيف** — (اختبار تكاملي شامل) استخدم `context-memory-manager` مع `hybrid-classifier` لتصنيف سلسلة أسطر وتحقق أن وجود السياق يُحسّن دقة تصنيف الأسطر الغامضة.

راجع ملف `plans/context-memory-manager-test-plan.md` إن وُجد للاطلاع على خطة الاختبار القائمة والبناء عليها.

**✅ معيار القبول**: تشغيل الاختبار ينجح — الذاكرة تحتفظ بالسياق وتُرجعه بشكل صحيح، والإعادة تمسح كل شيء.

---

### الخطوة 10: اختبار تكامل hybrid-classifier — المصنّف الهجين (الاختبار الشامل)

**الهدف**: التحقق من أن المصنّف الهجين (الذي يجمع كل المكونات) يُصنّف مشهداً كاملاً بدقة مقبولة (≥ 85%).

**الملفات**:

- `tests/integration/extensions/hybrid-classifier.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `src/extensions/hybrid-classifier.ts` ويختبر المسارات التالية:

1. **مجموعة: تصنيف مشهد كامل** — حمّل `sample-screenplay-full-scene.txt`، مرّره عبر `hybrid-classifier`، ثم:
   - تحقق أن كل الأسطر مُصنّفة (`assertAllLinesClassified`)
   - تحقق أن التسلسل منطقي (`assertSequenceValid`)
   - احسب نسبة الدقة: قارن كل تصنيف مع التصنيف المتوقع المُعرّف يدوياً في `expectedClassifications` object (خريطة من رقم السطر → النوع المتوقع)
   - تحقق أن الدقة ≥ 85%

2. **مجموعة: تصنيف نص مختلط** — حمّل `sample-screenplay-mixed.txt` واختبره بنفس الطريقة.

3. **مجموعة: تصنيف نص Action صرف** — حمّل `sample-screenplay-action.txt` وتحقق أن كل الأسطر مُصنّفة كـ `action`.

4. **مجموعة: تصنيف نص Dialogue صرف** — حمّل `sample-screenplay-dialogue.txt` وتحقق أن الأسطر مُصنّفة كتبادل `character` ↔ `dialogue` (مع `parenthetical` إن وُجد).

5. **مجموعة: مقاومة المدخلات المتسخة** — حمّل `sample-dirty-input.txt`، مرّره عبر المصنّف، وتحقق أنه لا يرمي أخطاء (graceful handling) حتى لو كان التصنيف غير دقيق تماماً.

سجّل نتائج كل مجموعة (عدد الأسطر، الدقة، الأخطاء) عبر `logTestSuiteEnd`.

**✅ معيار القبول**: تشغيل الاختبار ينجح — المصنّف الهجين يُصنّف المشهد الكامل بدقة ≥ 85% ولا يرمي أخطاء مع المدخلات المتسخة.

---

## المرحلة 4: اختبارات تكامل خط أنابيب المعالجة (خطوات 11-15)

### الخطوة 11: اختبار تكامل input-sanitizer — مُطهّر المدخلات

**الهدف**: التحقق من أن مُطهّر المدخلات يُنظّف النصوص العربية بشكل صحيح ويزيل المحتوى الضار مع الحفاظ على المحتوى الصالح.

**الملفات**:

- `tests/integration/pipeline/input-sanitizer.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `src/pipeline/input-sanitizer.ts` ويختبر:

1. **مجموعة: تنظيف المسافات** — مرّر نصاً بمسافات بيضاء زائدة (tabs متعددة، مسافات في بداية ونهاية الأسطر، أسطر فارغة متتالية) وتحقق أن النتيجة منظّفة مع الحفاظ على فواصل الأسطر المنطقية.

2. **مجموعة: معالجة Unicode العربي** — مرّر نصاً يحتوي تشكيل (فتحة، ضمة، كسرة)، همزات بأشكالها المختلفة (أ إ آ ؤ ئ ء)، ولام ألف (لا) وتحقق أن التطهير لا يفسد هذه الأحرف.

3. **مجموعة: إزالة أحرف التحكم** — مرّر نصاً يحتوي أحرف تحكم (`\u200B` zero-width space، `\u200F` RTL mark، `\uFEFF` BOM) وتحقق من إزالتها أو معالجتها.

4. **مجموعة: الحفاظ على التنسيق** — تحقق أن عنوان مشهد بتنسيق صحيح يمر بدون تغيير: `"داخلي - شقة أحمد - ليل"` ← نفس النص بالضبط.

5. **مجموعة: نص كامل من fixture** — حمّل `sample-dirty-input.txt`، مرّره عبر المُطهّر، وتحقق أن النتيجة لا تحتوي أحرف تحكم والأسطر الفارغة المتتالية مُختزلة.

**✅ معيار القبول**: تشغيل الاختبار ينجح — المُطهّر يُنظّف المدخلات بدون إفساد النص العربي الصالح.

---

### الخطوة 12: اختبار تكامل normalize — التطبيع

**الهدف**: التحقق من أن وحدة التطبيع تُوحّد الأشكال المختلفة للنص العربي إلى شكل قياسي.

**الملفات**:

- `tests/integration/pipeline/normalize.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `src/pipeline/normalize.ts` ويختبر:

1. **مجموعة: تطبيع الهمزات** — `"إبراهيم"` و `"ابراهيم"` و `"أبراهيم"` يجب أن تُنتج نتيجة قابلة للمقارنة (حسب سياسة التطبيع المتبعة في المشروع).

2. **مجموعة: تطبيع علامات الترقيم** — تحويل `"،"` (فاصلة عربية) و `","` (فاصلة إنجليزية)، وكذلك `"؛"` و `";"`.

3. **مجموعة: تطبيع المسافات** — مسافات متعددة تُصبح مسافة واحدة.

4. **مجموعة: تطبيع عناوين المشاهد** — `"داخلى"` و `"داخلي"` يجب أن تُعامل بشكل موحد (ياء مقصورة ↔ ياء).

5. **مجموعة: الاستقرار** (Idempotency) — تطبيع نص مُطبّع بالفعل يُرجع نفس النتيجة.

**✅ معيار القبول**: تشغيل الاختبار ينجح — كل حالات التطبيع تعمل بشكل صحيح والتطبيع ثابت (idempotent).

---

### الخطوة 13: اختبار تكامل ingestion-orchestrator — مُنسّق خط الاستيراد

**الهدف**: التحقق من أن مُنسّق الاستيراد يمرّر الملف عبر كل مراحل خط الأنابيب (تطهير → تطبيع → تصنيف → تحقق) بشكل صحيح.

**الملفات**:

- `tests/integration/pipeline/ingestion-orchestrator.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `src/pipeline/ingestion-orchestrator.ts` ويختبر المسار الحرج الكامل:

1. **مجموعة: استيراد نص سيناريو كامل** — حمّل `sample-screenplay-full-scene.txt` ومرّره عبر `ingestion-orchestrator`. تحقق أن:
   - النتيجة تحتوي أسطراً مُصنّفة
   - كل سطر له نوع (type) ومحتوى (content)
   - لا يوجد أسطر بتصنيف `undefined`
   - التسلسل الناتج منطقي

2. **مجموعة: استيراد نص متسخ** — حمّل `sample-dirty-input.txt` ومرّره. تحقق أن:
   - الاستيراد لا يرمي أخطاء
   - النتيجة مُنظّفة (لا أحرف تحكم)
   - الأسطر الفارغة الزائدة مُزالة

3. **مجموعة: استيراد نص فارغ** — مرّر نصاً فارغاً وتحقق أن النتيجة مصفوفة فارغة (وليس خطأ).

4. **مجموعة: قياس الأداء** — سجّل الوقت المستغرق لاستيراد `sample-screenplay-full-scene.txt` وتحقق أنه أقل من 5 ثوانٍ (كعتبة أداء).

**✅ معيار القبول**: تشغيل الاختبار ينجح — خط الاستيراد يعالج المشهد الكامل بنجاح وينتج أسطراً مُصنّفة.

---

### الخطوة 14: اختبار تكامل وحدات الجودة — line-quality + suspicious-detector + suspicion-fusion

**الهدف**: التحقق من أن نظام الجودة يكتشف الأسطر المشبوهة ويحسب مستوى الشك بشكل صحيح.

**الملفات**:

- `tests/integration/pipeline-quality/line-quality.integration.test.ts` — إنشاء
- `tests/integration/pipeline-quality/suspicious-detector.integration.test.ts` — إنشاء
- `tests/integration/pipeline-quality/suspicion-fusion.integration.test.ts` — إنشاء

**التنفيذ**:

**`line-quality.integration.test.ts`**:

1. **مجموعة: جودة عالية** — مرّر أسطراً سليمة لغوياً (عنوان مشهد صحيح، حوار مكتمل) وتحقق أن درجة الجودة عالية.
2. **مجموعة: جودة منخفضة** — مرّر أسطراً مشبوهة (أحرف عشوائية، خليط لغات بدون معنى) وتحقق أن درجة الجودة منخفضة.

**`suspicious-detector.integration.test.ts`**:

1. **مجموعة: اكتشاف أسطر OCR مكسورة** — مرّر أسطراً تُحاكي أخطاء OCR شائعة (حروف مبعثرة، كلمات مقطوعة) وتحقق من اكتشافها.
2. **مجموعة: عدم الإنذار الكاذب** — مرّر أسطراً عربية سليمة وتحقق أن النظام لا يُصنّفها كمشبوهة.

**`suspicion-fusion.integration.test.ts`**:

1. **مجموعة: دمج إشارات الشك** — مرّر سطراً مع عدة إشارات شك (جودة منخفضة + تصنيف غير واضح) وتحقق أن درجة الشك المُدمجة أعلى من كل إشارة منفردة.
2. **مجموعة: عتبة القبول** — تحقق أن الأسطر ذات الشك فوق العتبة تُوسم للمراجعة.

**✅ معيار القبول**: تشغيل الاختبارات الثلاثة ينجح — النظام يكتشف المشبوه ولا يُنذر كاذباً على النصوص السليمة.

---

### الخطوة 15: اختبار تكامل وحدات الترقيع — align + constrained-corrector + patch-apply

**الهدف**: التحقق من أن نظام الترقيع يُصحّح الأخطاء المكتشفة بشكل صحيح بدون إفساد النص السليم.

**الملفات**:

- `tests/integration/pipeline-patch/align.integration.test.ts` — إنشاء
- `tests/integration/pipeline-patch/constrained-corrector.integration.test.ts` — إنشاء
- `tests/integration/pipeline-patch/patch-apply.integration.test.ts` — إنشاء

**التنفيذ**:

**`align.integration.test.ts`**:

1. **مجموعة: محاذاة نصين متشابهين** — مرّر نسخة أصلية ونسخة بها أخطاء طفيفة (حرف ناقص، كلمة مبدّلة) وتحقق أن خوارزمية المحاذاة تكتشف الفروقات بدقة.
2. **مجموعة: محاذاة نصين مختلفين جداً** — تحقق أن النظام يتعامل مع الاختلافات الكبيرة بدون تعليق أو خطأ.

**`constrained-corrector.integration.test.ts`**:

1. **مجموعة: تصحيح مُقيَّد** — مرّر سطراً به خطأ واضح مع قيد (constraint) يمنع تغيير أكثر من كلمة واحدة، وتحقق أن التصحيح يلتزم بالقيد.
2. **مجموعة: رفض تصحيح خطير** — مرّر تصحيحاً يُغيّر معنى الجملة بالكامل، وتحقق أن المُصحّح يرفضه.

**`patch-apply.integration.test.ts`**:

1. **مجموعة: تطبيق ترقيع واحد** — أنشئ ترقيعاً (patch) على سطر وطبّقه، وتحقق أن النتيجة تحتوي التصحيح.
2. **مجموعة: تطبيق ترقيعات متعددة** — طبّق عدة ترقيعات على نص وتحقق أن كلها مُطبّقة.
3. **مجموعة: ترقيع idempotent** — تطبيق نفس الترقيع مرتين يُنتج نفس النتيجة (لا تراكم).

**✅ معيار القبول**: تشغيل الاختبارات الثلاثة ينجح — الترقيع يُصحّح الأخطاء المكتشفة ولا يُفسد النص السليم.

---

## المرحلة 5: اختبارات تكامل الخادم (خطوات 16-17)

### الخطوة 16: اختبار تكامل file-import-server — خادم استيراد الملفات

**الهدف**: التحقق من أن خادم الاستيراد يستقبل ملفات (.txt, .docx, .doc) ويُرجع النص المستخرج عبر HTTP endpoints.

**الملفات**:

- `tests/integration/server/file-import-server.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد الخادم من `server/file-import-server.mjs` ويستخدم `supertest` لاختبار endpoints الفعلية:

1. **مجموعة: استيراد ملف .txt** — أرسل طلب `POST` مع ملف `sample-screenplay-full-scene.txt` كـ `multipart/form-data`. تحقق أن:
   - الاستجابة `200 OK`
   - الجسم يحتوي نصاً عربياً مُستخرجاً
   - النص غير فارغ

2. **مجموعة: استيراد ملف .docx** (إن توفر fixture): أرسل ملف `.docx` وتحقق من نفس المعايير.

3. **مجموعة: رفض ملف غير مدعوم** — أرسل ملف `.exe` أو `.jpg` وتحقق أن الاستجابة `400 Bad Request` أو `415 Unsupported Media Type`.

4. **مجموعة: طلب بدون ملف** — أرسل طلب `POST` بدون ملف مرفق وتحقق أن الاستجابة خطأ مناسب (ليس `500`).

**ملاحظة**: هذا الخادم مكتوب بـ `.mjs` — استخدم `dynamic import()` إن لزم لتحميله في بيئة Vitest. إن كان الخادم يحتاج تشغيلاً مستقلاً، شغّله في `beforeAll` وأوقفه في `afterAll`.

**✅ معيار القبول**: تشغيل الاختبار ينجح — الخادم يقبل الملفات المدعومة ويرفض غير المدعومة ويُرجع استجابات HTTP صحيحة.

---

### الخطوة 17: اختبار تكامل doc-converter-flow — مسار تحويل المستندات

**الهدف**: التحقق من أن مسار تحويل المستندات يُحوّل ملفات .docx و .doc إلى نص صالح للتصنيف.

**الملفات**:

- `tests/integration/server/doc-converter-flow.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار يستورد من `server/doc-converter-flow.mjs` ويختبر:

1. **مجموعة: تحويل .docx إلى نص** — مرّر مسار ملف `sample.docx` (إن وُجد في fixtures أو من ملف `temp-sample.docx` الموجود في جذر المشروع). تحقق أن النتيجة نص غير فارغ بترميز UTF-8 صحيح.

2. **مجموعة: تحويل .doc إلى نص** — مرّر مسار ملف `temp-sample.doc` الموجود في جذر المشروع. تحقق أن النتيجة نص غير فارغ.

3. **مجموعة: الحفاظ على النص العربي** — تحقق أن النص المُستخرج يحتوي أحرف عربية ولا يحتوي ترميز مكسور (مثل `Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©`).

4. **مجموعة: ملف غير موجود** — مرّر مسار ملف غير موجود وتحقق من معالجة الخطأ (لا `unhandled exception`).

**✅ معيار القبول**: تشغيل الاختبار ينجح — الملفات تُحوَّل بنجاح والنص العربي محفوظ.

---

## المرحلة 6: اختبارات E2E — تجربة المستخدم الكاملة (خطوات 18-21)

### الخطوة 18: اختبار E2E — تحميل التطبيق وواجهة المحرر

**الهدف**: التحقق من أن التطبيق يُحمّل بنجاح في المتصفح وعناصر الواجهة الأساسية ظاهرة وتفاعلية.

**الملفات**:

- `tests/e2e/editor-interaction.e2e.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار Playwright يفعل الآتي:

1. **اختبار: تحميل الصفحة الرئيسية** — انتقل إلى `baseURL` وتحقق أن:
   - العنوان أو عنصر header ظاهر
   - منطقة المحرر (EditorArea) ظاهرة — ابحث عن `data-testid="editor-area"` أو محدد CSS مناسب بناءً على `src/components/editor/EditorArea.ts`
   - الشريط الجانبي (AppSidebar) أو شريط الأدوات ظاهر

2. **اختبار: الكتابة في المحرر** — انقر على منطقة المحرر، اكتب نصاً عربياً (`"داخلي - شقة أحمد - ليل"`) باستخدام `page.keyboard.type()`. تحقق أن النص يظهر في المحرر.

3. **اختبار: اتجاه النص RTL** — تحقق أن منطقة المحرر لها `dir="rtl"` أو `direction: rtl` في CSS.

4. **اختبار: التنقل بلوحة المفاتيح** — اضغط Enter لإنشاء سطر جديد، ثم اكتب نصاً آخر. تحقق أن هناك سطرين على الأقل.

**✅ معيار القبول**: تشغيل `pnpm run test:e2e -- tests/e2e/editor-interaction.e2e.test.ts` ينجح — التطبيق يُحمّل والمحرر يقبل الإدخال.

---

### الخطوة 19: اختبار E2E — لصق وتصنيف نص سيناريو

**الهدف**: التحقق من المسار الحرج الأهم — لصق نص سيناريو في المحرر وتصنيفه تلقائياً.

**الملفات**:

- `tests/e2e/paste-and-classify.e2e.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار Playwright يفعل الآتي:

1. **تجهيز**: حمّل محتوى `sample-screenplay-full-scene.txt` في سلسلة نصية.

2. **اختبار: لصق نص كامل** — انقر على المحرر، ثم الصق النص باستخدام:

```typescript
await page.evaluate((text) => {
  navigator.clipboard.writeText(text);
}, sceneText);
await page.keyboard.press("Control+V"); // أو Meta+V على Mac
```

أو استخدم `page.keyboard.insertText(sceneText)` إن لم يعمل الحافظة.
تحقق أن المحرر يحتوي الآن على النص الملصوق.

3. **اختبار: ظهور التصنيف** — بعد اللصق، انتظر لحظة (`waitForTimeout(2000)` أو `waitForSelector` أدق) ثم تحقق من ظهور مؤشرات التصنيف البصرية:
   - ابحث عن عناصر DOM تحمل `data-line-type="scene-header"` أو فئات CSS مرتبطة بنوع السطر
   - تحقق من وجود عنصر واحد على الأقل بنوع `scene-header`
   - تحقق من وجود عنصر واحد على الأقل بنوع `character`
   - تحقق من وجود عنصر واحد على الأقل بنوع `dialogue`

4. **اختبار: التمييز اللوني** — تحقق أن عنوان المشهد له لون أو خلفية مختلفة عن الحوار (باستخدام `getComputedStyle`).

**✅ معيار القبول**: تشغيل الاختبار ينجح — النص يُلصق ويُصنّف تلقائياً مع مؤشرات بصرية.

---

### الخطوة 20: اختبار E2E — استيراد ملف كامل والتصنيف

**الهدف**: التحقق من مسار استيراد ملف خارجي (.txt أو .docx) عبر واجهة المستخدم والتصنيف التلقائي.

**الملفات**:

- `tests/e2e/full-import-classify-flow.e2e.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار Playwright يفعل الآتي:

1. **اختبار: فتح قائمة استيراد** — ابحث عن زر "استيراد" أو "Import" في واجهة التطبيق (راجع `src/controllers/insert-menu-controller.ts` و `src/constants/insert-menu.ts` لمعرفة المحددات). انقر عليه.

2. **اختبار: رفع ملف .txt** — استخدم Playwright File Chooser:

```typescript
const fileChooserPromise = page.waitForEvent("filechooser");
await page.click('[data-testid="import-button"]'); // أو المحدد الفعلي
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles("tests/fixtures/sample-screenplay-full-scene.txt");
```

انتظر انتهاء الاستيراد (ابحث عن مؤشر تحميل يختفي أو عنصر محتوى يظهر).

3. **اختبار: التحقق من المحتوى المُستورد** — بعد الاستيراد:
   - تحقق أن المحرر يحتوي نصاً (ليس فارغاً)
   - تحقق أن عدد الأسطر في المحرر يتناسب مع عدد أسطر الملف المصدر
   - تحقق من ظهور تصنيفات (عنصر واحد على الأقل بنوع سطر مُعرّف)

4. **اختبار: لا أخطاء في Console** — سجّل أخطاء وحدة التحكم أثناء الاختبار:

```typescript
const errors: string[] = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
// ... الاختبار ...
expect(errors.length).toBe(0);
```

**✅ معيار القبول**: تشغيل الاختبار ينجح — الملف يُستورد ويُصنّف بدون أخطاء في وحدة التحكم.

---

### الخطوة 21: اختبار E2E — تصدير السيناريو

**الهدف**: التحقق من أن المستخدم يستطيع تصدير السيناريو المُصنّف إلى ملف خارجي.

**الملفات**:

- `tests/e2e/export-screenplay.e2e.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار Playwright يفعل الآتي:

1. **تجهيز**: الصق أو استورد نص سيناريو كامل في المحرر (أعد استخدام منطق الخطوة 19).

2. **اختبار: فتح قائمة التصدير** — ابحث عن زر "تصدير" أو "Export" (راجع `src/utils/exporters.ts` لمعرفة صيغ التصدير المدعومة). انقر عليه.

3. **اختبار: التصدير كملف** — استخدم Playwright Download handler:

```typescript
const downloadPromise = page.waitForEvent("download");
await page.click('[data-testid="export-txt-button"]'); // أو المحدد الفعلي
const download = await downloadPromise;
const filePath = await download.path();
```

تحقق أن:

- الملف مُحمَّل بنجاح (`filePath` ليس `null`)
- الملف غير فارغ (حجمه > 0 bytes)
- محتوى الملف يحتوي نصاً عربياً (اقرأ أول 100 bytes وتحقق من وجود أحرف عربية)

4. **اختبار: سلامة المحتوى المُصدّر** — قارن عدد الأسطر في الملف المُصدّر مع عدد الأسطر في المحرر (يجب أن يتناسبا تقريباً).

**✅ معيار القبول**: تشغيل الاختبار ينجح — السيناريو يُصدّر كملف غير فارغ بمحتوى عربي صحيح.

---

## المرحلة 7: التكامل النهائي والتحقق (خطوات 22-23)

### الخطوة 22: إنشاء مسار اختبار شامل (Smoke Test Suite)

**الهدف**: بناء مجموعة اختبار دخان واحدة تشغّل أهم المسارات الحرجة بالترتيب كخطوة تحقق سريعة.

**الملفات**:

- `tests/integration/smoke.integration.test.ts` — إنشاء

**التنفيذ**:
أنشئ ملف اختبار واحد يُنفّذ المسار الحرج الكامل بالترتيب:

```
تحميل fixture → تطهير → تطبيع → تصنيف هجين → فحص جودة → التحقق من النتائج
```

1. حمّل `sample-screenplay-full-scene.txt` كنص خام.
2. مرّره عبر `input-sanitizer` → احفظ النتيجة.
3. مرّر النتيجة عبر `normalize` → احفظ النتيجة.
4. مرّر النتيجة عبر `hybrid-classifier` → احفظ النتيجة.
5. مرّر كل سطر مُصنّف عبر `line-quality` → احفظ درجات الجودة.
6. تحقق من:
   - كل الأسطر مُصنّفة (`assertAllLinesClassified`)
   - التسلسل منطقي (`assertSequenceValid`)
   - متوسط الجودة فوق عتبة محددة (مثلاً 0.6)
   - الوقت الكلي أقل من 10 ثوانٍ

سجّل النتائج الكاملة عبر `logTestSuiteEnd`.

**✅ معيار القبول**: تشغيل `pnpm run test:integration -- tests/integration/smoke.integration.test.ts` ينجح في أقل من 10 ثوانٍ.

---

### الخطوة 23: إعداد تقارير الاختبار والتحقق النهائي

**الهدف**: ضبط مخرجات الاختبار وتنفيذ الأمر الشامل `test:all` للتأكد من عمل كل شيء معاً.

**الملفات**:

- `.gitignore` — تعديل: إضافة مسارات مخرجات الاختبار
- `package.json` — تعديل: التأكد من سكربت `test:all`

**التنفيذ**:

1. أضف إلى `.gitignore`:

```
# مخرجات الاختبار
test-results/
playwright-report/
coverage/
*.log
```

2. تأكد أن مجلد `test-results/` مُنشأ تلقائياً (أضف سكربت `pretest` إن لزم):

```json
{
  "pretest:all": "mkdir -p test-results"
}
```

3. نفّذ الأوامر التالية بالترتيب وتحقق من نجاح كل منها:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test:integration
pnpm run test:e2e
```

4. إذا فشل أي أمر، أصلح المشكلة قبل الانتقال للأمر التالي.

5. أخيراً، نفّذ الأمر الشامل:

```bash
pnpm run test:all
```

**✅ معيار القبول**: تشغيل `pnpm run test:all` ينجح بالكامل — كل اختبارات التكامل واختبارات E2E تمر بنجاح.

---

## ملاحظات ختامية

- **الأولوية الحرجة**: الخطوات 1-4 (البنية التحتية) ثم 6 و 10 و 13 و 22 (المسارات الحرجة). هذه وحدها تشكل اختبار دخان فعال.
- **اختبارات OCR**: إذا كان `MISTRAL_API_KEY` غير متوفر، يجب أن تُتخطى اختبارات `mistral-ocr-request-adapter` تلقائياً باستخدام `describe.skipIf(!config.MISTRAL_API_KEY)`.
- **اختبارات الخادم**: الملفات في `server/` مكتوبة بـ `.mjs` — قد تحتاج إعدادات ESM خاصة في Vitest (`pool: 'forks'` أو `transformMode`).
- **data-testid**: إذا لم تكن سمات `data-testid` موجودة في مكونات React، يجب إضافتها قبل كتابة اختبارات E2E (خاصة في `EditorArea.ts`, `AppHeader.tsx`, `AppSidebar.tsx`).
- **تحسين مستقبلي**: إضافة اختبارات أداء (Performance Benchmarks) لقياس سرعة التصنيف على نصوص كبيرة (1000+ سطر).
- **CI/CD**: بعد استقرار الاختبارات محلياً، يمكن إضافة GitHub Actions workflow يُنفّذ `pnpm run test:all` على كل Pull Request.

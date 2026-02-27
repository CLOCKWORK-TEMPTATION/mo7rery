## تصحيح نهائي لمسار PDF OCR + معالجة خطأ `pdftoppm` قبل التشغيل

### 1) الملخص
الهدف هو اعتماد سياسة تحقق إلزامي مبكر لمسار OCR للـ PDF بدون أي مسارات بديلة صامتة.  
أي نقص في المفاتيح، أو نماذج Vision، أو اعتماد نظامي مثل `pdftoppm` يجب أن يوقف التنفيذ برسالة وكود خطأ ثابت، مع إظهار السبب للمستخدم قبل بدء الاستيراد قدر الإمكان.

### 2) المشاكل الحالية المؤكدة من الكود
1. يوجد toggle فعلي لـ Vision عبر `PDF_VISION_ENABLED` (`visionEnabled`) وهذا يسمح بتجاوز جزء من التحقق.
2. يوجد مسار fallback legacy مشروط بـ `PDF_OCR_AGENT_LEGACY_FALLBACK` داخل runner.
3. فحص `pdftoppm` يحدث أثناء التنفيذ فقط، لذلك واجهة المستخدم ترى 500 متأخر.
4. `/health` لا يعلن جاهزية `pdftoppm` بشكل صريح، وبالتالي الواجهة لا تستطيع التحذير المبكر.
5. في بيئة ويندوز الحالية، `pdftoppm` مثبت فعليًا ضمن Poppler لكنه غير موجود في PATH الخاص بعملية Node.

### 3) تغييرات الواجهات العامة (APIs / Types)
1. تحديث استجابة `GET /health` لتشمل:
- `ocrConfigured: boolean` (نهائي بعد فحص كل المتطلبات)
- `ocrAgent.strictValidation: true`
- `ocrAgent.dependencies.pdftoppm: { available: boolean; command: string; errorCode?: string; errorMessage?: string }`
- `ocrAgent.errorCodes: string[]`
2. تحديث أخطاء `POST /api/file-extract` لتشمل:
- `errorCode?: string` (مفصول عن `error` النصي)
- مع إبقاء `error` للتوافق.
3. تحديث نوع `FileExtractionResponse` في الواجهة لدعم `errorCode`.

### 4) خطة التنفيذ التفصيلية (Decision Complete)

#### A) تثبيت سياسة التحقق الإلزامي المبكر كسياسة غير قابلة للتعطيل
1. حذف `PDF_VISION_ENABLED` من إعدادات agent schema والـ env parsing.
2. جعل متطلبات Vision إلزامية دائمًا:
- `MISTRAL_API_KEY`
- `MOONSHOT_API_KEY`
- `PDF_VISION_COMPARE_MODEL`
- `PDF_VISION_JUDGE_MODEL`
3. حذف مسار `PDF_OCR_AGENT_LEGACY_FALLBACK` بالكامل من runner.
4. اعتبار أي فشل في `open-pdf-agent` فشل نهائي بدون fallback.

#### B) إصلاح اعتماد `pdftoppm` بشكل مركزي ومبكر
1. اعتماد متغير بيئة جديد:
- `POPPLER_BIN` (مسار مجلد `bin` الخاص بـ Poppler، وليس مسار الملف نفسه).
2. إضافة `POPPLER_BIN` في `.env`:
- `POPPLER_BIN=C:/Users/Mohmed Aimen Raed/AppData/Local/Microsoft/WinGet/Packages/oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe/poppler-25.07.0/Library/bin`
3. إنشاء helper مركزي في `server/pdf-reference-builder.mjs`:
- `resolvePdftoppmCommand()`:
  - إذا `POPPLER_BIN` موجود: يبني مسار الأداة من `join(POPPLER_BIN, pdftoppm(.exe))`.
  - إذا غير موجود: يستخدم `pdftoppm` من PATH.
4. استخدام نفس helper في:
- `ensurePdftoppmAvailable()`
- `renderPdfPages()`
- `renderFirstPdfPage()`
5. نفس فحص الجاهزية يجب أن يظهر في:
- `getPdfOcrAgentHealth()`
- بداية `runPdfOcrAgent()` قبل أي معالجة.
6. أكواد الأخطاء الثابتة المعتمدة:
- `PDF_OCR_PDF_RENDERER_MISSING`
- `PDF_OCR_PDF_RENDERER_UNUSABLE`
- `PDF_OCR_CFG_MISSING_MISTRAL_API_KEY`
- `PDF_OCR_CFG_MISSING_MOONSHOT_API_KEY`
- `PDF_OCR_CFG_MISSING_VISION_COMPARE_MODEL`
- `PDF_OCR_CFG_MISSING_VISION_JUDGE_MODEL`
7. إجراء تشغيلي إلزامي بعد التعديل:
- إيقاف أي عملية backend قديمة.
- إعادة تشغيل `node server/file-import-server.mjs`.

#### C) تحسين تجربة الواجهة بدون إدخال fallback
1. قبل إرسال ملف PDF إلى `file-extract` يتم `GET /health`.
2. إذا `ocrConfigured=false` أو `pdftoppm.available=false`:
- إيقاف الإرسال.
- عرض Toast عربي صريح مع `errorCode` وخطوة إصلاح مباشرة.
3. لو فشل الطلب فعليًا بـ 500:
- استخراج `errorCode` من body إن وجد.
- إظهار رسالة مخصصة بدلاً من الرسالة العامة الخام.
4. عدم إضافة أي fallback extraction في الواجهة.

#### D) ضبط أنواع البيانات في الواجهة
1. توسيع `FileExtractionResponse` لإضافة `errorCode?: string`.
2. إضافة parser صغير يحول `errorCode` إلى رسالة عربية ثابتة.
3. إبقاء التوافق مع الرسائل الحالية عند عدم وجود `errorCode`.

#### E) التوثيق التشغيلي
1. تحديث README قسم OCR بالمتطلبات الإلزامية:
- ضرورة `pdftoppm`
- كيفية ضبط `POPPLER_BIN` (Windows/Linux)
- أمثلة `errorCode`
2. إضافة قسم “Startup readiness checklist” مختصر:
- المفاتيح
- النماذج
- `pdftoppm` command resolved
- نتيجة `/health`

### 5) الملفات المستهدفة للتنفيذ
1. `server/pdf-ocr-agent-config.mjs`
2. `server/pdf-reference-builder.mjs`
3. `server/pdf-ocr-agent-runner.mjs`
4. `server/file-import-server.mjs`
5. `src/utils/file-import/extract/backend-extract.ts`
6. `src/types/file-import.ts`
7. `src/App.tsx`
8. `.env`
9. `README.md`

### 6) الاختبارات المطلوبة
1. Unit:
- فشل config عند غياب أي مفتاح/موديل إلزامي.
- فشل dependency check عند غياب `pdftoppm`.
- نجاح dependency check عند توفير `POPPLER_BIN` صحيح.
2. Integration (backend):
- `/health` يعرض `ocrConfigured=false` و`pdftoppm.available=false` عند غياب الأداة.
- `/api/file-extract` يرجع 500 مع `errorCode=PDF_OCR_PDF_RENDERER_MISSING`.
- لا وجود لمسار fallback legacy.
3. E2E:
- رفع PDF مع `pdftoppm` غير متاح يظهر رسالة واضحة للمستخدم بدون استكمال pipeline.
- عند جاهزية البيئة، المسار يستمر طبيعيًا.
4. Regression:
- عدم تأثر استيراد `txt/doc/docx/fountain/fdx`.
- عدم كسر contract الحالي للواجهة.

### 7) معايير القبول
1. لا يوجد أي env flag يعطل التحقق الإلزامي المبكر لمسار PDF OCR.
2. كل فشل جاهزية يرجع `errorCode` ثابت + رسالة واضحة.
3. المستخدم يرى السبب القابل للإصلاح قبل/أثناء الفشل مباشرة.
4. لا fallback صامت ولا مسارات بديلة عند نقص المتطلبات.

### 8) الافتراضات والافتراضات الافتراضية
1. الزوج المعتمد يظل: `Mistral` Comparator و`Kimi` Judge.
2. التطبيق لن يثبت Poppler تلقائيًا؛ فقط يكتشفه ويعرض إرشادًا واضحًا.
3. متغير التشغيل المعتمد لمسار Poppler هو `POPPLER_BIN`.
4. النطاق محصور في مرحلة الاستخراج فقط.

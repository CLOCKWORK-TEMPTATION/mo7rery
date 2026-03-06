# GEMINI.md - Avan Titre (أفان تيتر)

هذا الملف يوفر السياق الإرشادي والمعايير التقنية لمشروع **أفان تيتر**، وهو محرر سيناريو عربي احترافي.

## 1. نظرة عامة على المشروع (Project Overview)
**أفان تيتر** هو محرر نصوص سيناريو متخصص مبني للويب، يهدف لحل مشاكل التنسيق اليدوي واستيراد النصوص العربية غير المهيكلة.

- **الهدف الأساسي**: توفير تجربة كتابة سيناريو طبيعية مع تصنيف تلقائي ذكي لعناصر السيناريو (مشهد، شخصية، حوار، إلخ).
- **التقنيات الأساسية**:
  - **Frontend**: React 19, TypeScript (Strict), Vite, Tiptap v3 (ProseMirror), Tailwind CSS (OKLCH).
  - **Backend**: Node.js (Express 5), Puppeteer (PDF Export), Antiword (DOC Extraction).
  - **AI Layers**: Anthropic (Claude), Mistral (OCR), Moonshot (Kimi), Google (Gemini).
- **المعمارية**: نمط هجين (Hybrid) يجمع بين React للغلاف الخارجي (Shell) وفئات حتمية (Imperative Classes) لإدارة محرك التحرير Tiptap لتجنب مشاكل المزامنة وضمان الأداء.

---

## 2. نظام التصنيف التلقائي (Classification Pipeline)
يمر النص (عند اللصق أو الاستيراد) عبر 4 طبقات تصنيف:
1. **Regex Patterns**: كواشف أنماط عربية محددة (`arabic-patterns.ts`).
2. **Context Rules**: قواعد تعتمد على سياق العناصر السابقة وذاكرة الشخصيات (`context-memory-manager.ts`).
3. **Hybrid Classifier**: نظام تسجيل درجات (Scoring) مع تحسين التسلسل الهيكلي.
4. **AI Agent Fallback**: إرسال الحالات المشكوك فيها إلى وكيل AI (Claude) عبر Backend.

---

## 3. أوامر التشغيل والتطوير (Building and Running)

| الأمر | الوظيفة |
| :--- | :--- |
| `pnpm dev` | تشغيل متزامن لـ Vite (Frontend) و Express (Backend) |
| `pnpm build` | بناء المشروع للإنتاج (TypeScript + Vite) |
| `pnpm validate` | تشغيل جميع فحوصات الجودة (Format + Lint + Typecheck + Test) |
| `pnpm test` | تشغيل اختبارات الوحدة والتكامل (Vitest) |
| `pnpm test:e2e:audit` | تشغيل تدقيق شامل للواجهة عبر Playwright |
| `pnpm typecheck` | فحص أنواع TypeScript فقط |
| `pnpm file-import:server` | تشغيل سيرفر الـ Backend فقط (Port 8787) |

---

## 4. اتفاقيات التطوير (Development Conventions)

### التسميات والهيكلة:
- **الملفات**: `kebab-case.ts` (مثل `paste-classifier.ts`).
- **الفئات (Classes)**: `PascalCase` (مثل `PostClassificationReviewer`).
- **الثوابت**: `SCREAMING_SNAKE_CASE` (مثل `SCREENPLAY_ELEMENTS`).
- **اللغة**: الواجهة عربية بالكامل، الاتجاه RTL، الكود والتعليقات بالإنجليزية أو العربية حسب الحاجة.

### عناصر السيناريو (ElementType):
يتم التعامل مع 8 أنواع أساسية:
- `basmala`, `sceneHeaderTopLine`, `sceneHeader1`, `sceneHeader2`, `sceneHeader3`, `action`, `character`, `dialogue`, `parenthetical`, `transition`.

### المتطلبات البيئية (.env):
يجب توفر مفاتيح API لكل من Anthropic, Mistral, Moonshot, و Gemini لضمان عمل كامل وظائف الذكاء الاصطناعي و OCR.

### معايير الكود:
- استخدام `pnpm` حصراً كمدير حزم (v10.28+).
- الالتزام بنظام الألوان `OKLCH` في CSS و Tailwind.
- المكونات في `src/components/ui/` تتبع نمط مصنع DOM (`_factory.ts`) ولا تستخدم JSX غالباً.

---

## 5. هيكلية المجلدات الرئيسية (Key Directories)
- `src/extensions/`: امتدادات Tiptap ومحرك التصنيف (القلب النابض للمحرر).
- `src/components/app-shell/`: المكونات الهيكلية للتطبيق (Header, Sidebar, Dock).
- `server/`: سيرفر Express والخدمات المساندة (OCR, Agent Review).
- `src/ocr-arabic-pdf-to-txt-pipeline/`: نظام فرعي مستقل لمعالجة PDF OCR.
- `scripts/`: سكربتات PowerShell و Node لإدارة المهام والتحقق المسبق.

---

## 6. ملاحظات هامة للوكلاء (Agent Notes)
- لا تلمس إعدادات `ProseMirror` أو `Tiptap` دون فهم عميق لـ `src/editor.ts`.
- أي تغيير في نظام التصنيف يجب أن يُختبر مقابل `tests/integration/classification-pipeline.test.ts`.
- المشروع يدعم الوضع الداكن فقط (Dark-only).
- تأكد دائماً من تشغيل `pnpm run start:preflight` قبل بدء التطوير للتأكد من جاهزية البيئة (خاصة Antiword).

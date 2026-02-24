# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## المشروع

**أفان تيتر (Avan Titre)** — محرر سيناريو عربي احترافي مبني على React 19 + Tiptap v3 (ProseMirror). RTL بالكامل، واجهة عربية، وضع داكن فقط.

## أوامر التطوير

```bash
pnpm dev                    # تشغيل التطبيق + الخادم الخلفي معاً (المنفذ 3000 + 8787)
pnpm build                  # بناء الإنتاج (tsc && vite build)
pnpm test                   # كل الاختبارات مع تغطية
pnpm test:unit              # اختبارات الوحدة فقط
pnpm test:harness           # اختبارات harness
npx vitest run <path>       # تشغيل ملف اختبار واحد
pnpm format                 # تنسيق بـ Prettier
```

الخادم الخلفي (`server/file-import-server.mjs`) يعمل على المنفذ 8787 ويوفر:

- `POST /api/file-extract` — استخراج النص من PDF/DOC/DOCX
- `POST /api/agent/review` — مراجعة AI بـ Claude Opus 4.6

## النمط المعماري

**هجين**: React للغلاف البصري (shell) + فئات حتمية (imperative classes) لمحرك التحرير + مصنع DOM (`_factory.ts`) لمكونات Radix UI.

**السبب**: Tiptap/ProseMirror يعمل بنموذج حتمي. الفئات الحتمية تتجنب مشاكل المزامنة مع حالة React وتوفر أداءً أفضل مع التحديثات المتكررة.

### قرارات معمارية مهمة (لا تخالفها)

- **فئات حتمية بدل React**: EditorArea, EditorHeader, EditorToolbar, EditorFooter, EditorSidebar كلها class-based تتعامل مع DOM مباشرة — لا تحوّلها لمكونات React
- **مصنع DOM لـ UI**: `_factory.ts` يُنشئ عناصر Radix UI عبر `document.createElement` بدون JSX — الاستثناء الوحيد `hover-border-gradient.tsx`
- **خط ثابت**: AzarMehrMonospaced-San — 12pt، تباعد أسطر 15pt (معيار صناعي: صفحة ≈ دقيقة شاشة)
- **MIME مخصص للحافظة**: `application/x-filmlane-blocks+json` — يحفظ التصنيف عند النسخ الداخلي
- **نافذة سياق 8 عناصر**: `ContextMemoryManager` يتتبع آخر 8 أنواع مصنّفة (كافية لمشهد نموذجي)

### الطبقات الرئيسية

| الطبقة                    | الملفات                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| نقطة الدخول               | `main.tsx`, `App.tsx`                                                                                    |
| محرك التحرير              | `components/editor/EditorArea.ts`, `editor.ts`                                                           |
| عُقد السيناريو (10 أنواع) | `extensions/{action,character,dialogue,...}.ts`                                                          |
| خط أنابيب التصنيف         | `extensions/paste-classifier.ts`, `classification-core.ts`, `hybrid-classifier.ts`, `arabic-patterns.ts` |
| استيراد الملفات           | `utils/file-import/*.ts`                                                                                 |
| الخادم الخلفي             | `server/*.mjs`                                                                                           |

## خط أنابيب التصنيف (الميزة الأساسية)

4 طبقات بأولوية تنازلية — أول طبقة تعيد نتيجة بثقة كافية تُنهي السلسلة:

1. **Regex** (`arabic-patterns.ts`): 450+ فعل وصفي، أنماط رؤوس المشاهد، أسماء الشخصيات
2. **سياق** (`classification-sequence-rules.ts`): ذاكرة آخر 8 أنواع + تكرارات الشخصيات
3. **هجين** (`hybrid-classifier.ts`): يجمع كل الإشارات مع درجات ثقة — يشمل `resolveNarrativeDecision` لحسم الحالات الغامضة بين action وdialogue عبر 5 عوامل نقطية
4. **وكيل AI** (اختياري): Claude Opus 4.6 عبر `/api/agent/review` — يُفعّل فقط عند شك ≥ 74 مع ≥ 2 إشارات

### نظام المراجعة اللاحقة (`PostClassificationReviewer`)

يعمل بعد التصنيف في `classification-core.ts` عبر 5 كاشفات:

- `sequence-violation` — تسلسل عناصر غير منطقي
- `content-type-mismatch` — محتوى لا يتوافق مع التصنيف (الأكثر تعقيداً)
- `split-character-fragment` — اسم شخصية مقسم على سطرين
- `statistical-anomaly` — عدد كلمات خارج الحدود
- `confidence-drop` — ثقة منخفضة في التصنيف

**نطاقات التوجيه (routing bands)**:

- `pass` (< 65): لا إجراء
- `local-review` (65-80): تصحيح محلي
- `agent-candidate` (80-90): قد يُصعّد للوكيل
- `agent-forced` (≥ 90): يجب مراجعة AI

**قيود التصعيد**: الحد الأقصى للسطور المشبوهة 8% من إجمالي السطور. التصعيد يمر عبر `promoteHighSeverityMismatches()` في `paste-classifier.ts` الذي يرقّي `agent-candidate` إلى `agent-forced` عند `suspicionScore ≥ 96`.

## أنواع عناصر السيناريو

```
ElementType = "basmala" | "sceneHeaderTopLine" | "sceneHeader3" |
              "action" | "character" | "dialogue" | "parenthetical" | "transition"
```

في HTML، تُخزن كـ `data-type` على عناصر `<p>` (مع kebab-case: `scene-header-1`).

### سلسلة Enter وتدوير Tab

```
Enter: بسملة → فوتو مونتاج → رأس مشهد 1 → ... → وصف
       وصف → وصف | شخصية → حوار | حوار → وصف | تعليمات حوار → حوار | انتقال → فوتو مونتاج
Tab:   وصف → شخصية → حوار → تعليمات حوار → انتقال → وصف
```

## استيراد الملفات

خط الأنابيب: اختيار الملف → استخراج النص → معالجة مسبقة → تصنيف → إدراج في المحرر.

المعالج المسبق يُطبّق تطبيعاً خاصاً بنوع الملف: إزالة أرقام صفحات PDF، تحويل تنسيقات DOC البصرية، توحيد أحرف الأسطر. **مهم**: عند الاستيراد، `data-type` attributes تُفقد ويُعاد تصنيف النص من جديد عبر `classifyText()`.

## تخطيط الصفحة

أبعاد A4 ثابتة: 794×1123px @ 96 PPI. هوامش: علوي/سفلي 77px، أيسر 96px، أيمن 120px. ارتفاع المحتوى 969px. هذه القيم مقفلة لمعيار الصناعة (صفحة واحدة ≈ دقيقة شاشة). الترقيم عبر Tiptap Pages Extension مع ResizeObserver + MutationObserver.

## اصطلاحات الكود

| العنصر            | الاصطلاح               |
| ----------------- | ---------------------- |
| أسماء الملفات     | `kebab-case.ts`        |
| مكونات/فئات       | `PascalCase`           |
| ثوابت             | `SCREAMING_SNAKE_CASE` |
| متغيرات           | `camelCase`            |
| خطافات            | بادئة `use-`           |
| استيرادات الأنواع | `import type` دائماً   |
| مسار مختصر        | `@/*` → `./src/*`      |

- **Prettier**: مسافتان، فاصلة منقوطة، علامات اقتباس مزدوجة، 80 حرف عرض، `prettier-plugin-tailwindcss`
- **TypeScript strict mode**: مع `noUnusedLocals` و `noUnusedParameters`
- **لا يوجد ESLint**: المشروع يعتمد على TypeScript strict + Prettier فقط
- الأنواع في `classification-types.ts` كلها `readonly` — لا تعديل مباشر
- نصوص الواجهة بالعربية، معرّفات الكود بالإنجليزية

## بنية الاختبارات

```
tests/
├── setup/vitest.setup.ts       # إعداد (mocks لـ ResizeObserver, matchMedia, ClipboardItem)
├── harness/                    # اختبارات harness مع fixtures
└── unit/
    ├── editor/                 # اختبارات المحرر
    ├── extensions/             # اختبارات التصنيف والمراجعة
    ├── file-import/            # اختبارات الاستيراد
    └── server/                 # اختبارات عقد الخادم
```

بيئة الاختبار: **Vitest + jsdom**. التغطية بـ v8. CI عبر `.github/workflows/smoke-extract.yml` (Ubuntu, Node 20, pnpm 10.28.0).

## ملاحظات مهمة

- `classifyLines()` دالة غير مُصدّرة في `paste-classifier.ts` — الوصول عبر `classifyText()` المُصدّرة
- `arabic-patterns.ts` يحتوي `FULL_ACTION_VERB_SET` (450+ فعل) — أضف أفعال جديدة هناك
- `ContextMemoryManager` يحتفظ بآخر 120 تسجيل في الذاكرة + localStorage، ويتتبع: آخر 8 أنواع، تكرارات الشخصيات، نص السطر السابق
- الخادم يستخدم `antiword` لملفات `.doc` القديمة (مسار Windows: `C:/antiword/antiword.exe`)
- مسجّل التطبيق عبر `utils/logger.ts` وليس `console.log` مباشرة
- `ThemeProvider` فئة class-based (ليس React Context) تكتب مباشرة على `document.documentElement`

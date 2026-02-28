1. أين تضع ملفات unstructured داخل مشروعك الحالي؟

ضعها هنا (داخل نفس طبقة الـ pipeline لديك):

src/pipeline/unstructured/
types.ts
normalize.ts
segmenter.ts
classifier.ts
validator.ts
to-structured-text.ts
detect.ts
index.ts
1.1 ربط ملفات “المشروع الجديد” بملفات مشروعك الحالي (Mapping 1:1)
وظيفة المشروع الجديد المكان في مشروعك الحالي
types.ts src/pipeline/unstructured/types.ts
normalize.ts src/pipeline/unstructured/normalize.ts
segmenter.ts src/pipeline/unstructured/segmenter.ts
classifier.ts src/pipeline/unstructured/classifier.ts
validator.ts src/pipeline/unstructured/validator.ts
(بدل converter إلى Fountain/FDX) src/pipeline/unstructured/to-structured-text.ts
Router threshold 0.70 src/pipeline/unstructured/detect.ts
facade واحدة src/pipeline/unstructured/index.ts

ملحوظة مهمة:
نحن هنا لا نستخدم exporters لأن مشروعك لديه Exporters جاهزة (src/utils/exporters/\*).
هدف هذه الطبقة: تحويل النص غير المهيكل إلى نص مُعاد هيكلته (سطر-بسطر) ليأكله محرّك التصنيف الحالي.

2. ما الذي “يتضم على إيه” (Wiring الدقيق)
   2.1 نقطة الدمج الوحيدة (تغطي كل المسارات الأربعة)

الدمج يكون داخل:

src/components/editor/EditorArea.ts
داخل الدالة:

importClassifiedText = async (text, mode, context?) => { ... }
تعديل 1: إدراج unstructured قبل applyPasteClassifierFlowToView

قبل:

const applied = await applyPasteClassifierFlowToView(this.editor.view, text, {...});

تضيف:

حساب جودة qualityScore

إذا < 0.70 أو detect says unstructured → شغّل reconstruction

استبدل text بالنص المُعاد هيكلته

3. detect.ts (قرار unstructured على الأربع مسارات) — threshold 0.70

ملف: src/pipeline/unstructured/detect.ts

القرار يعتمد على:

جودة سريعة (line-quality)

heuristics خاصة بنصوصك (مشهد1 بدون مسافة / قطع مشهد… / الرمز  / دمج speaker داخل سطر)

3.1 من أين تأتي الجودة؟

عندك بالفعل محرك قوي في:
src/pipeline/quality/line-quality.ts

استخدمه لحساب متوسط جودة الأسطر.

قواعد القرار:

إذا score < 0.70 → unstructured

أو إذا وجدنا مؤشرات قوية حتى لو score أعلى (مثال: قطع مشهد2 ملتصقة)

4. pipeline unstructured: من text → إلى structuredText
   4.1 index.ts (Facade واحدة)

ملف: src/pipeline/unstructured/index.ts

maybeReconstruct(text, opts)
ترجع:

applied: boolean

qualityScore: number

structuredText: string (لو applied)

operations و items اختياريًا للتتبع

4.2 to-structured-text.ts (تحويل items إلى نص جاهز للمصنف الحالي)

ملف: src/pipeline/unstructured/to-structured-text.ts

المبدأ:

كل عنصر يخرج كسطر واحد:

SCENE-HEADER-1 سطر

SCENE-HEADER-2 سطر

SCENE-HEADER-3 سطر

CHARACTER سطر (ينتهي بـ :)

DIALOGUE سطر

ACTION سطر

TRANSITION سطر (قطع)

هذا يضمن أن applyPasteClassifierFlowToView يستقبل نصًا “منطقيًا” وتكون الدقة أعلى.

5. تعديل EditorArea.ts بالتفصيل (1:1)
   5.1 ما الذي ستضيفه بالضبط؟
   (أ) Imports جديدة

في أعلى src/components/editor/EditorArea.ts أضف:

maybeReconstructUnstructured من src/pipeline/unstructured/index

(اختياري) logger إن أحببت

(ب) خطوة reconstruction

داخل importClassifiedText:

خذ text كما هو

شغّل:

const recon = await maybeReconstructUnstructured(text, { threshold: 0.70 })

إذا recon.applied:

استخدم recon.structuredText بدل text

ويمكن حفظ recon.qualityScore للtelemetry أو toast

(ج) لا تغيّر أي شيء في مسار التصنيف الحالي

اترك applyPasteClassifierFlowToView كما هو، فقط غيّر النص الداخل له.

6. المسارات الأربعة بعد الدمج (إثبات أنها كلها مغطاة)
   6.1 لصق (clipboard paste)

يمر من pasteFromClipboard → importClassifiedText(text, "insert")

سيطبق unstructured تلقائيًا لأن الدمج داخل importClassifiedText.

6.2 فتح DOC

extractImportedFile(doc) → buildFileOpenPipelineAction → importClassifiedText(action.text, ...)

سيطبق unstructured تلقائيًا.

6.3 فتح DOCX

نفس المسار السابق.

سيطبق unstructured تلقائيًا.

6.4 لصق TXT

إما من clipboard أو أي مسار يستدعي importClassifiedText مباشرة.

سيطبق unstructured تلقائيًا.

إذن الدمج داخل importClassifiedText وحده يحقق شرطك “unstructured عليهم كلهم” 1:1.

7. ما الذي ستقوم به الـ threshold = 0.70 عمليًا؟

قرار التشغيل:

لو النص واضح ومهيكل (غالبًا score > 0.70) → لا يتدخل unstructured، ويمشي مسار مشروعك الحالي كالمعتاد.

لو النص مكسور/غير مهيكل (score < 0.70) → يقوم:

normalize (including )

segmenter (يعالج قطع مشهد… الملتصقة)

classifier (يفصل اسم : نص)

validator gates

يخرج structuredText

ثم يعاد إدخاله في مسار التصنيف الحالي.

8. نقطة مهمة لتفادي تكرار الشغل على نص مهيكل بالفعل

داخل detect.ts اجعل heuristics “تمنع التدخل” إذا كان النص:

يحتوي عددًا كافيًا من الأسطر القصيرة المنطقية

ويحتوي : على شكل سطور مستقلة (Speaker lines)

ولا يحتوي قطع مشهد ملتصقة ولا مشهد\d بدون مسافة ولا 

هذا يمنع “إفساد” نص جيد.

) أين تضع ملفات unstructured داخل مشروعك الحالي؟

أضف هذا المجلد:

src/pipeline/unstructured/
types.ts
detect.ts
normalize.ts
segmenter.ts
classifier.ts
validator.ts
to-structured.ts
index.ts
1.1) ما وظيفة كل ملف؟
الملف وظيفته الدقيقة
types.ts Types الداخلية + Result النهائي (items/ops/structuredText/structuredBlocks/qualityScore)
detect.ts قرار تشغيل unstructured بناءً على quality + heuristics + threshold=0.70
normalize.ts تطبيع خفيف (يشمل تحويل  لفواصل) بدون تغيير كلمات
segmenter.ts تقسيم أولي + تفكيك قطع مشهد2... الملتحمة
classifier.ts إعادة بناء عناصر السيناريو (BASMALA/HEADERS/ACTION/CHARACTER/DIALOGUE/TRANSITION)
validator.ts Gates (Pass/Fail) لضمان عدم وجود meta text وعدم تكرار “اسم:” داخل DIALOGUE إلخ
to-structured.ts يحّول items إلى structuredText + structuredBlocks (ScreenplayBlock[])
index.ts Facade واحدة: maybeReconstructUnstructured(text, { threshold:0.70 }) 2) المخرج الذي نحتاجه من unstructured (لـ structuredBlocks)

maybeReconstructUnstructured() يجب أن يرجّع:

{
applied: boolean;
qualityScore: number; // 0..1
structuredText: string; // نص سطر-بسطر جاهز للمصنف الحالي
structuredBlocks: ScreenplayBlock[]; // للتتبع/التصدير + structuredHints
debug?: { operationsCount: number; itemsCount: number; reasons: string[] };
}

structuredBlocks هنا يطابق نوع مشروعك الفعلي:
ScreenplayBlock { formatId: "action" | "dialogue" | ... , text: string }
(موجود في src/utils/file-import/document-model.ts).

3. Mapping 1:1 بين ItemType → formatId (مهم جدًا)

في to-structured.ts اعمل mapping ثابت:

ItemType ScreenplayBlock.formatId
BASMALA basmala
SCENE-HEADER-1 scene-header-1
SCENE-HEADER-2 scene-header-2
SCENE-HEADER-3 scene-header-3
ACTION action
CHARACTER character
DIALOGUE dialogue
TRANSITION transition

ثم:

structuredText = blocks.map(b=>b.text.trim()).join("\n")

وبذلك:

نفس “structuredBlocks” تُستخدم كـ:

structuredHints داخل applyPasteClassifierFlowToView لتحسين التصنيف

سجل تتبع/تصدير لاحقًا إذا رغبت (حتى لو DOC/DOCX يفرض paste-classifier)

4. قرار التشغيل على كل المسارات (threshold = 0.70)
   4.1) detect.ts — يعتمد على scoreLine الموجود عندك

في مشروعك يوجد:
src/pipeline/quality/line-quality.ts وفيه scoreLine(text) يرجّع LineQuality.score (0..1).
استخدمه هنا لحساب متوسط الجودة:

قسّم النص لأسطر

احسب avgScore

إن avgScore < 0.70 → applied=true

4.2) Heuristics إضافية (تشغيل حتى لو score أعلى)

لتغطية الأنماط “الخبيثة” في نصوصك:

وجود مشهد\d بدون مسافة (مشهد1)

وجود قطع مشهد\d ملتصقة

وجود 

وجود اسم : نص على نفس السطر بكثرة

هذه العلامات لو ظهرت، شغّل unstructured حتى لو avgScore قريب من 0.70.

5. نقطة الدمج الوحيدة (1:1) داخل EditorArea.ts
   5.1) الملف الذي سنعدّله

src/components/editor/EditorArea.ts

داخل الدالة:

importClassifiedText(text, mode, context?)

حاليًا يستدعي مباشرة:

applyPasteClassifierFlowToView(view, text, { structuredHints: context?.structuredHints, ... })
5.2) التعديل المطلوب (بالمنطق)

أضف قبل applyPasteClassifierFlowToView:

شغّل maybeReconstructUnstructured(text, { threshold: 0.70 })

إذا applied:

text = structuredText

structuredHints = structuredBlocks (أو دمجها مع context?.structuredHints)

ثم تمرّرها كما هي.

5.3) سياسة دمج structuredHints

لأن ممكن تأتي context.structuredHints من مسار آخر لاحقًا، اجعلها:

إذا applied:

finalHints = structuredBlocks

لو توجد context.structuredHints أصلًا:
finalHints = structuredBlocks.concat(context.structuredHints)
(الأولوية للمُعاد هيكلته لأنه أقرب للنص الحالي)

6. تأثير الدمج على المسارات الأربعة (بدون تعديل باقي النظام)
   6.1) لصق (clipboard paste)

يستدعي importClassifiedText(text,"insert") → ستمر طبقة unstructured تلقائيًا.

6.2) فتح DOC

يمر في extractImportedFile → buildFileOpenPipelineAction → importClassifiedText(action.text, ...)
→ ستمر طبقة unstructured تلقائيًا.

6.3) فتح DOCX

نفس المسار → unstructured تلقائيًا.

6.4) لصق TXT

أي نص يمر بـ importClassifiedText → unstructured تلقائيًا.

هذا يحقق شرطك: unstructured عليهم كلهم 1:1 بدون تكرار أي دمج في 4 أماكن مختلفة.

7. ماذا عن “التتبّع/التصدير” باستخدام structuredBlocks؟
   7.1) للتتبّع

بما أن structuredBlocks سيتم تمريرها كـ structuredHints إلى المصنف؛ يمكنك أيضًا تسجيل Telemetry بسيطة (اختياري) داخل importClassifiedText:

applied=true/false

qualityScore

blocksCount

itemsCount/operationsCount

7.2) للتصدير

أنت بالفعل تُصدّر من محتوى المحرر (الذي ينتج بعد التصنيف) عبر exporters:
src/utils/exporters/\*
وبالتالي:

التصدير النهائي سيعكس “الهيكلة بعد التصنيف” (النتيجة الفعلية داخل editor)

وstructuredBlocks ستبقى متاحة كـ “مرجع تتبع” إن رغبت تخزينها في state أو logs.

إذا تريد حفظها داخل المستند نفسه (1:1)، يمكنك لاحقًا تضمينها ضمن Filmlane payload (لكن هذا قرار منفصل).

8. ما الذي سيتضمّن على ماذا (Dependency Graph)

داخل EditorArea.ts:

maybeReconstructUnstructured (جديد)
يستدعي:

detect.ts (threshold 0.70)

ثم normalize.ts → segmenter.ts → classifier.ts → validator.ts

ثم to-structured.ts لإنتاج structuredBlocks + structuredText

ثم:

applyPasteClassifierFlowToView(... structuredHints: structuredBlocks ...) (قديم كما هو)

فيما يلي كل ملفات src/pipeline/unstructured/\* كاملة (TypeScript) جاهزة للصق داخل مشروعك الحالي، ومصممة لتُستخدم كطبقة Reconstruction للنص غير المهيكل، وتُخرج:

structuredText (سطر-بسطر)

structuredBlocks (ScreenplayBlock[]) للتتبّع/التصدير + تمريرها كـ structuredHints

ملاحظة تكامل: هذه الملفات تفترض وجود:

scoreLine من src/pipeline/quality/line-quality.ts

نوع ScreenplayBlock من src/utils/file-import/document-model.ts

1. src/pipeline/unstructured/types.ts
   // src/pipeline/unstructured/types.ts
   import type { ScreenplayBlock } from "../../utils/file-import/document-model";

export type UnstructuredItemType =
| "BASMALA"
| "SCENE-HEADER-1"
| "SCENE-HEADER-2"
| "SCENE-HEADER-3"
| "ACTION"
| "CHARACTER"
| "DIALOGUE"
| "TRANSITION";

export type UnstructuredOpType = "SPLIT" | "MERGE" | "INSERT_COLON" | "RETYPE" | "REMOVE_META";

export interface UnstructuredOperation {
op: UnstructuredOpType;
at: number; // 1-based item index (i)
detail: string;
}

export interface UnstructuredItem {
i: number; // 1..n
type: UnstructuredItemType;
raw: string; // literal substring from input (no loss intent)
normalized: string; // whitespace-normalized + optional ":" insertion for CHARACTER
confidence: number; // 0..1
evidence: string[]; // reason codes
}

export interface UnstructuredResult {
version: "unstructured-v1";
operations: UnstructuredOperation[];
items: UnstructuredItem[];
}

export interface UnstructuredDetectResult {
applied: boolean;
qualityScore: number; // 0..1
reasons: string[];
}

export interface UnstructuredReconstructionResult {
applied: boolean;
qualityScore: number;
structuredText: string;
structuredBlocks: ScreenplayBlock[];
debug?: {
reasons: string[];
operationsCount: number;
itemsCount: number;
};
} 2) src/pipeline/unstructured/normalize.ts
// src/pipeline/unstructured/normalize.ts

export interface UnstructuredNormalizeOptions {
/\*\*

- في نصوصك يظهر الرمز "" كبادئة/فاصل. نحوله لفاصل أسطر (للعمل فقط).
  \*/
  replaceBullets?: boolean;
  /\*\*
- تطبيع أسطر فارغة متتابعة (للعمل فقط).
  \*/
  collapseBlankLines?: boolean;
  }

/\*\*

- تطبيع خفيف “للعمل” فقط:
- - لا يصحّح الكلمات ولا يغيّر المحتوى الدلالي
- - يهدف لتحسين segmentation
    \*/
    export function normalizeForUnstructuredWork(raw: string, opt: UnstructuredNormalizeOptions = {}): string {
    let s = (raw ?? "").replace(/\r\n/g, "\n");

// لا نلمس الكلمات، فقط مسافات/تبويب
s = s
.split("\n")
.map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
.join("\n");

if (opt.replaceBullets ?? true) {
// في ملفاتك "" يظهر كبادئة أسطر حوار/نقاط :contentReference[oaicite:0]{index=0}
s = s.replace(//g, "\n");
}

if (opt.collapseBlankLines ?? true) {
s = s.replace(/\n{3,}/g, "\n\n");
}

return s;
} 3) src/pipeline/unstructured/segmenter.ts
// src/pipeline/unstructured/segmenter.ts

export interface UnstructuredChunk {
raw: string;
}

/\*\*

- تقسيم أولي: كل سطر غير فارغ = chunk
  \*/
  export function segmentToChunks(workText: string): UnstructuredChunk[] {
  const lines = (workText ?? "")
  .split("\n")
  .map((x) => x.trim())
  .filter((x) => x.length > 0);

return lines.map((raw) => ({ raw }));
}

const SCENE_RE = /مشهد\s\*\d+/;
const CUT_WORD_RE = /\bقطع\b/;

/\*\*

- تفكيك السطور الملتحمة مثل:
- "قطع مشهد2 نهار-داخلي ..."
- إلى:
- "قطع"
- "مشهد2 نهار-داخلي ..."
  \*/
  export function splitCutSceneGlue(chunks: UnstructuredChunk[]): UnstructuredChunk[] {
  const out: UnstructuredChunk[] = [];

for (const ch of chunks) {
const t = ch.raw;

    if (CUT_WORD_RE.test(t) && SCENE_RE.test(t)) {
      const idx = t.search(SCENE_RE);
      const left = t.slice(0, idx).trim();
      const right = t.slice(idx).trim();

      if (left) out.push({ raw: left });
      if (right) out.push({ raw: right });
      continue;
    }

    out.push(ch);

}

return out;
} 4) src/pipeline/unstructured/classifier.ts
// src/pipeline/unstructured/classifier.ts
import type {
UnstructuredItem,
UnstructuredItemType,
UnstructuredOperation,
UnstructuredResult,
} from "./types";

type Evidence = string;

const BASMALA_RE = /^(بسم\s+الله\s+الرحمن\s+الرحيم|الله\s+الرحمن\s+الرحيم)/;
const SCENE1_RE = /مشهد\s*\d+/;
const SCENE2_RE = /(ليل|نهار|صباح|مساء|فجر)\s*[-–]?\s\*(داخلي|خارجي)/;
const CUT_ONLY_RE = /^قطع$/;

// "اسم : نص" inline
const INLINE_SPEAKER_RE = /^(.{1,60}?):\s*(.+)$/;
// "اسم :" فقط
const PURE_SPEAKER_RE = /^\s*([^:]{1,60}):\s\*$/;

const STARTS_WITH_NARRATIVE_VERB_RE =
/^(نرى|يدخل|تدخل|يجلس|تجلس|تقف|يقف|تخرج|يخرج|تتجه|يتجه|تضرب|ينظر|تبدو|يبدو|تفتح|يفتح|تغلق|يغلق)/;

function normSpaces(s: string): string {
return (s ?? "").replace(/[ \t]{2,}/g, " ").trim();
}

function mkItem(
i: number,
type: UnstructuredItemType,
raw: string,
normalized: string,
confidence: number,
evidence: Evidence[]
): UnstructuredItem {
return { i, type, raw, normalized, confidence, evidence };
}

/\*\*

- مصنف حتمي للنص غير المهيكل:
- - لا “يفترض” شخصية من داخل الوصف
- - يفك inline speaker
- - يلتقط headers إذا ظهرت بأي صورة (حتى داخل سطر واحد)
    \*/
    export function classifyUnstructuredLines(lines: string[]): UnstructuredResult {
    const operations: UnstructuredOperation[] = [];
    const items: UnstructuredItem[] = [];
    let idx = 1;

const push = (type: UnstructuredItemType, raw: string, normalized: string, conf: number, ev: Evidence[]) => {
items.push(mkItem(idx++, type, raw, normalized, conf, ev));
};

// حالة: بعد أن نلتقط header-1/2 قد يأتي header-3 في السطر التالي
let pendingHeader3 = false;

for (let li = 0; li < lines.length; li++) {
const raw = lines[li];
const norm = normSpaces(raw);

    // 1) BASMALA (السطر الأول فقط)
    if (li === 0 && BASMALA_RE.test(norm)) {
      push("BASMALA", raw, "بسم الله الرحمن الرحيم", 0.98, ["E_BASMALA_PREFIX"]);
      continue;
    }

    // 2) TRANSITION
    if (CUT_ONLY_RE.test(norm)) {
      pendingHeader3 = false;
      push("TRANSITION", raw, "قطع", 0.99, ["E_TRANSITION_CUT"]);
      continue;
    }

    // 3) إذا كنا ننتظر header-3 والسطر الحالي لا يبدو فعلاً وصفيًا ولا متكلمًا ولا انتقالًا:
    // اعتبره مكانًا (SCENE-HEADER-3)
    if (pendingHeader3) {
      const looksSpeaker = PURE_SPEAKER_RE.test(norm) || INLINE_SPEAKER_RE.test(norm);
      const looksVerb = STARTS_WITH_NARRATIVE_VERB_RE.test(norm);
      const looksCut = CUT_ONLY_RE.test(norm);
      const looksHeader1 = SCENE1_RE.test(norm);
      const looksHeader2 = SCENE2_RE.test(norm);

      if (!looksSpeaker && !looksVerb && !looksCut && !looksHeader1 && !looksHeader2) {
        pendingHeader3 = false;
        operations.push({ op: "SPLIT", at: idx, detail: `Header-3 inferred from next line: "${norm}"` });
        push("SCENE-HEADER-3", raw, norm, 0.78, ["E_LOCATION_LINE_NEXT"]);
        continue;
      } else {
        // لو السطر ليس مكانًا، الغِ الانتظار وأكمل عادي
        pendingHeader3 = false;
      }
    }

    // 4) SCENE HEADERS (قد تكون مجمعة في نفس السطر)
    const hasScene1 = SCENE1_RE.test(norm);
    const hasScene2 = SCENE2_RE.test(norm);

    if (hasScene1 || hasScene2) {
      // header-1
      const m1 = norm.match(SCENE1_RE);
      if (m1) {
        const h1 = m1[0].replace(/\s+/g, " ").trim();
        operations.push({ op: "SPLIT", at: idx, detail: `Extract SCENE-HEADER-1 from: "${norm}"` });
        push("SCENE-HEADER-1", raw, h1, 0.95, ["E_SCENE_1_MATCH"]);
      }

      // header-2
      const m2 = norm.match(SCENE2_RE);
      if (m2) {
        // نعيده إلى صيغة “نهار-داخلي” بدون مسافات
        const h2 = `${m2[1]}-${m2[2]}`.replace(/\s+/g, "");
        operations.push({ op: "SPLIT", at: idx, detail: `Extract SCENE-HEADER-2 from: "${norm}"` });
        push("SCENE-HEADER-2", raw, h2, 0.92, ["E_SCENE_2_MATCH"]);
      }

      // header-3 داخل نفس السطر (محاولة خفيفة)
      const possibleLocation =
        norm
          .replace(SCENE1_RE, "")
          .replace(SCENE2_RE, "")
          .trim()
          .replace(/^[\-–]+/, "")
          .trim();

      if (possibleLocation && possibleLocation.length >= 3) {
        const startsWithVerb = STARTS_WITH_NARRATIVE_VERB_RE.test(possibleLocation);
        const looksSpeaker = INLINE_SPEAKER_RE.test(possibleLocation) || PURE_SPEAKER_RE.test(possibleLocation);

        if (!startsWithVerb && !looksSpeaker) {
          operations.push({ op: "SPLIT", at: idx, detail: `Extract SCENE-HEADER-3 from same line: "${norm}"` });
          push("SCENE-HEADER-3", raw, possibleLocation, 0.80, ["E_LOCATION_LINE_SAME"]);
        } else {
          // المكان غالبًا في السطر التالي
          pendingHeader3 = true;
        }
      } else {
        pendingHeader3 = true;
      }

      continue;
    }

    // 5) CHARACTER/DIALOGUE: inline "اسم : نص"
    const inline = norm.match(INLINE_SPEAKER_RE);
    if (inline) {
      const speaker = inline[1].trim();
      const spoken = inline[2].trim();

      // منع استخراج CHARACTER من وصف يبدأ بفعل
      if (!STARTS_WITH_NARRATIVE_VERB_RE.test(norm)) {
        operations.push({ op: "SPLIT", at: idx, detail: `Inline speaker split: "${norm}"` });
        push("CHARACTER", raw, `${speaker} :`, 0.90, ["E_INLINE_SPEAKER_SPLIT"]);
        push("DIALOGUE", raw, spoken, 0.90, ["E_DIALOGUE_AFTER_SPEAKER"]);
        continue;
      }
    }

    // 6) CHARACTER فقط "اسم :"
    if (PURE_SPEAKER_RE.test(norm)) {
      push("CHARACTER", raw, norm, 0.95, ["E_SPEAKER_COLON"]);
      continue;
    }

    // 7) Default ACTION
    push("ACTION", raw, norm, 0.72, ["E_FALLBACK_ACTION"]);

}

return { version: "unstructured-v1", operations, items };
} 5) src/pipeline/unstructured/validator.ts
// src/pipeline/unstructured/validator.ts
import type { UnstructuredResult, UnstructuredItemType } from "./types";

export interface UnstructuredValidationError {
code: string;
message: string;
itemIndex?: number; // i
}

export interface UnstructuredValidationResult {
ok: boolean;
errors: UnstructuredValidationError[];
}

const ELEMENTS: UnstructuredItemType[] = [
"BASMALA",
"SCENE-HEADER-1",
"SCENE-HEADER-2",
"SCENE-HEADER-3",
"ACTION",
"CHARACTER",
"DIALOGUE",
"TRANSITION",
];

const ELEMENT_SET = new Set(ELEMENTS);

// يمنع "اسم :" داخل DIALOGUE
const DIALOGUE_SPEAKER_PREFIX_RE = /^\s*[^:]{1,60}\s*:\s\*/;

export function validateUnstructuredResult(result: UnstructuredResult): UnstructuredValidationResult {
const errors: UnstructuredValidationError[] = [];

if (!result || result.version !== "unstructured-v1") {
return { ok: false, errors: [{ code: "INVALID_VERSION", message: "version يجب أن تكون unstructured-v1." }] };
}

if (!Array.isArray(result.items) || result.items.length === 0) {
return { ok: false, errors: [{ code: "MISSING_ITEMS", message: "items[] مفقودة أو فارغة." }] };
}

for (let k = 0; k < result.items.length; k++) {
const it = result.items[k];
const expected = k + 1;

    if (it.i !== expected) {
      errors.push({ code: "INVALID_INDEX", message: "i يجب أن يكون تسلسليًا يبدأ من 1 بدون فجوات.", itemIndex: it.i });
    }

    if (!ELEMENT_SET.has(it.type)) {
      errors.push({ code: "UNKNOWN_ELEMENT", message: `type غير معتمد: ${String(it.type)}`, itemIndex: it.i });
    }

    if (typeof it.raw !== "string" || typeof it.normalized !== "string") {
      errors.push({ code: "INVALID_TEXT", message: "raw/normalized يجب أن يكونا نصوصًا.", itemIndex: it.i });
      continue;
    }

    if (it.raw.trim() === "" || it.normalized.trim() === "") {
      errors.push({ code: "EMPTY_TEXT", message: "ممنوع raw/normalized فارغ.", itemIndex: it.i });
    }

    // CHARACTER يجب أن ينتهي بـ :
    if (it.type === "CHARACTER") {
      if (!it.normalized.trim().endsWith(":")) {
        errors.push({
          code: "CHARACTER_MISSING_COLON",
          message: "CHARACTER.normalized يجب أن ينتهي بـ ':'",
          itemIndex: it.i,
        });
      }
    }

    // DIALOGUE لا يبدأ بـ "اسم :"
    if (it.type === "DIALOGUE") {
      if (DIALOGUE_SPEAKER_PREFIX_RE.test(it.normalized.trim())) {
        errors.push({
          code: "DIALOGUE_CONTAINS_SPEAKER_PREFIX",
          message: "DIALOGUE يحتوي بادئة متكلم (اسم :)—يجب فصل CHARACTER كسطر مستقل.",
          itemIndex: it.i,
        });
      }
      // منع meta leakage (سلوك نماذج/سلاسل)
      if (/(---+|End of Extraction|هل ترغب|والباقي)/i.test(it.normalized)) {
        errors.push({
          code: "LEAKED_META_TEXT",
          message: "تم رصد نصوص ميتا/فواصل داخل normalized.",
          itemIndex: it.i,
        });
      }
    }

    // منع meta leakage في أي عنصر
    if (/(---+|End of Extraction|هل ترغب|والباقي)/i.test(it.normalized)) {
      errors.push({
        code: "LEAKED_META_TEXT",
        message: "تم رصد نصوص ميتا/فواصل داخل normalized.",
        itemIndex: it.i,
      });
    }

}

return { ok: errors.length === 0, errors };
}

export function assertUnstructuredValid(v: UnstructuredValidationResult): void {
if (!v.ok) {
const msg =
"Unstructured validation failed:\n" +
v.errors.map((e) => `- [${e.code}] i=${e.itemIndex ?? "?"} ${e.message}`).join("\n");
throw new Error(msg);
}
} 6) src/pipeline/unstructured/detect.ts (threshold 0.70 + heuristics)
// src/pipeline/unstructured/detect.ts
import { scoreLine } from "../quality/line-quality";
import type { UnstructuredDetectResult } from "./types";

export interface UnstructuredDetectOptions {
threshold: number; // 0.70
}

/\*\*

- قرار تشغيل unstructured:
- - avgQuality < threshold
- - أو heuristics قوية (مشهد1 بدون مسافة، قطع مشهد2 ملتصقة، وجود ، كثرة inline speaker)
    \*/
    export function detectUnstructured(text: string, opt: UnstructuredDetectOptions): UnstructuredDetectResult {
    const raw = text ?? "";
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

if (lines.length === 0) return { applied: false, qualityScore: 1, reasons: ["EMPTY_INPUT"] };

// average scoreLine
const scores = lines.map((l) => {
try {
const q = scoreLine(l);
// scoreLine غالبًا يعيد { score: number, ... } أو number حسب تطبيقك.
// ندعم الشكلين:
const s = typeof (q as any) === "number" ? (q as any) : (q as any)?.score;
return typeof s === "number" ? s : 0.5;
} catch {
return 0.5;
}
});

const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);

const reasons: string[] = [];

// Heuristics
const hasSceneNoSpace = /مشهد\d+/.test(raw); // مشهد1
const hasCutSceneGlue = /\bقطع\s*مشهد\s*\d+/i.test(raw) || /قطع\s*مشهد\d+/i.test(raw);
const hasBullets = //.test(raw);
const inlineSpeakerCount = (raw.match(/[^:\n]{1,50}:\s*\S+/g) ?? []).length;

if (hasSceneNoSpace) reasons.push("H_SCENE_NO_SPACE");
if (hasCutSceneGlue) reasons.push("H_CUT_SCENE_GLUE");
if (hasBullets) reasons.push("H_BULLETS");
if (inlineSpeakerCount >= 3) reasons.push("H_INLINE_SPEAKER_MANY");

const applied = avg < opt.threshold || reasons.length > 0;

if (avg < opt.threshold) reasons.unshift(`Q_BELOW_THRESHOLD_${opt.threshold.toFixed(2)}`);

return { applied, qualityScore: clamp01(avg), reasons };
}

function clamp01(x: number): number {
if (!Number.isFinite(x)) return 0;
if (x < 0) return 0;
if (x > 1) return 1;
return x;
} 7) src/pipeline/unstructured/to-structured.ts (structuredBlocks + structuredText)
// src/pipeline/unstructured/to-structured.ts
import type { ScreenplayBlock } from "../../utils/file-import/document-model";
import type { UnstructuredResult, UnstructuredItemType } from "./types";

function mapTypeToFormatId(t: UnstructuredItemType): ScreenplayBlock["formatId"] {
switch (t) {
case "BASMALA": return "basmala";
case "SCENE-HEADER-1": return "scene-header-1";
case "SCENE-HEADER-2": return "scene-header-2";
case "SCENE-HEADER-3": return "scene-header-3";
case "ACTION": return "action";
case "CHARACTER": return "character";
case "DIALOGUE": return "dialogue";
case "TRANSITION": return "transition";
}
}

export function toStructuredBlocks(result: UnstructuredResult): ScreenplayBlock[] {
return result.items.map((it) => ({
formatId: mapTypeToFormatId(it.type),
text: it.normalized.trimEnd(),
}));
}

export function toStructuredText(blocks: ScreenplayBlock[]): string {
// نص سطر-بسطر جاهز للـ paste-classifier
// (لا نضيف أسطر فارغة كي لا نؤثر على line indexing)
return blocks
.map((b) => (b.text ?? "").trimEnd())
.filter((t) => t.length > 0)
.join("\n");
} 8) src/pipeline/unstructured/index.ts (Facade واحدة)
// src/pipeline/unstructured/index.ts
import type { UnstructuredReconstructionResult } from "./types";
import { detectUnstructured } from "./detect";
import { normalizeForUnstructuredWork } from "./normalize";
import { segmentToChunks, splitCutSceneGlue } from "./segmenter";
import { classifyUnstructuredLines } from "./classifier";
import { validateUnstructuredResult } from "./validator";
import { toStructuredBlocks, toStructuredText } from "./to-structured";

export interface MaybeReconstructOptions {
threshold: number; // 0.70
replaceBullets?: boolean;
}

export function maybeReconstructUnstructured(
text: string,
opt: MaybeReconstructOptions
): UnstructuredReconstructionResult {
const decision = detectUnstructured(text, { threshold: opt.threshold });

if (!decision.applied) {
return {
applied: false,
qualityScore: decision.qualityScore,
structuredText: text ?? "",
structuredBlocks: [],
debug: {
reasons: decision.reasons,
operationsCount: 0,
itemsCount: 0,
},
};
}

const work = normalizeForUnstructuredWork(text ?? "", {
replaceBullets: opt.replaceBullets ?? true,
collapseBlankLines: true,
});

let chunks = segmentToChunks(work);
chunks = splitCutSceneGlue(chunks);

const lines = chunks.map((c) => c.raw);

const classified = classifyUnstructuredLines(lines);
const v = validateUnstructuredResult(classified);

// Fail-closed: إذا فشل validator، لا نرمي النص. نرجع applied=false لكن مع debug.
// (يمكنك لاحقًا ترقية ذلك لطبقة LLM repair أو re-segmentation أشد)
if (!v.ok) {
return {
applied: false,
qualityScore: decision.qualityScore,
structuredText: text ?? "",
structuredBlocks: [],
debug: {
reasons: decision.reasons.concat(v.errors.slice(0, 5).map((e) => `V_${e.code}`)),
operationsCount: classified.operations.length,
itemsCount: classified.items.length,
},
};
}

const structuredBlocks = toStructuredBlocks(classified);
const structuredText = toStructuredText(structuredBlocks);

return {
applied: true,
qualityScore: decision.qualityScore,
structuredText,
structuredBlocks,
debug: {
reasons: decision.reasons,
operationsCount: classified.operations.length,
itemsCount: classified.items.length,
},
};
}
كيف تستخدمها في الدمج 1:1 (مختصر جدًا)

داخل src/components/editor/EditorArea.ts قبل applyPasteClassifierFlowToView(...):

استدعِ:

import { maybeReconstructUnstructured } from "../../pipeline/unstructured";

ثم:

const recon = maybeReconstructUnstructured(text, { threshold: 0.70, replaceBullets: true });

if (recon.applied) {
text = recon.structuredText;
context = {
...(context ?? {}),
structuredHints: recon.structuredBlocks,
};
}

ثم مرّر context.structuredHints كما هو لـ applyPasteClassifierFlowToView.

ملاحظتان مهمتان

Fail-closed: إذا فشل validateUnstructuredResult لا نكسر الاستيراد، بل نرجع للنص الأصلي (applied=false). هذا يمنع إدخال “تشويه” على نص جيد أو حالات edge غير مدعومة بعد.

لو لاحقًا أضفت طبقة LLM Repair، ستكون داخل maybeReconstructUnstructured عند فشل validator.
فيما يلي Patch دقيق (1:1) على ملفك الفعلي
src/components/editor/EditorArea.ts
لإدخال طبقة unstructured على كل المسارات (لصق / فتح DOC / فتح DOCX / لصق TXT) لأنهم جميعًا يمرّون عبر importClassifiedText().

المرجع: الدالة موجودة عندك بين السطور ~314–355 في الملف.

النص

1. تعديل Imports

أضف هذا الاستيراد أعلى الملف بجوار الاستيرادات الأخرى:

diff --git a/src/components/editor/EditorArea.ts b/src/components/editor/EditorArea.ts
@@
import {
htmlToScreenplayBlocks,
type ScreenplayBlock,
} from "../../utils/file-import";
+import { maybeReconstructUnstructured } from "../../pipeline/unstructured"; 2) تعديل importClassifiedText لإدخال unstructured + structuredBlocks

أضف الكتلة التالية بعد سطر focus مباشرةً، وقبل قراءة state:

diff --git a/src/components/editor/EditorArea.ts b/src/components/editor/EditorArea.ts
@@
importClassifiedText = async (
text: string,
mode: FileImportMode = "replace",
context?: ImportClassificationContext
): Promise<void> => {
// ضمان تفعيل دورة القياس في امتداد الصفحات قبل/بعد إدراج النص.
this.editor.commands.focus(mode === "replace" ? "start" : "end");

- // --- Unstructured Reconstruction (applies to paste + open doc/docx + txt) ---
- // threshold = 0.70 (كما طلبت)
- const unstructured = maybeReconstructUnstructured(text, {
-      threshold: 0.7,
-      replaceBullets: true,
- });
-
- if (unstructured.applied) {
-      const existingHints = context?.structuredHints ?? [];
-      // أولوية hints المُعاد هيكلتها أولاً ثم أي hints موجودة
-      const mergedHints = unstructured.structuredBlocks.concat(existingHints);
-
-      text = unstructured.structuredText;
-      context = {
-        ...(context ?? {}),
-        structuredHints: mergedHints,
-      };
-
-      // اختياري: تتبع سريع في اللوج
-      logger.info("unstructured-applied", {
-        qualityScore: unstructured.qualityScore,
-        itemsCount: unstructured.debug?.itemsCount,
-        operationsCount: unstructured.debug?.operationsCount,
-        reasons: unstructured.debug?.reasons,
-      });
- }
-     const state = this.editor.view.state;
      const replaceAllFrom = 0;
      const replaceAllTo = state.doc.content.size;
      const from = mode === "replace" ? replaceAllFrom : state.selection.from;
      const to = mode === "replace" ? replaceAllTo : state.selection.to;

      const applied = await applyPasteClassifierFlowToView(
        this.editor.view,
        text,
        {
          from,
          to,
          classificationProfile: context?.classificationProfile,
          sourceFileType: context?.sourceFileType,
          sourceMethod: context?.sourceMethod,
          structuredHints: context?.structuredHints,
        }
      );

3. لماذا هذا يحقق شرطك “unstructured عليهم كلهم”؟

لأن:

اللصق (clipboard) عندك ينادي importClassifiedText(text,"insert")

فتح DOC/DOCX يخلص بـ importClassifiedText(action.text, ...)

لصق TXT كذلك
وبالتالي أي نص يدخل المحرر يمر من نفس الدالة، فطبقة unstructured تُطبق مرة واحدة في مكان واحد.

4. ملاحظة تشغيلية مهمة

في maybeReconstructUnstructured عندنا سياسة Fail-closed:
إذا فشل validator داخل unstructured، applied=false ويرجع النص كما هو، وبالتالي لن يكسر مسار المهيكل.

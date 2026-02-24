# نظرة عامة
خطة هندسية تفصيلية لإعادة هيكلة نظام التصنيف والوكيل مع اعتماد Command API v2 بشكل كامل، تطبيق Auto-Apply، ونمط Render-First/Review-Later.
# القرارات الثابتة (Lock Decisions)
هذه القرارات ثابتة ولا تُغيَّر أثناء التنفيذ:
* اعتماد `/api/agent/review` بصيغة **Command API v2 فقط** (بدون v1)
* اعتماد **Auto-Apply** كامل (بدون تدخل مستخدم)
* اعتماد **Render-First / Review-Later**
* اعتماد `splitAt` = **UTF-16 index** (JavaScript code unit index)
* اعتماد **stale batch discard** عند `importOpId mismatch`
* اعتماد **partial apply** عند `fingerprint mismatch` لبعض العناصر
* اعتماد سياسات Conflict و Idempotency
# التعريفات والمعايير المشتركة
## مواصفة splitAt
* `splitAt` هو **zero-based UTF-16 code unit index**
* التطبيق: `left = text.slice(0, splitAt)` و `right = text.slice(splitAt)`
* الفهرسة على **النص الخام الأصلي** بدون Unicode normalization
## مواصفة Fingerprint
* الصيغة: `fingerprint = sha1(type + "\u241F" + rawText)`
* `rawText` بدون `trim()`، المسافات كما هي، بدون normalization
* newline داخل النص يدخل كما هو
## سياسة تضارب الأوامر (Conflict Policy)
* أمر واحد فقط لكل `itemId` في نفس batch
* `split` له أولوية على `relabel`
* أكثر من `split` لنفس `itemId` = تضارب → رفض كامل
* تسجيل `skippedConflictCount`
## سياسة ترتيب التنفيذ
* التطبيق يعتمد **`itemId` lookup** وليس `index`
* تنفيذ: `Normalize -> Dedupe -> Apply Once Per itemId`
* منع تطبيق أمر ثانٍ على نفس `itemId` داخل نفس batch
## سياسة Idempotency
* `requestId` إجباري في كل رد من الوكيل
* حفظ `appliedRequestIds` لكل `importOpId`
* تكرار نفس `requestId` → `idempotent_discarded`
# المرحلة 0: Root-Cause Hardening
**الأولوية:** P0
**الملف:** `src/extensions/line-repair.ts`
## المطلوب
* منع دمج السطر التالي داخل `dialogue` إذا بدأ بـ `ثم` + فعل وصفي/حركي
* إنشاء/تحديث Regex أو قاعدة دلالية للأفعال الوصفية
* الحفاظ على دمج الحوار الصحيح (استكمال يبدأ بـ `...` أو عطف حواري)
## معيار القبول
السطران:
```warp-runnable-command
... اطلع من البلد
ثم يخرج ورقه مكتوب عليها عنوان
```
لا يتم دمجهما داخل `dialogue` واحد
## (اختياري قوي) Local deterministic split
**الملف:** `src/extensions/paste-classifier.ts`
* إضافة قاعدة محلية deterministic للحالات شديدة الوضوح
* رفع الحالات المشتبهة كـ forced suspicious item
# المرحلة 1: Structured Input Trust Policy
**الأولوية:** P1
**الملف:** `src/types/structure-pipeline.ts`
## تعريف مستويات الثقة
* `trusted_structured`
* `semi_structured`
* `raw_text`
## Metadata المطلوب
* `schemaVersion`
* `source`
* `integrityCheck`
* `provenance/systemGenerated`
## القاعدة التشغيلية
إذا `structuredBlocks` **system-generated + schema-valid + source-tagged + integrity-checked** → Direct Import
غير ذلك → fallback إلى classifier النصي
## إصلاح importStructuredBlocks
**الملف:** `src/components/editor/EditorArea.ts`
* استيراد مباشر للعقد عند `trusted_structured`
* منع إعادة `join("\n")` ثم تمريرها إلى `paste-classifier`
* إبقاء fallback للمسارات غير الموثقة
# المرحلة 2: Command API v2 Backend
**الأولوية:** P0
**الملفات:** `src/types/agent-review.ts` و `server/agent-review.mjs`
## تحديث عقد الأنواع (Frontend types)
* حذف/استبدال `decisions[]` القديمة
* اعتماد `Command API v2`:
    * `apiVersion: "2.0"`
    * `mode: "auto-apply"`
    * `importOpId`
    * `requestId`
    * `status`
    * `commands[]`
## تعريف الأوامر
* `relabel`: تغيير نوع السطر
* `split`: تقسيم سطر
## SplitCommand يحتوي
* `itemId`
* `splitAt` (UTF-16 index)
* `leftType`
* `rightType`
* `confidence`
* `reason`
## تحديث /api/agent/review
* إزالة دعم v1 بالكامل
* إجبار الاستجابة على `commands[]` فقط
* إعادة `apiVersion: "2.0"` دائمًا
* تضمين `requestId` فريد
## تحديث Prompt الوكيل
* توجيه صريح: أرجع **JSON فقط**
* استخدم `commands[]`
* العمليات المسموحة: `relabel`, `split`
* في `split`: أرسل `splitAt` فقط (بدون `leftText/rightText`)
## Validation للسيرفر
* التحقق من بنية `Command API v2`
* التحقق من `splitAt` كعدد صحيح >= 0
* رفض/تنظيف الأوامر غير الصالحة
* وسم `status = "partial"` عند إسقاط أوامر
# المرحلة 3: Client Transport
**الأولوية:** P0
**الملف:** `src/extensions/Arabic-Screenplay-Classifier-Agent.ts`
## إعادة تسمية/تحويل
* تحويله إلى Client Transport فقط (أو `agent-review-client.ts`)
* إزالة أي منطق يوحي أنه "الوكيل الحقيقي"
* إبقاء الوظائف:
    * `requestAgentReview(...)`
    * parsing response (v2)
    * أخطاء الشبكة/timeout
# المرحلة 4: إعادة هيكلة paste-classifier
**الأولوية:** P1
**الملف:** `src/extensions/paste-classifier.ts`
## فصل المسؤوليات
* `classifyLocal(...)`
* `buildSuspicionPacket(...)`
* `requestAgentReview(...)`
* `normalizeAndValidateCommands(...)`
* `applyCommandsAuto(...)`
## مسار العرض الفوري + مراجعة الخلفية
* التصنيف المحلي يُطبَّق فورًا
* إطلاق مراجعة الخلفية بشكل غير حاجز
* فشل الوكيل: لا rollback / لا تجميد
* نجاح الوكيل: تطبيق الأوامر تلقائيًا
## إدارة العملية (importOpId)
* إنشاء `importOpId` لكل عملية إدخال
* حفظ snapshot للعناصر:
    * `itemId`
    * `fingerprint`
    * `type`
    * `rawTextLength`
* حفظ `appliedRequestIds`
## سياسة stale / partial / idempotency
* `importOpId mismatch` → discard batch كامل
* `requestId` مكرر → `idempotent_discarded`
* `fingerprint mismatch` لبعض العناصر → partial apply
* عدم محاولة re-anchor للأوامر على نص تغيّر
## Normalize + Conflict Resolution + Apply
* تنفيذ `normalize commands`
* dedupe by `itemId`
* conflict resolution policy
* apply once per `itemId`
## تطبيق split و relabel
* `applyRelabelCommand(...)`
* `applySplitCommand(...)` باستخدام `splitAt` (UTF-16)
* التحقق الصامت:
    * `itemId` موجود
    * fingerprint مطابق
    * `splitAt` داخل حدود النص
# المرحلة 5: توحيد نقطة دخول البايبلاين
**الأولوية:** P1
**الملف:** `EditorArea.ts`
## إنشاء دالة إدخال موحّدة
* `runTextIngestionPipeline(...)`
* دعم مدخلات:
    * `text`
    * `structuredBlocks`
    * `source`
    * `metadata`
* اختيار المسار بناءً على Trust Level
## Background sanity check
* حتى في `trusted_structured`: فحص خلفي غير حاجز
* رفع الحالات الشاذة للوكيل
* Auto-Apply commands عند الرجوع
# المرحلة 6: Packet / Token Budget
**الأولوية:** P2
**الملف:** `paste-classifier.ts` أو config
## تثبيت الحدود
* `maxSuspiciousLinesPerRequest`: 40
* `maxCharsPerLinePreview`: 240
* `maxForcedItemsPerRequest`: 20
* `maxPacketChars`: 12000-18000
* `agentTimeoutMs`: 6000-8000
* `retryCount`: 1 (network/5xx فقط)
## أولوية العناصر
1. forced items أولًا
2. الأعلى suspicion score
3. الأقل طولًا (اختياري)
## Chunking (اختياري)
* تأجيله إن لم يكن ضروريًا
* إذا تم تفعيله:
    * chunking تحت نفس `importOpId`
    * `requestId` مختلف لكل chunk
    * idempotency لكل chunk
# المرحلة 7: Telemetry / Logging
**الأولوية:** P2
## Telemetry عملية الإدخال
* `importOpId`
* `source`
* `trustLevel`
* `suspiciousCount`
* `sentToAgentCount`
## Telemetry استجابة الوكيل
* `requestId`
* `latencyMs`
* `status`
* `commandsReceived`
## Telemetry تطبيق الأوامر
* `commandsNormalized`
* `commandsApplied`
* `commandsSkipped`
* `skippedFingerprintMismatchCount`
* `skippedMissingItemCount`
* `skippedInvalidCommandCount`
* `skippedConflictCount`
* `staleDiscard`
* `idempotentDiscard`
# المرحلة 8: الاختبارات
**الأولوية:** P1-P2
## اختبارات Root Cause (إلزامية)
* منع دمج `ثم + فعل وصفي` داخل `dialogue`
* عدم كسر دمج الحوار الصحيح
## اختبارات Trust Policy
* `trusted_structured` → direct import
* `semi_structured` → fallback مناسب
* `raw_text` → classifier path
## اختبارات Command API v2
* parse `relabel`
* parse `split`
* رفض malformed commands
* `splitAt` UTF-16 behavior صحيح
## اختبارات stale / partial / idempotency
* `importOpId mismatch` → discard كامل
* fingerprint mismatch → partial apply
* نفس `requestId` مرتين → idempotent discard
## اختبارات Conflict Policy
* `split + relabel` لنفس `itemId`
* `split + split` لنفس `itemId`
## Regression Test
الجملة المختلطة:
```warp-runnable-command
... اطلع من البلد
ثم يخرج ورقه مكتوب عليها عنوان
```
لا تنتهي كـ `dialogue` واحدة خاطئة
# جدول التنفيذ السريع
## P0 (حرجة)
1. Hotfix `line-repair` لمنع `ثم + فعل وصفي` → `src/extensions/line-repair.ts`
2. تثبيت fingerprint spec + docs/types → `src/types/*`
3. تحويل API إلى v2 فقط → `server/agent-review.*` + `src/types/agent-review.ts`
4. تحويل Wrapper إلى client transport → `src/extensions/Arabic-Screenplay-Classifier-Agent.ts`
## P1 (عالية)
1. Refactor `paste-classifier` → `src/extensions/paste-classifier.ts`
2. stale/partial/idempotency + conflict policy
3. إصلاح `importStructuredBlocks` → `EditorArea.ts`
4. Trust Levels + Structured Trust Policy
5. الاختبارات الأساسية
## P2 (متوسطة)
1. Packet budget tuning
2. telemetry التفصيلي
3. chunking (إن لزم)
4. اختبارات إضافية
# معايير القبول النهائية
* الإدراج (فتح/لصق) يظهر فورًا بدون انتظار الوكيل
* فشل/مهلة الوكيل لا يوقف الإدراج ولا يعمل rollback
* `importOpId mismatch` يسبب discard كامل
* `fingerprint mismatch` لبعض العناصر يسبب partial apply فقط
* `requestId` المكرر لا يُعاد تطبيقه
* `trusted_structured` لا يُعاد تحويله لنص
* الحالة الأصلية (حوار + ثم فعل وصفي) لا تبقى مصنفة خطأ
# ملاحظات تنفيذ مهمة
* لا تستخدم `itemIndex` كمرجع (استخدم `itemId`)
* لا تسمح للوكيل بإرجاع `leftText/rightText` في `split`
* لا تُطبّق أي أمر بدون التحقق الصامت الأدنى
* عدم تدخل المستخدم ≠ عدم وجود Guardrails داخلية

# تقرير مراجعة بايبلاين التصنيف

**التاريخ**: 2026-02-23
**الفرع**: main

---

## ملخص تنفيذي

- **المراحل المكتملة بالكامل**: 2/9 (المرحلتان 0 و 6 — جزئياً)
- **الفحوصات الناجحة (PASS)**: 17/44
- **الفحوصات الجزئية (PARTIAL)**: 17/44
- **الفحوصات الفاشلة (FAIL)**: 10/44
- **معايير القبول المحققة**: 3/7

### الجذر المشترك للنواقص

وحدات `src/pipeline/` (trust-policy, command-engine, fingerprint, packet-budget, telemetry) بُنيت كطبقة متكاملة ومستقلة لكن **ربطها بمسار التنفيذ الفعلي** في `paste-classifier.ts` و `EditorArea.ts` **لم يُنجز بعد**. الفجوة الأساسية هي غياب نقطة التكامل بين الطبقتين.

---

## تفاصيل المراحل

### المرحلة 0: Root-Cause Hardening (P0)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 0.1 وجود `line-repair.ts` والتصدير | **PASS** | 4 دوال مُصدَّرة: `extractPlainTextFromHtmlLikeLine`, `parseBulletLine`, `shouldMergeWrappedLines`, `mergeBrokenCharacterName` |
| 0.2 `THUMMA_ACTION_RE` | **PASS** | موجود في `line-repair.ts:68` — 34 فعلاً وصفياً، يعمل عبر `shouldMergeWrappedLines` |
| 0.3 اختبار الحالة الحرجة | **PARTIAL** | موجود كسطر واحد مختلط في `classification-core.scoring.test.ts`، غائب كسطرين منفصلين في تدفق `classifyText` |
| 0.4 دمج الحوار الصحيح | **PASS** | 5 شروط في `shouldMergeWrappedLines` — `...` والعطف يُدمجان، `ثم + فعل` يُرفض |
| 0.5 منطق تقسيم محلي | **PASS** | لا يوجد split محلي — التقسيم يعتمد على الوكيل حصراً (متسق مع Render-First) |

---

### المرحلة 1: Structured Input Trust Policy (P1)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 1.1 وجود `trust-policy.ts` | **PASS** | موجود مع 7 exports عبر barrel `pipeline/index.ts` |
| 1.2 مستويات الثقة | **PASS** | `trusted_structured` / `semi_structured` / `raw_text` — القيم الثلاث موجودة |
| 1.3 Metadata | **PARTIAL** | `source` و `isIntegrityChecked` موجودان، `schemaVersion` كحقل رقمي غائب (يوجد `isSchemaValid` boolean فقط) |
| 1.4 القاعدة التشغيلية | **PASS** | `assessTrustLevel()` و `resolveImportAction()` صحيحتان ومُختبَرتان |
| 1.5 `EditorArea.ts` | **PARTIAL** | `importStructuredBlocks` لا تُعيد التصنيف (جيد)، لكن لا تستدعي `assessTrustLevel` إطلاقاً — السياسة معطّلة فعلياً |

---

### المرحلة 2: Command API v2 Backend (P0)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 2.1 حذف `decisions[]` | **PARTIAL** | محذوف من الأنواع، لكن بقايا `decisions: []` في استجابة خطأ `file-import-server.mjs:608` + خطأ TS في `production-self-check.ts` |
| 2.2 عقد v2 | **PASS** | `apiVersion: "2.0"`, `mode: "auto-apply"`, `importOpId`, `requestId`, `commands[]` — كلها حاضرة |
| 2.3 تعريف الأوامر | **PASS** | `RelabelCommand` و `SplitCommand` مع `splitAt: number` (UTF-16) — بدون `leftText/rightText` |
| 2.4 غياب مسارات v1 | **PARTIAL** | لا مسارات HTTP قديمة، لكن استجابة الخطأ تكسر عقد v2 (`decisions` بدل `commands`) |
| 2.5 Prompt الوكيل | **PASS** | JSON فقط / `commands[]` / حظر صريح لـ `leftText/rightText` / تغطية `requiredItemIds` |
| 2.6 Validation | **PASS** | `splitAt >= 0` في 3 طبقات / رفض `leftText/rightText` / `status: "partial"` عند نقص |

---

### المرحلة 3: Client Transport (P0)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 3.1 وجود الملف | **PASS** | `Arabic-Screenplay-Classifier-Agent.ts` موجود |
| 3.2 طبقة نقل خالصة | **PARTIAL** | Parser/validator خالص نعم، لكن اسمه مضلل ومنطق النقل الشبكي مبعثر في `paste-classifier.ts` |
| 3.3 الدوال | **PARTIAL** | `parseReviewCommands` موجودة، لكن `requestAgentReview` والـ timeout والأخطاء الشبكية في ملف آخر |
| 3.4 الثوابت | **FAIL** | `AGENT_API_VERSION` و `AGENT_API_MODE` في `types/agent-review.ts` — غير موجودين ولا مستوردين في الملف المطلوب |

---

### المرحلة 4: إعادة هيكلة paste-classifier (P1)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 4.1 وجود الملف والصادرات | **PASS** | `classifyText`, `applyPasteClassifierFlowToView`, `selectSuspiciousLinesForAgent` — كلها مُصدَّرة |
| 4.2 فصل المسؤوليات | **PARTIAL** | `classifyText` / `PostClassificationReviewer` / `requestAgentReview` منفصلة، لكن تطبيق الأوامر مكرر بدل استخدام `command-engine.ts` |
| 4.3 Render-First | **PASS** | `view.dispatch(tr)` في السطر 1586 فوراً، ثم `void (async () => {...})()` في السطر 1590 |
| 4.4 importOpId / snapshot | **PARTIAL** | `importOpId` يُولَّد بـ `crypto.randomUUID()`، لكن fingerprint = `fp-${id}-${Date.now()}` (زمنية مزيفة وليست SHA-1)، و `appliedRequestIds` غير مُفعَّل في مسار paste |
| 4.5 سياسات التجاهل | **PARTIAL** | stale/idempotent/partial موجودة في `command-engine.ts` — لكن `paste-classifier.ts` لا يستخدمها |
| 4.6 Conflict Resolution | **PARTIAL** | `normalizeAndDedupeCommands` في `command-engine.ts` مكتمل (split > relabel, split+split = reject) — لكن `paste-classifier.ts` يتجاهله |
| 4.7 تطبيق الأوامر | **PARTIAL** | `applyRelabelCommand` / `applySplitCommand` في `command-engine.ts` صحيحتان مع UTF-16، لكنهما لا تُستدعيان من `paste-classifier.ts` |

---

### المرحلة 5: توحيد نقطة الدخول (P1)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 5.1 الدالة الموحدة | **FAIL** | لا توجد `runTextIngestionPipeline()` — مسارَان منفصلان: `importClassifiedText` و `importStructuredBlocks` |
| 5.2 المدخلات | **FAIL** | `source` و `metadata` غائبان تماماً من واجهة الدوال |
| 5.3 التوجيه بالثقة | **FAIL** | `assessTrustLevel` لا يُستورد ولا يُستدعى في `EditorArea.ts` |
| 5.4 Background Sanity | **PARTIAL** | `requestProductionSelfCheck` موجود في المسار النصي فقط، غائب عن المسار المهيكل + محمي بحارس يمنع التكرار |

---

### المرحلة 6: Packet / Token Budget (P2)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 6.1 الحدود المثبتة | **PASS** | 6 قيم في `DEFAULT_PACKET_BUDGET` (ملاحظة: `agentTimeoutMs` و `retryCount` لا يُستهلكان فعلياً من المنفذ) |
| 6.2 أولوية العناصر | **PASS** | forced -> suspicionScore -> textLength — مُطبَّق بدقة في `sortByPriority` |
| 6.3 Chunking | **PARTIAL** | `planChunks` موجودة مع تعليق عن importOpId مشترك، لكن لا تُستدعى من أي مكان فعلي |

---

### المرحلة 7: Telemetry / Logging (P2)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 7.1 تيليمتري الإدخال | **PARTIAL** | `OperationTelemetry` مكتملة الحقول، لكن `logOperationStart/Complete` لا تُستدعيان أبداً |
| 7.2 تيليمتري الوكيل | **PARTIAL** | `AgentResponseTelemetry` مكتملة، لكن `logAgentResponse` لا تُستدعى — التسجيل الفعلي مشتت وبدون `importOpId` |
| 7.3 تيليمتري التطبيق | **PARTIAL** | `CommandApplyTelemetryEvent` مكتملة، لكن `logCommandApply` لا تُستدعى — `importOpId/requestId` غائبان من التسجيل الفعلي |

---

### المرحلة 8: الاختبارات (P1-P2)

| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 8.1 اختبارات Root Cause | **PASS** | 5 اختبارات رفض + 2 قبول في `line-repair.test.ts` |
| 8.2 اختبارات Trust Policy | **PARTIAL** | 6 سيناريوهات تغطي الحالات الأساسية، غائب: اختبار سلبي أن `trusted_structured` لا تذهب لـ `fallback` |
| 8.3 اختبارات Command API v2 | **PARTIAL** | relabel/split/reject موجودة، غائب: اختبار `splitAt` مع surrogate pairs (UTF-16) |
| 8.4 اختبارات stale/partial/idempotency | **PARTIAL** | stale وidempotent مغطيان، غائب: اختبار fingerprint mismatch (snapshot لا يُملأ في الاختبارات) |
| 8.5 اختبارات Conflict Policy | **PASS** | split+relabel -> split يفوز / split+split -> reject / relabel+relabel -> أول واحد — تغطية كاملة |
| 8.6 Regression Test | **FAIL** | لا يوجد اختبار صريح أن الجملة المختلطة **لا تنتهي** كـ `dialogue` منفرد (الاختبار الحالي مُتساهل بمنطق OR) |

---

## معايير القبول

| المعيار | النتيجة | التعليل |
|---------|---------|---------|
| AC-1: الإدراج فوري بدون انتظار الوكيل | **PASS** | `view.dispatch(tr)` في `paste-classifier.ts:1586` قبل `void (async () => {...})()` في السطر 1590 |
| AC-2: فشل الوكيل لا يوقف الإدراج | **PASS** | `.catch()` في السطر 1594 يسجّل الخطأ ويعيد `null`، ومحاط بـ `try/catch` خارجي في 1618 |
| AC-3: importOpId mismatch -> discard | **PARTIAL** | موجود في `command-engine.ts:160` — لكن `paste-classifier.ts` لا يمر عبر `applyCommandBatch` |
| AC-4: fingerprint mismatch -> partial | **PARTIAL** | موجود في `command-engine.ts:219` — لكن fingerprint في paste-classifier زمني مزيف وليس SHA-1 |
| AC-5: requestId مكرر -> لا يُعاد | **PARTIAL** | `appliedRequestIds.has()` في `command-engine.ts:169` — لكن paste-classifier لا يُسجّل requestId |
| AC-6: trusted -> لا إعادة تصنيف | **PASS** | `importStructuredBlocks` لا تستدعي `classifyText` — إدراج مباشر عبر `screenplayBlocksToHtml` |
| AC-7: حوار + ثم فعل -> لا تُصنف خطأ | **PARTIAL** | `THUMMA_ACTION_RE` يمنع الدمج كسطرين، لكن لا اختبار regression صريح للجملة المختلطة كسطر واحد |

---

## الحكم النهائي

- [ ] التنفيذ مكتمل — كل المعايير محققة
- [x] **يوجد نواقص** — قائمة المراحل الفاشلة/الجزئية: **1, 2, 3, 4, 5, 6, 7, 8**

---

## التوصيات (مرتّبة بالأولوية)

### أولوية P0 (حرجة — تمنع القبول)

1. **ربط `command-engine.ts` بمسار paste**: `applyRemoteAgentReviewV2` في `paste-classifier.ts` يجب أن يستدعي `applyCommandBatch` بدل المنطق المكرر (السطور 1257-1357). هذا يُفعّل stale/idempotent/fingerprint/conflict resolution بضربة واحدة.

2. **استبدال البصمة الزمنية ببصمة محتوى**: تغيير `fp-${id}-${Date.now()}` في `paste-classifier.ts:1201` باستدعاء `computeFingerprint()` من `pipeline/fingerprint.ts`.

3. **إصلاح استجابة خطأ v1**: في `file-import-server.mjs:608` — تغيير `decisions: []` إلى `commands: []` وإضافة حقول v2 الإلزامية (`apiVersion`, `mode`, `importOpId`, `requestId`).

4. **إصلاح `production-self-check.ts`**: يستورد دوالاً غير مُصدَّرة (`parseReviewDecisions`, `ScreenplayClassifier`) ويستخدم حقول v1 (`requiredItemIndexes`) — خطأ TypeScript يكسر البناء.

### أولوية P1 (مهمة — تكمل المعمارية)

5. **إنشاء `runTextIngestionPipeline()`**: دالة موحدة في `EditorArea.ts` تستدعي `assessTrustLevel` وتوجّه حسب النتيجة — تستبدل المسارين المنفصلين `importClassifiedText` و `importStructuredBlocks`.

6. **نقل `requestAgentReview` والثوابت**: من `paste-classifier.ts` إلى `Arabic-Screenplay-Classifier-Agent.ts` ليكون Client Transport كاملاً، مع استيراد `AGENT_API_VERSION` و `AGENT_API_MODE`.

7. **ربط `telemetry.ts` بالمنفذ**: استدعاء `logOperationStart/Complete` و `logAgentResponse` و `logCommandApply` من المواضع المناسبة بدل التسجيل المشتت في `paste-classifier.ts`.

8. **إضافة اختبارات مفقودة**:
   - اختبار regression: جملة مختلطة كسطر واحد **لا** تُصنف `dialogue`
   - اختبار fingerprint mismatch في `applyCommandBatch`
   - اختبار `splitAt` مع surrogate pairs (UTF-16)
   - اختبار سلبي: `trusted_structured` لا تذهب لـ `fallback_to_classifier`

### أولوية P2 (تحسينات)

9. **ربط `planChunks` بالمنفذ**: دمج Chunking مع `requestAgentReview` للتعامل مع الملفات الكبيرة.

10. **إضافة `schemaVersion` رقمي**: في `TrustAssessment` لدعم هجرة بنية `StructuredBlock` مستقبلاً.

11. **إضافة `requestProductionSelfCheck`**: في مسار `importStructuredBlocks` (حالياً في المسار النصي فقط) + إزالة حارس التشغيل الواحد.

---

## خريطة المشاكل حسب الملف

| الملف | المشاكل |
|-------|---------|
| `src/extensions/paste-classifier.ts` | منطق apply مكرر (لا يستخدم command-engine)، بصمة زمنية مزيفة، لا idempotency، requestAgentReview يجب نقلها |
| `src/components/editor/EditorArea.ts` | مسارا استيراد منفصلان، لا يستدعي assessTrustLevel، لا requestProductionSelfCheck في المسار المهيكل |
| `server/file-import-server.mjs` | استجابة خطأ تحمل `decisions[]` بدل `commands[]` |
| `src/extensions/production-self-check.ts` | يستورد دوال غير مُصدَّرة + يستخدم حقول v1 |
| `src/extensions/Arabic-Screenplay-Classifier-Agent.ts` | اسم مضلل، لا يستورد ثوابت API، ينقصه requestAgentReview |
| `src/pipeline/telemetry.ts` | واجهات مكتملة لكن log functions لا تُستدعى من أي مكان |
| `src/pipeline/packet-budget.ts` | `planChunks` و `buildPacketWithBudget` لا تُستدعيان + ثوابت timeout/retry منفصلة عن المنفذ |

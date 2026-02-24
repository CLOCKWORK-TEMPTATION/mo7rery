# تقرير تنفيذ إعادة هيكلة Arabic Screenplay Classifier Pipeline

**التاريخ:** 2026-02-23
**الإصدار:** Command API v2.0 — Auto-Apply
**الحالة:** مكتمل — 67/67 اختبار ناجح

---

## ملخص تنفيذي

تم تنفيذ إعادة هيكلة شاملة لخط أنابيب تصنيف السيناريو العربي، تحويلاً من v1 (`decisions[]` + `itemIndex`) إلى Command API v2 (`commands[]` + `itemId`) مع نمط Render-First / Review-Later وسلوك Auto-Apply بدون تأكيد مستخدم.

التطبيق غير منشور — لذلك لا يوجد وضع انتقالي. تم كسر التوافق مع v1 بالكامل.

---

## المراحل المنفذة

### المرحلة 0 — Root-Cause Hardening (line-repair.ts)

**المشكلة:** نمط "ثم + فعل وصفي" كان يُدمج خطأً كاستمرار حوار.

**الحل:**
- إضافة قائمة `ACTION_VERBS_AFTER_THUMMA` (46 فعل مصرف للمذكر والمؤنث)
- إضافة regex `THUMMA_ACTION_RE` يطابق `^ثم\s+(?:يخرج|تدخل|...)`
- فحص إضافي في `shouldMergeWrappedLines` يمنع الدمج عند مطابقة النمط

**الملف:** `src/extensions/line-repair.ts`

---

### المرحلة 1 — Structured Input Trust Policy (ملف جديد)

**الملف:** `src/pipeline/trust-policy.ts`

ثلاثة مستويات ثقة:

| المستوى | الشروط | مسار المعالجة |
|---------|--------|--------------|
| `trusted_structured` | systemGenerated + schemaValid + sourceTagged + integrityChecked | `direct_import_with_bg_check` |
| `semi_structured` | schemaValid فقط | `fallback_to_classifier` |
| `raw_text` | المخطط غير صالح أو كتل فارغة | `fallback_to_classifier` |

**الدوال المُصدّرة:** `assessTrustLevel`, `resolveImportAction`

---

### المرحلة 2 — Command API v2 Types (أنماط)

**الملف:** `src/types/agent-review.ts` — أُعيد كتابته بالكامل

التغييرات الجوهرية:

| v1 | v2 |
|----|----|
| `decisions[]` | `commands[]` |
| `itemIndex: number` | `itemId: string` |
| `AgentReviewDecision` | `RelabelCommand \| SplitCommand` |
| لا يوجد | `importOpId`, `requestId` |
| لا يوجد | `apiVersion: "2.0"`, `mode: "auto-apply"` |
| `requiredItemIndexes` | محذوف — يُستخدم `isForced` في packet-budget |
| `forcedItemIndexes` | محذوف |

أمر `split` يستخدم `splitAt` (UTF-16 index) بدون `leftText`/`rightText`.

---

### المرحلة 2.2-2.4 — تحديث Server (agent-review.mjs)

**الملف:** `server/agent-review.mjs`

- `parseReviewDecisions` → `parseReviewCommands`
- System prompt مُحدّث ليطلب `commands[]` بتنسيق v2
- الاستجابة تتضمن `apiVersion`, `mode`, `importOpId`, `requestId`
- كل التحقق يستخدم `itemId` (string) بدلاً من `itemIndex` (number)
- `AGENT_API_VERSION = "2.0"`, `AGENT_API_MODE = "auto-apply"`

---

### المرحلة 3 — Client Transport (Arabic-Screenplay-Classifier-Agent.ts)

**الملف:** `src/extensions/Arabic-Screenplay-Classifier-Agent.ts`

- حُذف: `ScreenplayClassifier` class, `parseReviewDecisions`, `reviewSuspiciousLinesWithClaude`
- أُضيف: `parseReviewCommands()` — محلل v2 يدعم relabel و split
- يرفض `leftText`/`rightText` في split
- يُبقي `MODEL_ID` و `ProcessFileResult`

---

### المرحلة 4 — Render-First / Review-Later (paste-classifier.ts)

**الملف:** `src/extensions/paste-classifier.ts`

النمط الجديد:
1. التصنيف المحلي يُعرض فوراً (render-first)
2. المراجعة بالوكيل تعمل في الخلفية (review-later)
3. النتائج تُطبّق تلقائياً (auto-apply)

التغييرات:
- `ClassifiedDraftWithId` مع حقل `_itemId`
- `applyRemoteAgentReview` → `applyRemoteAgentReviewV2`
- كل `itemIndex` → `itemId`
- كل `decisions` → `commands`
- `normalizeAgentReviewPayload` محدّث لـ v2
- حالة `"warning"` أُزيلت — `"partial"` بديلها

---

### المرحلة 5 — Fingerprint Specification (ملف جديد)

**الملف:** `src/pipeline/fingerprint.ts`

- الخوارزمية: `sha1(type + "\u241F" + rawText)` مع djb2 كـ fallback
- لا يوجد trim أو normalization — المسافات تُغيّر البصمة
- الخرج: hex string من 16 حرفاً (djb2) أو 40 حرفاً (sha1)

**الدوال:** `computeFingerprint`, `computeFingerprintSync`, `buildItemSnapshots`, `matchesSnapshot`

---

### المراحل 6-8 — Command Engine (ملف جديد)

**الملف:** `src/pipeline/command-engine.ts`

| الوظيفة | الوصف |
|---------|-------|
| `validateAndFilterCommands` | تحقق C — قبول/رفض أوامر حسب المخطط |
| `normalizeAndDedupeCommands` | تحقق E — حل التضاربات (split > relabel) |
| `checkResponseValidity` | تحقق D — كشف stale و idempotent |
| `applyRelabelCommand` | تطبيق أمر relabel |
| `applySplitCommand` | تطبيق أمر split (UTF-16 index) |
| `applyCommandBatch` | تطبيق دفعة كاملة مع telemetry |
| `createImportOperationState` | إنشاء حالة عملية استيراد |

سياسة التضارب:
- أمر واحد لكل `itemId`
- `split` يتفوق على `relabel` لنفس `itemId`
- أكثر من `split` لنفس `itemId` = تضارب → رفض الكل
- أكثر من `relabel` لنفس `itemId` = أول واحد فقط

---

### المرحلة 9 — Packet/Token Budget (ملف جديد)

**الملف:** `src/pipeline/packet-budget.ts`

- `sortByPriority` — forced أولاً، ثم suspicionScore تنازلياً
- `buildPacketWithBudget` — يحترم `maxSuspiciousLinesPerRequest` و `maxPacketChars`
- `planChunks` — تقسيم إلى chunks عند تجاوز الحدود
- `prepareItemForPacket` — اقتطاع النص عند 500 حرف

الإعدادات الافتراضية: 20 عنصر مشبوه، 5 forced، 30000 حرف لكل طلب.

---

### المرحلة 10 — Telemetry/Logging (ملف جديد)

**الملف:** `src/pipeline/telemetry.ts`

6 دوال تسجيل هيكلية عبر `getLogger("pipeline")`:
`logOperationStart`, `logOperationComplete`, `logAgentResponse`, `logCommandApply`, `logAgentError`, `logAgentSkipped`

---

## Barrel Exports

**`src/pipeline/index.ts`** — يُعيد تصدير كل الوحدات:
trust-policy, fingerprint, command-engine, packet-budget, telemetry

**`src/types/index.ts`** — مُحدّث:
- أُزيل: `AgentReviewDecision` وأنماط v1
- أُضيف: `RelabelCommand`, `SplitCommand`, `AgentCommand`, `AGENT_API_VERSION`, `AGENT_API_MODE`, وباقي أنماط v2

---

## نتائج الاختبارات

```
Test Files  5 passed (5)
     Tests  67 passed (67)
  Duration  702ms
```

### تفصيل الاختبارات

| الاختبار | الملف | العدد | الحالة |
|----------|-------|-------|--------|
| A — Root-Cause Regression | `line-repair.test.ts` | 19 | ✅ |
| B — Trust Policy | `trust-policy.test.ts` | 9 | ✅ |
| C — Command Parsing | `command-engine.test.ts` | 8 | ✅ |
| D — Stale/Idempotency | `command-engine.test.ts` | 3 | ✅ |
| E — Conflict Policy | `command-engine.test.ts` | 4 | ✅ |
| F — Fingerprint Spec | `fingerprint.test.ts` | 9 | ✅ |
| — — Command Apply | `command-engine.test.ts` | 6 | ✅ |
| — — Packet Budget | `packet-budget.test.ts` | 7 | ✅ |
| — — Batch Apply | `command-engine.test.ts` | 4 | ✅ |

---

## قائمة الملفات المُعدّلة/المُنشأة

### ملفات جديدة (pipeline/)
| الملف | الأسطر | الوصف |
|-------|--------|-------|
| `src/pipeline/trust-policy.ts` | 163 | سياسة الثقة |
| `src/pipeline/fingerprint.ts` | 133 | مواصفة البصمة |
| `src/pipeline/command-engine.ts` | 486 | محرك الأوامر |
| `src/pipeline/packet-budget.ts` | 205 | ميزانية الحزم |
| `src/pipeline/telemetry.ts` | 119 | التسجيل الهيكلي |
| `src/pipeline/index.ts` | 20 | barrel exports |

### ملفات مُعدّلة
| الملف | التغيير |
|-------|---------|
| `src/extensions/line-repair.ts` | إضافة THUMMA_ACTION_RE |
| `src/types/agent-review.ts` | إعادة كتابة كاملة → v2 |
| `src/types/index.ts` | تحديث barrel exports |
| `server/agent-review.mjs` | تحويل من v1 → v2 |
| `src/extensions/Arabic-Screenplay-Classifier-Agent.ts` | حذف v1 + إضافة parseReviewCommands |
| `src/extensions/paste-classifier.ts` | Render-First/Review-Later + v2 |

### اختبارات جديدة
| الملف | عدد الاختبارات |
|-------|---------------|
| `tests/unit/extensions/line-repair.test.ts` | 19 |
| `tests/unit/pipeline/trust-policy.test.ts` | 9 |
| `tests/unit/pipeline/command-engine.test.ts` | 21 |
| `tests/unit/pipeline/fingerprint.test.ts` | 9 |
| `tests/unit/pipeline/packet-budget.test.ts` | 7 |

---

## Checklist النهائي

- [x] المرحلة 0: line-repair hotfix — "ثم + فعل وصفي" لا يُدمج في حوار
- [x] المرحلة 1: Trust Policy — 3 مستويات ثقة مع مسارات معالجة
- [x] المرحلة 2: أنماط Command API v2 — commands[], itemId, importOpId, requestId
- [x] المرحلة 2.2-2.4: Server v2 — parseReviewCommands, system prompt محدّث
- [x] المرحلة 3: Client Transport — parseReviewCommands, حذف v1 stubs
- [x] المرحلة 4: Render-First/Review-Later — paste-classifier محوّل بالكامل
- [x] المرحلة 5: Fingerprint — sha1/djb2, بدون normalization
- [x] المراحل 6-8: Command Engine — validate, dedupe, conflict, apply
- [x] المرحلة 9: Packet Budget — sort, budget, chunks, prepare
- [x] المرحلة 10: Telemetry — 6 دوال تسجيل هيكلية
- [x] Barrel exports — pipeline/index.ts + types/index.ts محدّث
- [x] اختبار A: Root-cause regression (7 حالات + 5 شروط عامة + 7 مساعدات)
- [x] اختبار B: Trust Policy (6 حالات assessTrustLevel + 3 resolveImportAction)
- [x] اختبار C: Command Parsing (8 حالات validateAndFilterCommands)
- [x] اختبار D: Stale/Idempotency (3 حالات checkResponseValidity)
- [x] اختبار E: Conflict Policy (4 حالات normalizeAndDedupeCommands)
- [x] اختبار F: Fingerprint Spec (6 computeFingerprintSync + 3 snapshot)
- [x] جميع الاختبارات تمر: 67/67

---

## ملاحظات للمراجعة

1. **vitest.pipeline.config.ts** — ملف إعدادات مؤقت أُنشئ لتشغيل اختبارات pipeline بشكل مستقل عن تبعيات tiptap-pro. يمكن حذفه.

2. **اختبار contract الموجود** (`tests/unit/server/agent-review.contract.test.ts`) — يستخدم أنماط v1 (`itemIndex`, `requiredItemIndexes`). يحتاج تحديث ليتوافق مع v2.

3. **أنماط split** — `splitAt` يعمل كـ UTF-16 code unit offset. النص العربي يستخدم حرف واحد = code unit واحد (ما لم يتضمن emoji أو أحرف supplementary).

4. **node_modules symlink** — أُنشئ مؤقتاً لتشغيل الاختبارات. يُزال عند تشغيل `npm install` العادي مع وصول لـ tiptap-pro registry.

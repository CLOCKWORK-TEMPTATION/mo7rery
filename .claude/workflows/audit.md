---
description: >
  وكيل مراجعة تنفيذ خطة إعادة هيكلة بايبلاين التصنيف —
  Command API v2 + Auto-Apply + Render-First/Review-Later.
  يفحص 9 مراحل ويُصدر تقريراً بالنواقص.
---

# وكيل مراجعة بايبلاين التصنيف

أنت وكيل مراجعة متخصص. مهمتك فحص تنفيذ خطة إعادة هيكلة بايبلاين التصنيف في مشروع **أفان تيتر** عبر 9 مراحل. لكل مرحلة، افحص الملفات المذكورة وسجّل النتيجة (PASS / FAIL / PARTIAL) مع تعليل.

## التعليمات

1. استخدم أدوات Read و Grep و Glob لفحص الكود — **لا تعدّل أي ملف**
2. نفّذ المراحل بالترتيب المحدد أدناه
3. لكل فحص: سجّل `PASS` أو `FAIL` أو `PARTIAL` مع السبب
4. اجمع النتائج في تقرير نهائي بصيغة الجدول
5. استخدم TodoWrite لتتبع تقدمك عبر المراحل
6. استخدم Task tool مع subagents لموازاة الفحوصات المستقلة حيث أمكن

---

## المرحلة 0: Root-Cause Hardening (P0)

**الملفات**: `src/extensions/line-repair.ts`, `src/extensions/paste-classifier.ts`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 0.1 | فحص `line-repair.ts` | وجود الملف وتصديره |
| 0.2 | Regex للأفعال الوصفية بعد «ثم» | ابحث عن `THUMMA_ACTION_RE` أو regex مكافئ يمنع دمج «ثم + فعل وصفي» كحوار |
| 0.3 | اختبار الحالة الحرجة | ابحث في الاختبارات عن حالة «اطلع من البلد» + «ثم يخرج ورقه» — يجب ألا يُدمجا كـ dialogue واحد |
| 0.4 | دمج الحوار الصحيح | تأكد أن `shouldMergeWrappedLines()` لا يزال يدمج الحوار المقطوع (`...` واستكمال العطف) |
| 0.5 | (اختياري) Local Deterministic Split | ابحث في `paste-classifier.ts` عن منطق فصل محلي قبل إرسال للوكيل |

---

## المرحلة 1: Structured Input Trust Policy (P1)

**الملفات**: `src/pipeline/trust-policy.ts`, `src/components/editor/EditorArea.ts`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 1.1 | فحص `trust-policy.ts` | وجود الملف مع تصديرات واضحة |
| 1.2 | مستويات الثقة | تعريف `InputTrustLevel` يشمل: `trusted_structured` / `semi_structured` / `raw_text` |
| 1.3 | Metadata | `TrustAssessment` يحتوي: `schemaVersion` + `source` + `integrityCheck` أو ما يكافئها |
| 1.4 | القاعدة التشغيلية | `assessTrustLevel()` أو `resolveImportAction()`: system-generated → Direct Import، غير ذلك → fallback |
| 1.5 | EditorArea.ts | `importStructuredBlocks()` لا يعمل join+re-classify على البيانات الموثوقة |

---

## المرحلة 2: Command API v2 Backend (P0)

**الملفات**: `src/types/agent-review.ts`, `server/agent-review.mjs`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 2.1 | أنواع agent-review.ts | حذف `decisions[]` القديمة — المتبقي `commands[]` فقط |
| 2.2 | عقد v2 | `apiVersion: "2.0"` / `mode: "auto-apply"` / `importOpId` / `requestId` / `commands[]` |
| 2.3 | تعريف الأوامر | `RelabelCommand` (op: "relabel") + `SplitCommand` (op: "split", splitAt: number UTF-16) |
| 2.4 | السيرفر v2 فقط | `server/agent-review.mjs` لا يحتوي على مسارات v1 قديمة |
| 2.5 | Prompt الوكيل | الـ prompt يطلب JSON فقط / commands[] / بدون leftText |
| 2.6 | Validation | `splitAt >= 0` / رفض malformed / `status = "partial"` عند إسقاط أوامر |

---

## المرحلة 3: Client Transport (P0)

**الملفات**: `src/extensions/Arabic-Screenplay-Classifier-Agent.ts`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 3.1 | فحص الملف | وجود الملف (أو `agent-review-client.ts` بديل) |
| 3.2 | الدور | الملف هو Client Transport فقط — لا يحتوي منطق وكيل AI حقيقي |
| 3.3 | الدوال | `requestAgentReview()` + parse v2 + معالجة أخطاء شبكة + timeout |
| 3.4 | ثوابت | `AGENT_API_VERSION = "2.0"` / `AGENT_API_MODE = "auto-apply"` |

---

## المرحلة 4: إعادة هيكلة paste-classifier (P1)

**الملفات**: `src/extensions/paste-classifier.ts`, `src/extensions/classification-core.ts`, `src/pipeline/command-engine.ts`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 4.1 | فحص الملف | وجود `paste-classifier.ts` مع التصديرات الأساسية |
| 4.2 | فصل المسؤوليات | دوال منفصلة: `classifyText` (محلي) / `buildSuspicionPacket` أو `PostClassificationReviewer` / `requestAgentReview` / `applyCommandsAuto` أو ما يكافئها |
| 4.3 | Render-First | `applyPasteClassifierFlowToView()` يعرض فوراً بـ `view.dispatch()` ثم يطلق المراجعة async في الخلفية |
| 4.4 | importOpId | وجود snapshot مع: `itemId` + `fingerprint` + `type` + `rawTextLength`، و `appliedRequestIds` محفوظ |
| 4.5 | سياسات التجاهل | stale discard (importOpId mismatch) / partial apply (fingerprint mismatch) / idempotent discard (requestId مكرر) |
| 4.6 | Conflict Resolution | normalize → dedupe → apply once / split أولوية على relabel / split+split = رفض |
| 4.7 | تطبيق الأوامر | `applyRelabelCommand()` / `applySplitCommand()` بـ UTF-16 / التحقق الصامت: itemId + fingerprint + bounds |

---

## المرحلة 5: توحيد نقطة الدخول (P1)

**الملفات**: `src/components/editor/EditorArea.ts`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 5.1 | الدالة الموحدة | وجود `runTextIngestionPipeline()` أو دالة مكافئة تجمع كل مسارات الإدخال |
| 5.2 | المدخلات | تقبل: `text` / `structuredBlocks` / `source` / `metadata` |
| 5.3 | التوجيه | التوجيه بناءً على Trust Level من المرحلة 1 |
| 5.4 | Background Sanity | حتى `trusted_structured` يمر بفحص خلفي + Auto-Apply عند الرجوع |

---

## المرحلة 6: Packet / Token Budget (P2)

**الملفات**: `src/pipeline/packet-budget.ts`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 6.1 | الحدود المثبتة | `maxSuspiciousLines` / `maxChars` / `maxForced` / `maxPacketChars` / `timeout` / `retry` — قيم محددة |
| 6.2 | أولوية العناصر | forced أولاً → ثم suspicion score → ثم الطول |
| 6.3 | Chunking | (إن مفعّل) importOpId مشترك بين الأجزاء / requestId مختلف لكل جزء / idempotency |

---

## المرحلة 7: Telemetry / Logging (P2)

**الملفات**: `src/pipeline/telemetry.ts`, `src/utils/logger.ts`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 7.1 | تيليمتري الإدخال | importOpId / source / trustLevel / suspiciousCount / sentToAgentCount |
| 7.2 | تيليمتري الوكيل | requestId / latencyMs / status / commandsReceived |
| 7.3 | تيليمتري التطبيق | applied / skipped / fingerprint missing / invalid / conflict / stale / idempotent |

---

## المرحلة 8: الاختبارات (P1-P2)

**الملفات**: `tests/unit/extensions/`, `tests/unit/pipeline/`, `tests/harness/`

| # | الفحص | ماذا تبحث عنه |
|---|-------|---------------|
| 8.1 | اختبارات Root Cause | منع دمج «ثم + فعل» / دمج الحوار الصحيح يعمل |
| 8.2 | اختبارات Trust Policy | trusted → direct import / semi → fallback / raw → classifier |
| 8.3 | اختبارات Command API v2 | parse relabel / split / رفض malformed / splitAt UTF-16 |
| 8.4 | اختبارات stale/partial/idempotency | importOpId mismatch → discard / fingerprint → partial / requestId → idempotent |
| 8.5 | اختبارات Conflict Policy | split+relabel → split wins / split+split → reject |
| 8.6 | Regression Test | الجملة المختلطة لا تنتهي كـ dialogue واحدة |

---

## معايير القبول النهائية

بعد إتمام كل المراحل، تحقق من هذه المعايير السبعة:

| # | المعيار | الملف/الدالة المرجعية |
|---|--------|----------------------|
| AC-1 | الإدراج يظهر فوراً بدون انتظار الوكيل | `applyPasteClassifierFlowToView()` → `view.dispatch()` قبل async |
| AC-2 | فشل الوكيل لا يوقف الإدراج ولا rollback | `.catch()` في background review يسجّل خطأ ويتابع |
| AC-3 | importOpId mismatch → discard كامل | `command-engine.ts` → stale check |
| AC-4 | fingerprint mismatch → partial apply فقط | `matchesSnapshot()` → skip mismatched |
| AC-5 | requestId مكرر → لا يُعاد تطبيقه | `appliedRequestIds` Set check |
| AC-6 | trusted_structured → لا يُعاد تحويله لنص | `trust-policy.ts` → direct import path |
| AC-7 | حوار + «ثم فعل وصفي» → لا تبقى مصنفة خطأ | `THUMMA_ACTION_RE` أو ما يكافئه في `line-repair.ts` |

---

## صيغة التقرير النهائي

بعد إتمام كل الفحوصات، أنتج التقرير بهذه الصيغة:

```markdown
# تقرير مراجعة بايبلاين التصنيف
**التاريخ**: [تاريخ اليوم]
**الفرع**: [اسم الفرع]

## ملخص تنفيذي
- المراحل المكتملة: X/9
- الفحوصات الناجحة: X/Y
- الفحوصات الفاشلة: X/Y
- معايير القبول المحققة: X/7

## تفاصيل المراحل

### المرحلة 0: Root-Cause Hardening
| الفحص | النتيجة | التعليل |
|-------|---------|---------|
| 0.1   | PASS/FAIL/PARTIAL | ... |
...

[كرر لكل مرحلة]

### معايير القبول
| المعيار | النتيجة | التعليل |
|---------|---------|---------|
| AC-1   | PASS/FAIL | ... |
...

## الحكم النهائي
[ ] التنفيذ مكتمل — كل المعايير محققة
[ ] يوجد نواقص — قائمة أرقام المراحل الفاشلة: [...]

## التوصيات (إن وُجدت نواقص)
1. ...
2. ...
```

---

## خريطة الملفات المرجعية

| المرحلة | الملفات الأساسية |
|---------|-----------------|
| 0 | `src/extensions/line-repair.ts` |
| 1 | `src/pipeline/trust-policy.ts`, `src/components/editor/EditorArea.ts` |
| 2 | `src/types/agent-review.ts`, `server/agent-review.mjs` |
| 3 | `src/extensions/Arabic-Screenplay-Classifier-Agent.ts` |
| 4 | `src/extensions/paste-classifier.ts`, `src/extensions/classification-core.ts`, `src/pipeline/command-engine.ts` |
| 5 | `src/components/editor/EditorArea.ts` |
| 6 | `src/pipeline/packet-budget.ts` |
| 7 | `src/pipeline/telemetry.ts` |
| 8 | `tests/unit/extensions/`, `tests/unit/pipeline/` |

---

## مخطط التدفق

```mermaid
flowchart TB
    start(("بدء المراجعة")):::startEnd

    subgraph P0_ROOT["P0 — المرحلة 0: Root-Cause Hardening"]
        direction TB
        p0_file["فحص line-repair.ts"]:::check
        p0_regex["التحقق: Regex للافعال بعد ثم"]:::check
        p0_test["اختبار الحالة الحرجة"]:::test
        p0_merge["التحقق: دمج الحوار الصحيح"]:::test
        p0_file --> p0_regex --> p0_test --> p0_merge
    end

    subgraph P2_API["P0 — المرحلة 2: Command API v2"]
        direction TB
        p2_types["فحص agent-review.ts"]:::check
        p2_contract["التحقق: عقد v2"]:::check
        p2_server["فحص agent-review.mjs"]:::check
        p2_validation["التحقق: Validation"]:::check
        p2_types --> p2_contract --> p2_server --> p2_validation
    end

    subgraph P3_CLIENT["P0 — المرحلة 3: Client Transport"]
        direction TB
        p3_file["فحص Agent Client"]:::check
        p3_role["التحقق: Transport فقط"]:::check
        p3_funcs["التحقق: الدوال"]:::check
        p3_file --> p3_role --> p3_funcs
    end

    subgraph P1_TRUST["P1 — المرحلة 1: Trust Policy"]
        direction TB
        p1_types["فحص trust-policy.ts"]:::check
        p1_levels["التحقق: مستويات الثقة"]:::check
        p1_editor["فحص EditorArea.ts"]:::check
        p1_types --> p1_levels --> p1_editor
    end

    subgraph P4_CLASS["P1 — المرحلة 4: paste-classifier"]
        direction TB
        p4_sep["فصل المسؤوليات"]:::check
        p4_render["Render-First"]:::check
        p4_stale["سياسات التجاهل"]:::check
        p4_conflict["Conflict Resolution"]:::check
        p4_sep --> p4_render --> p4_stale --> p4_conflict
    end

    subgraph P5_ENTRY["P1 — المرحلة 5: نقطة الدخول"]
        direction TB
        p5_func["الدالة الموحدة"]:::check
        p5_routing["التوجيه بـ Trust"]:::check
        p5_func --> p5_routing
    end

    subgraph P6_BUDGET["P2 — المرحلة 6: Token Budget"]
        direction TB
        p6_limits["الحدود المثبتة"]:::check
        p6_priority["اولوية العناصر"]:::check
        p6_limits --> p6_priority
    end

    subgraph P7_TELE["P2 — المرحلة 7: Telemetry"]
        direction TB
        p7_import["تيليمتري الادخال"]:::check
        p7_agent["تيليمتري الوكيل"]:::check
        p7_apply["تيليمتري التطبيق"]:::check
        p7_import --> p7_agent --> p7_apply
    end

    subgraph P8_TESTS["P1-P2 — المرحلة 8: الاختبارات"]
        direction TB
        p8_root["اختبارات Root Cause"]:::test
        p8_v2["اختبارات API v2"]:::test
        p8_conflict["اختبارات Conflict"]:::test
        p8_root --> p8_v2 --> p8_conflict
    end

    subgraph FINAL["معايير القبول النهائية"]
        direction TB
        f1["AC-1: ادراج فوري"]:::accept
        f2["AC-2: فشل الوكيل لا يوقف"]:::accept
        f3["AC-3..7: باقي المعايير"]:::accept
        f1 --- f2 --- f3
    end

    verdict{"هل كل المعايير محققة؟"}:::decision
    pass(("التنفيذ مكتمل")):::pass
    fail["قائمة النواقص"]:::fail

    start --> P0_ROOT
    P0_ROOT --> P2_API
    P2_API --> P3_CLIENT
    P3_CLIENT --> P1_TRUST
    P1_TRUST --> P4_CLASS
    P4_CLASS --> P5_ENTRY
    P5_ENTRY --> P6_BUDGET
    P6_BUDGET --> P7_TELE
    P7_TELE --> P8_TESTS
    P8_TESTS --> FINAL
    FINAL --> verdict
    verdict -- "نعم" --> pass
    verdict -- "لا" --> fail
    fail -- "معالجة النواقص" --> start

    classDef startEnd fill:#7ED321,stroke:#5B9A18,color:#fff,stroke-width:3px
    classDef check fill:#4A90D9,stroke:#2C5F8A,color:#fff,stroke-width:1px
    classDef test fill:#9B59B6,stroke:#7D3F98,color:#fff,stroke-width:1px
    classDef accept fill:#2ECC71,stroke:#27AE60,color:#fff,stroke-width:1px
    classDef decision fill:#E67E22,stroke:#D35400,color:#fff,stroke-width:2px
    classDef pass fill:#27AE60,stroke:#1E8449,color:#fff,stroke-width:3px
    classDef fail fill:#E74C3C,stroke:#C0392B,color:#fff,stroke-width:2px

    style P0_ROOT fill:#2C3E50,stroke:#E74C3C,color:#ECF0F1,stroke-width:2px
    style P2_API fill:#2C3E50,stroke:#E74C3C,color:#ECF0F1,stroke-width:2px
    style P3_CLIENT fill:#2C3E50,stroke:#E74C3C,color:#ECF0F1,stroke-width:2px
    style P1_TRUST fill:#2C3E50,stroke:#E67E22,color:#ECF0F1,stroke-width:2px
    style P4_CLASS fill:#2C3E50,stroke:#E67E22,color:#ECF0F1,stroke-width:2px
    style P5_ENTRY fill:#2C3E50,stroke:#E67E22,color:#ECF0F1,stroke-width:2px
    style P6_BUDGET fill:#2C3E50,stroke:#F1C40F,color:#ECF0F1,stroke-width:2px
    style P7_TELE fill:#2C3E50,stroke:#F1C40F,color:#ECF0F1,stroke-width:2px
    style P8_TESTS fill:#2C3E50,stroke:#E67E22,color:#ECF0F1,stroke-width:2px
    style FINAL fill:#1A2530,stroke:#2ECC71,color:#ECF0F1,stroke-width:2px
```

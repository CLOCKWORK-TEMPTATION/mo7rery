---
name: typescript-types-aligner
description: |
  توحيد وتطابق الأنواع والاستدعاءات والتصديرات بين ملفات TypeScript المختلفة.
  تستخدم عند:
  - حل أخطاء "Cannot find module" أو "Module has no exported member"
  - توحيد interfaces/types بين الملفات
  - تصحيح inconsistencies في الأنواع
  - إعادة بناء exports/imports
  - محاذاة أنواع البيانات بين frontend و backend
  - إصلاح mismatch بين تعريفات الأنواع في ملفات مختلفة
---

# TypeScript Types Aligner

مهارة متخصصة في توحيد وتطابق الأنواع والاستدعاءات والتصديرات في مشاريع TypeScript.

## الأخطاء الشائعة التي تعالجها هذه المهارة

| الخطأ | السبب | الحل |
|-------|-------|------|
| `Cannot find module` | الملف غير موجود أو الاسم غلط | التحقق من المسار وتصحيحه |
| `Module has no exported member` | الـ export مش موجود | إضافة export أو استخدام type الموجود |
| `Type 'X' is not assignable to type 'Y'` | عدم تطابق الأنواع | توحيد الأنواع أو استخدام type assertion |
| `Property does not exist on type` | الخاصية مش موجودة في interface | إضافة الخاصية أو تعديل النوع |
| `Cannot redeclare exported member` | تصدير مكرر | استخدام export واحد فقط |

## سير العمل

### 1. تحليل المشكلة

عند مواجهة خطأ في الأنواع:
1. قراءة ملف الأخطاء الحالي
2. فهم التبعيات بين الملفات
3. تحديد الملف المصدر والهدف

### 2. حل Import/Export Issues

#### مشكلة: Cannot find module
```typescript
// ❌ خطأ
import { TrustLevel } from "./trust-policy"; // Module not found

// ✅ صح
import { InputTrustLevel } from "./trust-policy"; // Use the correct exported name
```

#### مشكلة: No exported member
```typescript
// في trust-policy.ts - إضافة export
export type TrustLevel = InputTrustLevel;

// أو في الملف المستورد - استخدام الاسم الصحيح
import { InputTrustLevel as TrustLevel } from "./trust-policy";
```

### 3. توحيد Interfaces

عند وجود interfaces متشابهة في ملفات مختلفة:

```typescript
// الملف A
interface User {
  id: string;
  name: string;
}

// الملف B
interface User {
  userId: string;  // ❌ inconsistent naming
  fullName: string;
}

// ✅ الحل: توحيد الأسماء في ملف مشترك
types/shared.ts:
export interface User {
  id: string;
  name: string;
}
```

### 4. حل Type Mismatches

#### المشكلة: Type string not assignable to type '"value"'
```typescript
// ❌ خطأ
const apiVersion: "2.0" = "v2";  // Type 'string' not assignable

// ✅ صح - Method 1: Type assertion
const apiVersion = "v2" as "2.0";

// ✅ صح - Method 2: Const assertion
const COMMAND_API_VERSION = "v2" as const;

// ✅ صح - Method 3: Type guard
const apiVersion: "2.0" = 
  typeof rawVersion === "string" && rawVersion === "2.0"
    ? rawVersion
    : "2.0";
```

### 5. تصدير الأنواع بشكل صحيح

```typescript
// ❌ مشكلة: Type declared but not exported
type InternalType = { ... };

// ✅ الحل: Export explicit
export type { InternalType };
// أو
export interface InternalType { ... }
```

## الأنماط الشائعة

### Pattern 1: Re-export with Alias
```typescript
// index.ts
export { InputTrustLevel as TrustLevel } from "./trust-policy";
export { default as logger } from "./logger";
```

### Pattern 2: Barrel Export
```typescript
// types/index.ts
export * from "./agent-review";
export * from "./screenplay";
export { default as User } from "./user";
```

### Pattern 3: Type vs Interface
```typescript
// استخدام interface للـ public API
export interface AgentCommand {
  op: string;
  itemId: string;
}

// استخدام type للـ unions/aliases
export type CommandOp = "relabel" | "split";
```

## التحقق بعد التعديلات

بعد إجراء تغييرات، تحقق من:
1. عدم وجود دوائر circular dependencies
2. أن كل import يشير إلى export موجود
3. أن الأنواع متطابقة في جميع الملفات
4. عدم وجود duplicate identifiers

## المراجع

- [TypeScript Module Resolution](references/module-resolution.md)
- [Common Type Mismatches](references/type-mismatches.md)
- [Export/Import Patterns](references/export-import-patterns.md)

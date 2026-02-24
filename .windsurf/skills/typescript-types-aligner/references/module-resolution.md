# TypeScript Module Resolution

## فهم Module Resolution في TypeScript

### أنواع Module Resolution

1. **Classic** (القديم) - للمشاريع القديمة
2. **Node** (الافتراضي) - يحاكي Node.js resolution

### استراتيجيات البحث عن الملفات

#### 1. Non-relative Imports
```typescript
import { User } from "@/types/user";  // Path alias
import { utils } from "../utils";       // Parent directory
import { config } from "./config";      // Same directory
```

#### 2. Path Aliases (tsconfig.json)
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

#### 3. Extension Resolution
TypeScript يحاول امتدادات الملفات بالترتيب:
1. `.ts`
2. `.tsx`
3. `.d.ts`
4. (في CommonJS) `.js`

## أخطاء Module Resolution الشائعة

### الخطأ: Cannot find module
```
error TS2307: Cannot find module './utils' or its corresponding type declarations.
```

**الأسباب:**
1. الملف مش موجود
2. الخطأ في المسار (case sensitivity)
3. extension غلط
4. tsconfig paths مش مضبوط

**الحلول:**
```typescript
// ❌ خطأ - الملف مش موجود
import { helper } from "./util";

// ✅ صح - الملف موجود
import { helper } from "./utils";

// ✅ صح - مع الامتداد
import { helper } from "./utils.ts";
```

### الخطأ: Module has no exported member
```
error TS2305: Module '"./types"' has no exported member 'User'.
```

**الأسباب:**
1. الاسم غلط
2. الـ export مش موجود
3. الـ export default vs named export

**الحلول:**
```typescript
// في types.ts
export interface User { ... }          // Named export
export default class UserManager { ... } // Default export

// ❌ خطأ - محاولة استخدام default كـ named
import { User } from "./types";  // User هو default!

// ✅ صح - استخدام default export
import UserManager from "./types";

// ✅ صح - استخدام named export
import { User } from "./types";
```

## استراتيجيات Import/Export المتقدمة

### 1. Re-exports
```typescript
// index.ts - Barrel export
export * from "./user";
export { User as UserType } from "./user";
export { default as Logger } from "./logger";
```

### 2. Type-only Imports
```typescript
// ✅ TypeScript 3.8+
import type { User } from "./types";

// مفيد لـ:
// - تجنب circular dependencies
// - tree shaking optimization
// - clarify type-only usage
```

### 3. Module Augmentation
```typescript
// augment-external-module.d.ts
declare module "external-library" {
  export interface AdditionalProps {
    newFeature: boolean;
  }
}
```

## Circular Dependencies

### الكشف عن Circular Dependencies
```
File A imports from B
File B imports from C
File C imports from A  // ⭕ Circular!
```

### الحلول
1. **إعادة التنظيم**: نقل الأنواع المشتركة لملف مستقل
2. **Interface Segregation**: تقسيم interfaces كبيرة
3. **Dependency Injection**: تجنب الـ import المباشر

```typescript
// ✅ بدل import مباشر
// types.ts
export interface UserService {
  getUser(id: string): User;
}

// user.ts
import type { UserService } from "./types";

export class UserManager implements UserService {
  getUser(id: string) { ... }
}
```

## Best Practices

1. **استخدم Path Aliases** لتبسيط الـ imports
2. **Barrel Exports** لتقليل عدد الـ imports
3. **Type-only imports** لـ types
4. **تجنب Circular Dependencies**
5. **Consistency** في naming conventions

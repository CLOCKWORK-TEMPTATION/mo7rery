# Export/Import Patterns in TypeScript

## 1. Named Exports (Recommended)

### الأساسي

```typescript
// utils.ts
export function calculate() { ... }
export const CONFIG = { ... };
export interface User { ... }
export type ID = string;
```

### الاستخدام

```typescript
import { calculate, CONFIG, User, ID } from "./utils";
```

### مميزات

- Explicit and clear
- IDE support (auto-import)
- Tree shaking friendly

## 2. Default Exports

### الأساسي

```typescript
// logger.ts
export default class Logger {
  log(message: string) { ... }
}

// أو
const logger = new Logger();
export default logger;
```

### الاستخدام

```typescript
import Logger from "./logger";
import MyLogger from "./logger"; // ✅ Can rename
```

### تحذيرات

```typescript
// ❌ يمكن إعادة التسمية بشكل مربك
import L from "./logger";
import Log from "./logger";
import Logger from "./logger";
// كلهم نفس الشيء!
```

## 3. Re-exports (Barrel Pattern)

### الأساسي

```typescript
// index.ts (barrel file)
export * from "./user";
export * from "./product";
export { default as Logger } from "./logger";
export { User as UserType } from "./user";
```

### الاستخدام

```typescript
import { User, Product, Logger } from "./index";
// أو
import { User, Product, Logger } from "."; // إذا كان index.ts
```

### مميزات Barrel Pattern

- Simplified imports
- API facade for modules
- Easy refactoring

### تحذيرات

- Circular dependencies risk
- Can hide module structure
- May impact tree shaking

## 4. Type-only Exports

### TypeScript 3.8+

```typescript
// types.ts
export interface User { ... }
export type ID = string;

// Explicit type-only export
export type { User, ID };
```

### الاستخدام

```typescript
import type { User, ID } from "./types";
```

### فوائد

- Clear intent (type vs value)
- Better tree shaking
- Avoids circular dependencies

## 5. Namespace Exports

### الأساسي

```typescript
// validation.ts
export namespace Validation {
  export interface Schema { ... }
  export function validate() { ... }
}
```

### الاستخدام

```typescript
import { Validation } from "./validation";
const schema: Validation.Schema = ...;
Validation.validate(schema);
```

### ملاحظة

- Less common in modern TypeScript
- Prefer ES modules over namespaces

## 6. Side-effect Imports

### الأساسي

```typescript
// polyfills.ts
import "./polyfills"; // No exports, just executes
```

### الاستخدامات

- Polyfills
- Global styles
- Initialization code

## 7. Dynamic Imports

### الأساسي

```typescript
// Lazy loading
async function loadModule() {
  const module = await import("./heavy-module");
  module.doSomething();
}
```

### With Type Annotation

```typescript
const module = await import("./module");
```

### With Dynamic Path

```typescript
const locale = "en";
const translations = await import(`./locales/${locale}.json`);
```

## 8. Re-export with Modification

### Adding Functionality

```typescript
// enhanced-logger.ts
export * from "./logger";

export function enhancedLog(message: string) {
  console.log(`[Enhanced] ${message}`);
}
```

### Selective Re-export

```typescript
// public-api.ts
export {
  User,
  Product,
  // ❌ InternalType not exported
} from "./types";
```

## 9. Import Aliases

### Preventing Conflicts

```typescript
import { User as UserEntity } from "./entities";
import { User as UserModel } from "./models";

const entity: UserEntity = ...;
const model: UserModel = ...;
```

### Type Aliases

```typescript
import type { User } from "./user";
import type { User as IUser } from "./interfaces";
```

## 10. Module Augmentation

### Extending External Modules

```typescript
// augmentations.ts
declare module "express" {
  export interface Request {
    user?: User;
  }
}
```

### Usage

```typescript
import "./augmentations";
import express from "express";

app.use((req, res, next) => {
  req.user = { ... };  // ✅ Now available
});
```

## Best Practices

### 1. Consistency

```typescript
// ❌ Mixed style
export const a = 1;
export default function b() {}

// ✅ Consistent named exports
export const a = 1;
export function b() {}
```

### 2. Single Responsibility

```typescript
// ❌ Too many exports
export * from "./user";
export * from "./product";
export * from "./order";
export * from "./payment";

// ✅ Separate barrels
// users/index.ts
export * from "./user";
export * from "./user-profile";
```

### 3. Explicit over Implicit

```typescript
// ❌ Implicit
export * from "./utils";

// ✅ Explicit
export { calculate, formatDate } from "./utils";
```

### 4. Avoid Deep Nesting

```typescript
// ❌ Deep import
import { helper } from "../../../utils/helpers";

// ✅ Use path aliases
import { helper } from "@/utils/helpers";
```

### 5. Version Exports

```typescript
// api/v1.ts
export * from "./v1/user";
export * from "./v1/product";

// api/v2.ts
export * from "./v2/user";
export * from "./v2/product";

// api/index.ts
export * as v1 from "./v1";
export * as v2 from "./v2";
```

## Common Anti-patterns

### 1. Barrel Cyclic Dependencies

```typescript
// a/index.ts
export * from "../b"; // ❌ Circular

// b/index.ts
export * from "../a"; // ❌ Circular
```

### 2. Wildcard Import with Side Effects

```typescript
// ❌ Unclear what is being used
import * as utils from "./utils";

// ✅ Explicit import
import { calculate, formatDate } from "./utils";
```

### 3. Re-exporting Everything

```typescript
// ❌ Leaking internal types
export * from "./internal";

// ✅ Explicit public API
export { PublicType } from "./internal";
```

## Quick Reference

| Pattern             | When to Use                    |
| ------------------- | ------------------------------ |
| Named exports       | Default choice for most cases  |
| Default export      | Single class/function per file |
| Barrel exports      | Module API facade              |
| Type-only imports   | When importing only types      |
| Dynamic imports     | Lazy loading, code splitting   |
| Module augmentation | Extending external types       |

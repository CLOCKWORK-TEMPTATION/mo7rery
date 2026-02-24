# Common Type Mismatches in TypeScript

## 1. String Literal Types vs string

### المشكلة
```typescript
// Type '"value"' is not assignable to type 'string'
const apiVersion: "2.0" = "v2";  // ❌ Error
```

### الحلول

#### الحل 1: Const Assertion
```typescript
const COMMAND_API_VERSION = "v2" as const;
// Type: "v2" (literal type)
```

#### الحل 2: Type Declaration
```typescript
const COMMAND_API_VERSION: "2.0" = "v2" as "2.0";
```

#### الحل 3: Conditional Assignment
```typescript
const apiVersion: "2.0" = 
  typeof rawVersion === "string" && rawVersion === "2.0"
    ? rawVersion
    : "2.0";
```

## 2. Interface vs Type Assignment

### المشكلة
```typescript
interface User {
  id: string;
  name: string;
}

type UserInput = {
  id: string;
  name: string;
  email: string;
}

const user: User = input;  // ❌ Property 'email' is missing
```

### الحلول

#### الحل 1: Pick/Omit
```typescript
const user: User = {
  id: input.id,
  name: input.name,
};  // ✅

// أو
const user: User = {
  ...input,
  email: undefined,  // ❌ Won't work
};
```

#### الحل 2: Type Assertion (Use with caution)
```typescript
const user = input as User;  // ✅ But risky
```

#### الحل 3: Discriminated Union
```typescript
type UserInput = {
  id: string;
  name: string;
  email: string;
  type: 'input';
}

interface User {
  id: string;
  name: string;
  type: 'user';
}

// Explicit conversion
function convertToUser(input: UserInput): User {
  return {
    id: input.id,
    name: input.name,
    type: 'user',
  };
}
```

## 3. Missing Properties

### المشكلة
```typescript
interface Packet {
  items: string[];
  forcedItemIds: string[];
}

const packet = buildPacket(items);
// Error: Property 'forcedItemIds' is missing
```

### الحلول

#### الحل 1: Optional Properties
```typescript
interface Packet {
  items: string[];
  forcedItemIds?: string[];  // Optional
}
```

#### الحل 2: Default Values
```typescript
const packet: Packet = {
  items,
  forcedItemIds: [],  // Default empty array
};
```

#### الحل 3: Type Guard
```typescript
function isPacket(obj: unknown): obj is Packet {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'items' in obj &&
    Array.isArray((obj as Packet).items)
  );
}
```

## 4. Union Type Narrowing

### المشكلة
```typescript
type Status = "applied" | "partial" | "skipped" | "error";

function process(status: string) {  // ❌ too wide
  if (status === "applied") {
    // Type is still string, not "applied"
  }
}
```

### الحلول

#### الحل 1: Type Guard
```typescript
function isStatus(value: string): value is Status {
  return ["applied", "partial", "skipped", "error"].includes(value);
}

function process(status: string) {
  if (isStatus(status)) {
    // status is now Status type
  }
}
```

#### الحل 2: Exhaustive Check
```typescript
function process(status: Status) {
  switch (status) {
    case "applied":
      return handleApplied();
    case "partial":
      return handlePartial();
    case "skipped":
      return handleSkipped();
    case "error":
      return handleError();
    default:
      // Exhaustiveness check
      const _exhaustive: never = status;
      throw new Error(`Unknown status: ${status}`);
  }
}
```

## 5. Generic Type Mismatches

### المشكلة
```typescript
interface Result<T> {
  data: T;
  error?: string;
}

function process<T>(result: Result<T>) {
  // Works with any T
}

process({ data: "string" });  // ✅
process({ data: 123 });       // ✅
process<string>({ data: 123 }); // ❌ Type mismatch
```

### الحلول

#### الحل 1: Infer from Usage
```typescript
// Let TypeScript infer
const result = { data: 123 };
process(result);  // T is number
```

#### الحل 2: Explicit Generic
```typescript
process<number>({ data: 123 });  // ✅
```

## 6. Async/Await Types

### المشكلة
```typescript
async function fetchData(): Promise<string> {
  return "data";
}

const data: string = fetchData();  // ❌ Type is Promise<string>
```

### الحلول

#### الحل 1: Await the Promise
```typescript
const data: string = await fetchData();  // ✅
```

#### الحل 2: Handle in Async Context
```typescript
async function process() {
  const data = await fetchData();
  // data is string
}
```

#### الحل 3: Use .then()
```typescript
fetchData().then((data: string) => {
  // Process data
});
```

## 7. Array vs ReadonlyArray

### المشكلة
```typescript
function process(items: readonly string[]) {
  items.push("new");  // ❌ Cannot mutate readonly array
}
```

### الحلول

#### الحل 1: Spread (Create new array)
```typescript
const newItems = [...items, "new"];  // ✅
```

#### الحل 2: Mutable Array in Function
```typescript
function process(items: string[]) {  // Remove readonly
  items.push("new");  // ✅
}
```

## 8. Null and Undefined

### المشكلة
```typescript
interface User {
  name: string;
  email: string | null;
}

const user: User = {
  name: "John",
  email: undefined,  // ❌ Type 'undefined' not assignable
};
```

### الحلول

#### الحل 1: Use null explicitly
```typescript
const user: User = {
  name: "John",
  email: null,  // ✅
};
```

#### الحل 2: Optional Property
```typescript
interface User {
  name: string;
  email?: string | null;  // Optional
}

const user: User = { name: "John" };  // ✅
```

## 9. Function Return Types

### المشكلة
```typescript
function calculate(): number {
  if (condition) {
    return 42;
  }
  // ❌ Function lacks ending return statement
}
```

### الحلول

#### الحل 1: Explicit Return
```typescript
function calculate(): number {
  if (condition) {
    return 42;
  }
  return 0;  // ✅ Default return
}
```

#### الحل 2: Union Return Type
```typescript
function calculate(): number | undefined {
  if (condition) {
    return 42;
  }
  // undefined is implicitly returned
}
```

#### الحل 3: Never
```typescript
function calculate(): number {
  if (condition) {
    return 42;
  }
  throw new Error("Calculation failed");  // ✅ Returns never
}
```

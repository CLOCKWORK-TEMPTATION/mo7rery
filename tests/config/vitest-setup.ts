// ملف إعداد Vitest للتأكد من تحميل إعدادات الاختبار قبل التشغيل.
import { getTestConfig } from "./test-config-manager";
import { logTestSuiteStart } from "./test-logger";

const createDomRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  }) as DOMRect;

const createDomRectList = (): DOMRectList =>
  ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* iterator() {
      yield* [];
    },
  }) as DOMRectList;

const attachRectPolyfills = <T extends object>(target: T): void => {
  const typedTarget = target as T & {
    getBoundingClientRect?: () => DOMRect;
    getClientRects?: () => DOMRectList;
  };

  if (!typedTarget.getBoundingClientRect) {
    Object.defineProperty(typedTarget, "getBoundingClientRect", {
      value: createDomRect,
      configurable: true,
      writable: true,
    });
  }

  if (!typedTarget.getClientRects) {
    Object.defineProperty(typedTarget, "getClientRects", {
      value: createDomRectList,
      configurable: true,
      writable: true,
    });
  }
};

if (typeof Node !== "undefined") {
  attachRectPolyfills(Node.prototype);
}

if (typeof Range !== "undefined") {
  attachRectPolyfills(Range.prototype);
}

if (typeof Element !== "undefined") {
  attachRectPolyfills(Element.prototype);
}

if (typeof Text !== "undefined") {
  attachRectPolyfills(Text.prototype);
}

if (
  typeof HTMLElement !== "undefined" &&
  !HTMLElement.prototype.scrollIntoView
) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

const config = getTestConfig();
logTestSuiteStart(`Vitest Suite - ENV: ${config.NODE_ENV}`);

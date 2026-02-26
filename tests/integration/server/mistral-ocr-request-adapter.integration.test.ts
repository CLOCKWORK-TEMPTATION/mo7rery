import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { logTestStep } from "../../config/test-logger";

const require = createRequire(import.meta.url);
const PATCH_MARKER = Symbol.for("filmlane.mistral.ocr.request.adapter");

describe("mistral-ocr-request-adapter integration", () => {
  it("installs OCR request adapter patch without runtime errors", async () => {
    logTestStep("mistral-adapter-install");

    await import("../../../server/mistral-ocr-request-adapter.mjs");
    const { Ocr } = require("@mistralai/mistralai/sdk/ocr.js");

    expect(typeof Ocr?.prototype?.process).toBe("function");
    const marker = (Ocr.prototype.process as Record<symbol, unknown>)[
      PATCH_MARKER
    ];
    expect(marker).toBe(true);
  });
});

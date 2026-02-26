import { describe, expect, it } from "vitest";
import { simpleLineAlignment } from "../../../src/pipeline/patch/align";
import { logTestStep } from "../../config/test-logger";

describe("align integration", () => {
  it("aligns similar texts and finds close matches", () => {
    logTestStep("align-similar");

    const source = ["داخلي - مكتب - نهار", "أحمد: مرحباً", "يجلس على الكرسي"];
    const ocr = ["داخلي - مكتب - نهار", "أحمد: مرحبا", "يجلس على الكرسى"];

    const matches = simpleLineAlignment(source, ocr);
    expect(matches.length).toBe(source.length);
    expect(matches[0].score).toBeGreaterThan(0.9);
  });

  it("handles highly different texts without crashing", () => {
    logTestStep("align-different");

    const matches = simpleLineAlignment(
      ["أول سطر", "ثاني سطر"],
      ["xxxxxxxx", "yyyyyyyy", "zzzzzzzz"]
    );

    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
  });
});

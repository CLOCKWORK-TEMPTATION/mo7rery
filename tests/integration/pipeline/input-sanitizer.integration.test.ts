import { describe, expect, it } from "vitest";
import { sanitizeInput } from "../../../src/pipeline/input-sanitizer";
import { loadRawFixture } from "../../config/test-fixtures";
import { logTestStep } from "../../config/test-logger";

describe("input-sanitizer integration", () => {
  it("cleans excessive whitespace while keeping logical lines", () => {
    logTestStep("sanitize-whitespace");
    const input = "[pStyle=-]\t\tداخلي - شقة أحمد - ليل   \n\n\n   أحمد:   ";
    const result = sanitizeInput(input);

    expect(result.text).toContain("داخلي - شقة أحمد - ليل");
    expect(result.text).not.toContain("[pStyle=");
    expect(result.report.totalMatchCount).toBeGreaterThan(0);
    expect(result.report.wasModified).toBe(true);
  });

  it("does not corrupt Arabic unicode letters and diacritics", () => {
    logTestStep("sanitize-arabic-unicode");
    const input = "إِبْراهِيم قال: لَا تَقْلَقْ";
    const result = sanitizeInput(input);

    expect(result.text).toContain("إِبْراهِيم");
    expect(result.text).toContain("لَا");
  });

  it("removes control/metadata artifacts when present", () => {
    logTestStep("sanitize-control-chars");
    const input = "[pStyle=-] أحمد:\n{PAGE } مرحباً";
    const result = sanitizeInput(input);

    expect(result.text).not.toContain("[pStyle=");
    expect(result.text).not.toContain("{PAGE");
  });

  it("keeps valid scene header unchanged", () => {
    logTestStep("sanitize-scene-header-preserve");
    const input = "داخلي - شقة أحمد - ليل";
    const result = sanitizeInput(input);

    expect(result.text).toBe(input);
  });

  it("sanitizes dirty fixture and removes clustered zero-width/control artifacts", async () => {
    logTestStep("sanitize-dirty-fixture");
    const input = await loadRawFixture("sample-dirty-input");
    const result = sanitizeInput(input);

    expect(result.text).not.toContain("[pStyle=");
    expect(result.text).not.toContain("{PAGE");
    expect(result.text).not.toContain("<w:r>");
  });
});

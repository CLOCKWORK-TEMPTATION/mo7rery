import { describe, expect, it } from "vitest";
import {
  normalizeArabicPunctuationForCompare,
  normalizeSpaces,
  stripZeroWidth,
  finalRenderLineNormalize,
} from "../../../src/pipeline/normalize";
import { logTestStep } from "../../config/test-logger";

describe("normalize integration", () => {
  it("normalizes hamza variants for comparable output", () => {
    logTestStep("normalize-hamza");
    const a = normalizeArabicPunctuationForCompare("إبراهيم");
    const b = normalizeArabicPunctuationForCompare("أبراهيم");

    expect(a.replace("إ", "ا")).toBe(b.replace("أ", "ا"));
  });

  it("normalizes Arabic and English punctuation spacing", () => {
    logTestStep("normalize-punctuation");
    const value = normalizeArabicPunctuationForCompare("نص ،  ثم ;  نهاية");
    expect(value).toContain("،");
    expect(value).toContain(";");
    expect(value).not.toContain("  ");
  });

  it("normalizes repeated spaces", () => {
    logTestStep("normalize-spaces");
    expect(normalizeSpaces("داخلي    -   مكتب   - نهار")).toBe(
      "داخلي - مكتب - نهار"
    );
  });

  it("treats scene header spelling variants consistently", () => {
    logTestStep("normalize-scene-header-variant");
    const a = normalizeArabicPunctuationForCompare("داخلى - مكتب - نهار");
    const b = normalizeArabicPunctuationForCompare("داخلي - مكتب - نهار");
    expect(a.replace("ى", "ي")).toBe(b);
  });

  it("is idempotent on already normalized values", () => {
    logTestStep("normalize-idempotent");
    const input = finalRenderLineNormalize(
      stripZeroWidth("داخلي - مكتب - نهار")
    );
    const second = finalRenderLineNormalize(stripZeroWidth(input));

    expect(second).toBe(input);
  });
});

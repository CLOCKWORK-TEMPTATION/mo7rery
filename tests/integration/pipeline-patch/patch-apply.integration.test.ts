import { describe, expect, it } from "vitest";
import { patchSuspiciousLinesFromOcr } from "../../../src/pipeline/patch/patch-apply";
import type { ExtractedLine } from "../../../src/pipeline/types";
import { logTestStep } from "../../config/test-logger";

const createLine = (
  id: string,
  text: string,
  score: number
): ExtractedLine => ({
  id,
  page: 1,
  lineNoOnPage: 1,
  text,
  source: "text-layer",
  quality: {
    score,
    reasons: [],
    weirdCharRatio: 0,
    arabicRatio: 1,
    digitRatio: 0,
    punctuationRatio: 0,
    hasBrokenArabicPattern: false,
    suspiciousDialoguePattern: false,
    probableArtifact: false,
  },
  flags: [],
});

describe("patch-apply integration", () => {
  it("applies a single OCR patch on suspicious line", () => {
    logTestStep("patch-apply-single");

    const result = patchSuspiciousLinesFromOcr({
      pageLines: [createLine("1", "أحمد: مرحبا", 0.3)],
      ocrLines: ["أحمد: مرحباً"],
      suspiciousThreshold: 0.62,
      maxEditDistanceRatio: 0.5,
    });

    expect(result.patched).toBe(1);
    expect(result.lines[0].text).toBe("أحمد: مرحباً");
  });

  it("applies multiple patches across lines", () => {
    logTestStep("patch-apply-multi");

    const result = patchSuspiciousLinesFromOcr({
      pageLines: [
        createLine("1", "أحمد: مرحبا", 0.3),
        createLine("2", "داخلى - مكتب", 0.2),
      ],
      ocrLines: ["أحمد: مرحباً", "داخلي - مكتب"],
      suspiciousThreshold: 0.62,
      maxEditDistanceRatio: 0.6,
    });

    expect(result.patched).toBeGreaterThanOrEqual(1);
  });

  it("remains idempotent when same patch runs twice", () => {
    logTestStep("patch-apply-idempotent");

    const initial = patchSuspiciousLinesFromOcr({
      pageLines: [createLine("1", "أحمد: مرحبا", 0.3)],
      ocrLines: ["أحمد: مرحباً"],
      suspiciousThreshold: 0.62,
      maxEditDistanceRatio: 0.5,
    });

    const second = patchSuspiciousLinesFromOcr({
      pageLines: initial.lines,
      ocrLines: ["أحمد: مرحباً"],
      suspiciousThreshold: 0.62,
      maxEditDistanceRatio: 0.5,
    });

    expect(second.lines[0].text).toBe("أحمد: مرحباً");
  });
});

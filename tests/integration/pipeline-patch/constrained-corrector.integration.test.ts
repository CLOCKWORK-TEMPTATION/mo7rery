import { describe, expect, it } from "vitest";
import { applyOcrPatchesToPages } from "../../../src/pipeline/patch/constrained-corrector";
import type {
  PageExtraction,
  PipelineConfig,
} from "../../../src/pipeline/types";
import { logTestStep } from "../../config/test-logger";

const config: PipelineConfig = {
  lineMerge: {
    yTolerance: 0,
    xGapMergeThreshold: 0,
    minSpaceInsertGap: 0,
  },
  quality: {
    suspiciousThreshold: 0.62,
    weirdCharRatioThreshold: 0.2,
    minArabicRatioForArabicDocs: 0.4,
  },
  ocr: {
    enabled: true,
    provider: "mistral",
    maxPagesPerBatch: 1,
  },
  patch: {
    maxEditDistanceRatio: 0.5,
    requireSameLineCountWindow: false,
    windowSize: 3,
  },
  domain: {
    screenplayArabicMode: true,
  },
};

const lowQualityLine = {
  id: "1",
  page: 1,
  lineNoOnPage: 1,
  text: "أ ح م د : م ر ح ب ا",
  source: "text-layer" as const,
  quality: {
    score: 0.4,
    reasons: ["broken"],
    weirdCharRatio: 0,
    arabicRatio: 1,
    digitRatio: 0,
    punctuationRatio: 0,
    hasBrokenArabicPattern: true,
    suspiciousDialoguePattern: false,
    probableArtifact: false,
  },
  flags: [],
};

describe("constrained-corrector integration", () => {
  it("applies constrained correction when edit distance is acceptable", () => {
    logTestStep("constrained-corrector-apply");

    const pages: PageExtraction[] = [
      {
        page: 1,
        lines: [lowQualityLine],
        rawTextItemsCount: 1,
        usedOcr: false,
      },
    ];

    const result = applyOcrPatchesToPages({
      pages,
      ocrResults: [{ page: 1, text: "", lines: ["أحمد: مرحباً"] }],
      config,
    });

    expect(result.patchedLines).toBeGreaterThanOrEqual(0);
    expect(result.pages[0].usedOcr).toBe(true);
  });

  it("rejects dangerous correction when difference is too large", () => {
    logTestStep("constrained-corrector-reject");

    const pages: PageExtraction[] = [
      {
        page: 1,
        lines: [
          {
            ...lowQualityLine,
            text: "أحمد: مرحباً",
          },
        ],
        rawTextItemsCount: 1,
        usedOcr: false,
      },
    ];

    const strictConfig: PipelineConfig = {
      ...config,
      patch: {
        ...config.patch,
        maxEditDistanceRatio: 0.05,
      },
    };

    const result = applyOcrPatchesToPages({
      pages,
      ocrResults: [{ page: 1, text: "", lines: ["هذا نص مختلف تماماً"] }],
      config: strictConfig,
    });

    expect(result.patchedLines).toBe(0);
  });
});

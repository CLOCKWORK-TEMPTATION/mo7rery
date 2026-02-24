import type { PipelineConfig } from "./types.js";

export const defaultConfig: PipelineConfig = {
  lineMerge: {
    yTolerance: 2.5,
    xGapMergeThreshold: 22,
    minSpaceInsertGap: 5,
  },
  quality: {
    suspiciousThreshold: 0.62,
    weirdCharRatioThreshold: 0.12,
    minArabicRatioForArabicDocs: 0.15,
  },
  ocr: {
    enabled: true,
    provider:
      (process.env.OCR_PROVIDER as "mistral" | "azure" | "none") || "mistral",
    maxPagesPerBatch: 8,
  },
  patch: {
    maxEditDistanceRatio: 0.45,
    requireSameLineCountWindow: false,
    windowSize: 2,
  },
  domain: {
    screenplayArabicMode: true,
  },
};

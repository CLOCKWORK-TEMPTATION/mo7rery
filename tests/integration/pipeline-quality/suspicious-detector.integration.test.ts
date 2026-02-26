import { describe, expect, it } from "vitest";
import {
  countSuspiciousLines,
  getSuspiciousPages,
} from "../../../src/pipeline/quality/suspicious-detector";
import type { PageExtraction } from "../../../src/pipeline/types";
import { logTestStep } from "../../config/test-logger";

const createPage = (page: number, scores: number[]): PageExtraction => ({
  page,
  width: 0,
  height: 0,
  rawTextItemsCount: scores.length,
  usedOcr: false,
  lines: scores.map((score, index) => ({
    id: `${page}-${index}`,
    page,
    lineNoOnPage: index,
    text: `line-${index}`,
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
  })),
});

describe("suspicious-detector integration", () => {
  it("detects pages with broken OCR-like line quality", () => {
    logTestStep("suspicious-detector-broken");

    const pages = [
      createPage(1, [0.3, 0.4, 0.9, 0.8]),
      createPage(2, [0.95, 0.92]),
    ];
    const suspiciousPages = getSuspiciousPages(pages, 0.62);

    expect(suspiciousPages).toContain(1);
    expect(suspiciousPages).not.toContain(2);
  });

  it("avoids false positives on clean Arabic pages", () => {
    logTestStep("suspicious-detector-clean");

    const pages = [
      createPage(1, [0.9, 0.91, 0.88]),
      createPage(2, [0.93, 0.94]),
    ];
    const suspiciousPages = getSuspiciousPages(pages, 0.62);

    expect(suspiciousPages).toEqual([]);
    expect(countSuspiciousLines(pages, 0.62)).toBe(0);
  });
});

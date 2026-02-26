import { describe, expect, it } from "vitest";
import {
  fuseSuspiciousSignals,
  selectOcrFallbackTargets,
} from "../../../src/pipeline/quality/suspicion-fusion";
import type { ClassifiedLine } from "../../../src/extensions/classification-types";
import type { PipelineLineRef } from "../../../src/pipeline/quality/raw-screenplay-validator";
import { logTestStep } from "../../config/test-logger";

describe("suspicion-fusion integration", () => {
  it("combines raw and classification suspicion signals into fused score", () => {
    logTestStep("suspicion-fusion-combine");

    const lines: PipelineLineRef[] = [
      {
        lineIndex: 0,
        text: "أحمد: لا تقترب ثم يرفع السكين ويتجه نحوه بسرعة",
        pageIndex: 1,
        pageLineIndex: 0,
      },
    ];

    const classifiedLines: ClassifiedLine[] = [
      {
        lineIndex: 0,
        text: lines[0].text,
        assignedType: "dialogue",
        originalConfidence: 55,
        classificationMethod: "context",
      },
    ];

    const fused = fuseSuspiciousSignals(lines, classifiedLines, {
      rawThreshold: 20,
      fusedThresholdForOcrFallback: 40,
      classificationOnlyThreshold: 50,
    });

    expect(fused.length).toBeGreaterThan(0);
    expect(fused[0].fusedScore).toBeGreaterThan(0);
    expect(fused[0].reasons.length).toBeGreaterThan(0);
  });

  it("marks lines above threshold as OCR fallback targets", () => {
    logTestStep("suspicion-fusion-threshold");

    const lines: PipelineLineRef[] = [
      {
        lineIndex: 1,
        text: "□□□□� @@@ ###",
        pageIndex: 1,
        pageLineIndex: 1,
      },
    ];

    const classifiedLines: ClassifiedLine[] = [
      {
        lineIndex: 1,
        text: lines[0].text,
        assignedType: "dialogue",
        originalConfidence: 40,
        classificationMethod: "fallback",
      },
    ];

    const fused = fuseSuspiciousSignals(lines, classifiedLines, {
      rawThreshold: 10,
      fusedThresholdForOcrFallback: 30,
    });

    const targets = selectOcrFallbackTargets(fused);
    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets[0].routingBand).toBe("ocr-fallback");
  });
});

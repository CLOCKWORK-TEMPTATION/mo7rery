import { describe, expect, it } from "vitest";
import { PostClassificationReviewer } from "../../../src/extensions/classification-core";
import type { ClassifiedLine } from "../../../src/extensions/classification-types";

const buildLine = (
  overrides: Partial<ClassifiedLine>
): ClassifiedLine => ({
  lineIndex: 0,
  text: "ثم يخرج ورقة مكتوب عليها عنوان",
  assignedType: "dialogue",
  originalConfidence: 92,
  classificationMethod: "regex",
  ...overrides,
});

describe("classification-core source hints", () => {
  it("raises strong suspicion when pdf-open type mismatches source hint", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      buildLine({
        sourceProfile: "pdf-open",
        sourceHintType: "action",
      }),
    ]);

    expect(packet.totalSuspicious).toBe(1);
    const suspicious = packet.suspiciousLines[0];
    expect(
      suspicious.findings.some((finding) => finding.detectorId === "source-hint-mismatch")
    ).toBe(true);
    expect(suspicious.criticalMismatch).toBe(true);
    expect(["agent-candidate", "agent-forced"]).toContain(suspicious.routingBand);
  });

  it("does not trigger source-hint detector outside pdf-open profile", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      buildLine({
        sourceProfile: "generic-open",
        sourceHintType: "action",
      }),
    ]);

    expect(
      packet.suspiciousLines.some((suspicious) =>
        suspicious.findings.some(
          (finding) => finding.detectorId === "source-hint-mismatch"
        )
      )
    ).toBe(false);
  });
});

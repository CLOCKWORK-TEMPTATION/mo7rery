import { describe, expect, it } from "vitest";
import {
  collectRepeatedHeaderFooterCandidates,
  validateRawScreenplayLines,
} from "../../../src/pipeline/quality/raw-screenplay-validator";
import { logTestStep } from "../../config/test-logger";

describe("raw-screenplay-validator integration", () => {
  it("detects suspicious artifacts in noisy screenplay lines", () => {
    logTestStep("raw-validator-noisy");

    const result = validateRawScreenplayLines(
      ["1", "COPYRIGHT 2025", "أ ح م د : ل ا", "أحمد: لا تقترب ثم يرفع السكين"],
      {
        pdfMode: true,
        suspiciousThreshold: 20,
      }
    );

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.suspiciousLineIndexes.length).toBeGreaterThan(0);
  });

  it("collects repeated header/footer candidates", () => {
    logTestStep("raw-validator-header-footer");

    const repeated = collectRepeatedHeaderFooterCandidates(
      ["عنوان ثابت", "عنوان ثابت", "سطر عادي"],
      2
    );

    expect(repeated).toContain("عنوان ثابت");
  });
});

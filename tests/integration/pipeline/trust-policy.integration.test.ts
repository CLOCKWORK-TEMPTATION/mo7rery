import { describe, expect, it } from "vitest";
import {
  assessTrustLevel,
  resolveImportAction,
} from "../../../src/pipeline/trust-policy";
import { logTestStep } from "../../config/test-logger";

describe("trust-policy integration", () => {
  it("returns trusted_structured only when strict conditions are met", () => {
    logTestStep("trust-policy-trusted");

    const assessment = assessTrustLevel({
      blocks: [
        { type: "action", text: "يدخل أحمد الغرفة" },
        { type: "dialogue", text: "مرحباً" },
      ],
      source: "internal",
      systemGenerated: true,
      integrityChecked: true,
    });

    expect(assessment.level).toBe("trusted_structured");
    expect(resolveImportAction(assessment.level)).toBe(
      "direct_import_with_bg_check"
    );
  });

  it("falls back to classifier on semi structured and raw text", () => {
    logTestStep("trust-policy-fallback");

    const semi = assessTrustLevel({
      blocks: [{ type: "action", text: "نص" }],
      source: "external",
      systemGenerated: false,
    });

    const raw = assessTrustLevel({
      blocks: [{ type: "invalid", text: "نص" }],
    });

    expect(resolveImportAction(semi.level)).toBe("fallback_to_classifier");
    expect(resolveImportAction(raw.level)).toBe("fallback_to_classifier");
  });
});

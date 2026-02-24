import { describe, it, expect } from "vitest";
import {
  validateArabicScreenplayLine,
  applyScreenplayValidation,
} from "../../../src/pipeline/domain/arabic-screenplay-validator";
import type { ExtractedLine } from "../../../src/pipeline/types";

describe("arabic-screenplay-validator", () => {
  describe("validateArabicScreenplayLine", () => {
    it("should return no flags for empty input", () => {
      const line: ExtractedLine = createMockLine("");
      expect(validateArabicScreenplayLine(line)).toEqual([]);
    });

    it("should flag page numbers as artifacts", () => {
      const line: ExtractedLine = createMockLine("123");
      expect(validateArabicScreenplayLine(line)).toContain(
        "screenplay_artifact_page_number"
      );
    });

    it("should flag incomplete dialogue", () => {
      const line: ExtractedLine = createMockLine("أحمد :");
      expect(validateArabicScreenplayLine(line)).toContain(
        "screenplay_incomplete_dialogue"
      );

      const line2: ExtractedLine = createMockLine("سارة ： ");
      expect(validateArabicScreenplayLine(line2)).toContain(
        "screenplay_incomplete_dialogue"
      );
    });

    it("should flag possible merged scene and dialogue", () => {
      // Create a long string > 140 chars with scene hint and colon
      const longText = "داخلي - نهار - " + "أحمد : " + "أ".repeat(130);
      const line: ExtractedLine = createMockLine(longText);
      expect(validateArabicScreenplayLine(line)).toContain(
        "possible_merged_scene_and_dialogue"
      );
    });

    it("should flag possible dialogue and action merge", () => {
      const line: ExtractedLine = createMockLine("أحمد : يدخل الغرفة");
      expect(validateArabicScreenplayLine(line)).toContain(
        "possible_dialogue_action_merge"
      );

      const line2: ExtractedLine = createMockLine("ليلى : تجلس على الكرسي");
      expect(validateArabicScreenplayLine(line2)).toContain(
        "possible_dialogue_action_merge"
      );
    });

    it("should flag very short unclassified lines", () => {
      const line: ExtractedLine = createMockLine("أ");
      expect(validateArabicScreenplayLine(line)).toContain(
        "too_short_unclassified"
      );

      const line2: ExtractedLine = createMockLine("ب ");
      expect(validateArabicScreenplayLine(line2)).toContain(
        "too_short_unclassified"
      );
    });

    it("should not flag valid transitions even if short", () => {
      const line: ExtractedLine = createMockLine("قطع");
      expect(validateArabicScreenplayLine(line)).not.toContain(
        "too_short_unclassified"
      );
    });

    it("should not flag normal dialogue", () => {
      const line: ExtractedLine = createMockLine("أحمد : كيف حالك؟");
      expect(validateArabicScreenplayLine(line)).toEqual([]);
    });

    it("should not flag normal scene headers", () => {
      const line: ExtractedLine = createMockLine("داخلي - نهار");
      expect(validateArabicScreenplayLine(line)).toEqual([]);
    });
  });

  describe("applyScreenplayValidation", () => {
    it("should apply flags and update quality for suspicious lines", () => {
      const lines: ExtractedLine[] = [
        createMockLine("123"),
        createMockLine("أحمد : كيف حالك؟"),
        createMockLine("أ"),
      ];

      const result = applyScreenplayValidation(lines);

      expect(result[0].flags).toContain("screenplay_artifact_page_number");
      expect(result[0].flags).toContain("suspicious");
      expect(result[0].quality.score).toBeLessThanOrEqual(0.6);
      expect(result[0].quality.reasons).toContain(
        "screenplay_artifact_page_number"
      );

      expect(result[1].flags).toEqual([]);
      expect(result[1].quality.score).toBe(1.0);

      expect(result[2].flags).toContain("too_short_unclassified");
      expect(result[2].flags).toContain("suspicious");
      expect(result[2].quality.score).toBeLessThanOrEqual(0.6);
    });

    it("should not duplicate flags if already present", () => {
      const line = createMockLine("123");
      line.flags.push("screenplay_artifact_page_number");

      const result = applyScreenplayValidation([line]);

      const count = result[0].flags.filter(
        (f) => f === "screenplay_artifact_page_number"
      ).length;
      expect(count).toBe(1);
    });

    it("should apply multiple flags if applicable", () => {
      // Short line that is also a page number (not very likely but possible for test)
      const line = createMockLine("1");
      const result = applyScreenplayValidation([line]);

      expect(result[0].flags).toContain("screenplay_artifact_page_number");
      expect(result[0].flags).toContain("too_short_unclassified");
      expect(result[0].quality.reasons).toContain(
        "screenplay_artifact_page_number"
      );
      expect(result[0].quality.reasons).toContain("too_short_unclassified");
    });
  });
});

function createMockLine(text: string): ExtractedLine {
  return {
    id: "test-id",
    page: 1,
    lineNoOnPage: 1,
    text,
    source: "text-layer",
    flags: [],
    quality: {
      score: 1.0,
      reasons: [],
      weirdCharRatio: 0,
      arabicRatio: 1.0,
      digitRatio: 0,
      punctuationRatio: 0,
      hasBrokenArabicPattern: false,
      suspiciousDialoguePattern: false,
      probableArtifact: false,
    },
  };
}

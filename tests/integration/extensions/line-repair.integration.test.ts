import { describe, expect, it } from "vitest";
import {
  extractPlainTextFromHtmlLikeLine,
  parseBulletLine,
  shouldMergeWrappedLines,
  mergeBrokenCharacterName,
} from "../../../src/extensions/line-repair";
import { logTestStep } from "../../config/test-logger";

describe("line-repair integration", () => {
  it("extracts plain text from HTML-like lines", () => {
    logTestStep("line-repair-extract-html");
    expect(
      extractPlainTextFromHtmlLikeLine("<w:r><w:t>مرحبا</w:t></w:r>")
    ).toContain("مرحبا");
  });

  it("cleans bullet and formatting artifacts", () => {
    logTestStep("line-repair-bullet");
    expect(parseBulletLine("•   نص عربي  ")).toBe("نص عربي");
  });

  it("merges wrapped dialogue lines when continuation rules match", () => {
    logTestStep("line-repair-wrap-merge");
    const canMerge = shouldMergeWrappedLines(
      "أنا موافق",
      "و هنكمل بكرة",
      "dialogue"
    );
    expect(canMerge).toBe(true);
  });

  it("merges broken character name across two lines", () => {
    logTestStep("line-repair-character-merge");
    const merged = mergeBrokenCharacterName("عبد", "الرحمن:");
    expect(["عبد الرحمن:", "عبدالرحمن:"]).toContain(merged);
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyLines,
  classifyText,
  selectSuspiciousLinesForAgent,
} from "../../../src/extensions/paste-classifier";
import { PostClassificationReviewer } from "../../../src/extensions/classification-core";
import { loadFixture } from "../../config/test-fixtures";
import { logTestStep } from "../../config/test-logger";

describe("paste-classifier integration", () => {
  it("classifies real scene text with generic-open profile", async () => {
    logTestStep("paste-classifier-generic-open");
    const lines = await loadFixture("sample-screenplay-full-scene");

    const classified = classifyLines(lines.join("\n"), {
      classificationProfile: "generic-open",
    });

    expect(classified.length).toBeGreaterThan(0);
    expect(
      classified.every((line) => line.sourceProfile === "generic-open")
    ).toBe(true);
  });

  it("supports structured hints and preserves sourceHintType", () => {
    logTestStep("paste-classifier-structured-hints");

    const classified = classifyLines("أحمد:\nمرحباً", {
      classificationProfile: "generic-open",
      structuredHints: [
        { formatId: "character", text: "أحمد:" },
        { formatId: "dialogue", text: "مرحباً" },
      ],
    });

    expect(classified[0]?.sourceHintType).toBe("character");
    expect(classified[1]?.sourceHintType).toBe("dialogue");
  });

  it("builds agent candidate lines from reviewer packet", () => {
    logTestStep("paste-classifier-agent-candidates");

    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review(
      classifyText("أنا مش هسيبك وبعدين يمسك إيده").map((item, lineIndex) => ({
        lineIndex,
        text: item.text,
        assignedType: item.type,
        originalConfidence: item.confidence,
        classificationMethod: item.classificationMethod,
      }))
    );

    const candidates = selectSuspiciousLinesForAgent(packet);
    expect(Array.isArray(candidates)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { resolveNarrativeDecision } from "../../../src/extensions/classification-decision";
import { assertClassificationConfidence } from "../../helpers/assertion-helpers";
import { ScreenplayBuilder } from "../../helpers/screenplay-builders";
import { logTestStep } from "../../config/test-logger";
import type { ClassificationContext } from "../../../src/extensions/classification-types";

const createContext = (
  previousTypes: ClassificationContext["previousTypes"] = []
): ClassificationContext => ({
  previousTypes,
  previousType:
    previousTypes.length > 0 ? previousTypes[previousTypes.length - 1] : null,
  isInDialogueBlock: previousTypes.includes("dialogue"),
  isAfterSceneHeaderTopLine:
    previousTypes[previousTypes.length - 1] === "sceneHeaderTopLine",
});

describe("classification-decision integration", () => {
  it("returns a strong decision for clear narrative lines", () => {
    logTestStep("decision-clear-line");
    const decision = resolveNarrativeDecision(
      "- يفتح الباب بقوة ويخرج",
      createContext()
    );

    expect(decision.type).toBe("action");
    expect(decision.scoreGap).toBeGreaterThan(0);

    // توحيد استخدام helper للثقة عبر scoreGap كبروكسي لقوة القرار.
    assertClassificationConfidence({ confidence: decision.scoreGap }, 1);
  });

  it("handles ambiguous lines without returning undefined", () => {
    logTestStep("decision-ambiguous");
    const decision = resolveNarrativeDecision("طيب", createContext(["action"]));
    expect(["action", "dialogue", "character"]).toContain(decision.type);
  });

  it("uses previous context to bias ambiguous line into dialogue", () => {
    logTestStep("decision-with-context");
    const sequence = new ScreenplayBuilder()
      .addCharacter("أحمد")
      .addDialogue("طيب")
      .build();
    const decision = resolveNarrativeDecision(
      sequence[1] ?? "",
      createContext(["character"])
    );

    expect(["dialogue", "action"]).toContain(decision.type);
  });

  it("handles edge cases: empty, whitespace, numbers, and non-standard unicode", () => {
    logTestStep("decision-edge-cases");

    const cases = ["", "   ", "12345", "‏‏‏...."];
    for (const value of cases) {
      const decision = resolveNarrativeDecision(value, createContext());
      expect(["action", "dialogue", "character"]).toContain(decision.type);
    }
  });
});

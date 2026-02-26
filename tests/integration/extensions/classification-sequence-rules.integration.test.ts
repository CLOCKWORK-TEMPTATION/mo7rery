import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_VALID_SEQUENCES,
  suggestTypeFromClassificationSequence,
} from "../../../src/extensions/classification-sequence-rules";
import { classifyText } from "../../../src/extensions/paste-classifier";
import { assertSequenceValid } from "../../helpers/assertion-helpers";
import { ScreenplayBuilder } from "../../helpers/screenplay-builders";
import { loadFixture } from "../../config/test-fixtures";
import { logTestStep } from "../../config/test-logger";

describe("classification-sequence-rules integration", () => {
  it("accepts valid screenplay sequences", () => {
    logTestStep("sequence-valid");
    const valid = new ScreenplayBuilder()
      .addSceneHeader("داخلي - مكتب - نهار")
      .addAction("يجلس على الكرسي")
      .addCharacter("أحمد")
      .addDialogue("أنا جاهز")
      .buildRaw();

    const classified = classifyText(valid).map((item, lineIndex) => ({
      lineIndex,
      text: item.text,
      assignedType: item.type,
      originalConfidence: item.confidence,
      classificationMethod: item.classificationMethod,
    }));

    assertSequenceValid(classified);
  });

  it("flags or suggests corrections for invalid sequences", () => {
    logTestStep("sequence-invalid");

    const dialogueWithoutCharacter = suggestTypeFromClassificationSequence(
      "action",
      {
        isParenthetical: false,
        endsWithColon: false,
        wordCount: 4,
        hasPunctuation: true,
        startsWithDash: false,
        hasActionIndicators: false,
      }
    );

    expect(
      dialogueWithoutCharacter === null ||
        dialogueWithoutCharacter === "character"
    ).toBe(true);

    const parentheticalWithoutCharacter = suggestTypeFromClassificationSequence(
      "action",
      {
        isParenthetical: true,
        endsWithColon: false,
        wordCount: 2,
        hasPunctuation: false,
        startsWithDash: false,
        hasActionIndicators: false,
      }
    );

    expect(
      parentheticalWithoutCharacter === null ||
        parentheticalWithoutCharacter === "character"
    ).toBe(true);

    const transitionAfterCharacterAllowed =
      CLASSIFICATION_VALID_SEQUENCES.get("character")?.has("transition") ??
      false;
    expect(transitionAfterCharacterAllowed).toBe(false);
  });

  it("accepts edge but valid transitions", () => {
    logTestStep("sequence-edge-valid");

    expect(CLASSIFICATION_VALID_SEQUENCES.get("action")?.has("action")).toBe(
      true
    );
    expect(
      CLASSIFICATION_VALID_SEQUENCES.get("transition")?.has("scene-header-1")
    ).toBe(true);
    expect(
      CLASSIFICATION_VALID_SEQUENCES.get("dialogue")?.has("character")
    ).toBe(true);
  });

  it("validates full-scene fixture sequence", async () => {
    logTestStep("sequence-fixture-full-scene");
    const lines = await loadFixture("sample-screenplay-full-scene");
    const classified = classifyText(lines.join("\n")).map(
      (item, lineIndex) => ({
        lineIndex,
        text: item.text,
        assignedType: item.type,
        originalConfidence: item.confidence,
        classificationMethod: item.classificationMethod,
      })
    );

    assertSequenceValid(classified);
  });
});

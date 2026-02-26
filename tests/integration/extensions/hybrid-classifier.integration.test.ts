import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { classifyText } from "../../../src/extensions/paste-classifier";
import {
  assertAllLinesClassified,
  assertSequenceValid,
} from "../../helpers/assertion-helpers";
import { loadFixture } from "../../config/test-fixtures";
import { logTestSuiteEnd, logTestStep } from "../../config/test-logger";
import type { ElementType } from "../../../src/extensions/classification-types";

const computeAccuracy = (
  actual: ElementType[],
  expected: Record<number, ElementType>
): number => {
  const total = Object.keys(expected).length;
  if (total === 0) return 1;

  let correct = 0;
  for (const [lineIndex, expectedType] of Object.entries(expected)) {
    const index = Number(lineIndex);
    if (actual[index] === expectedType) {
      correct += 1;
    }
  }

  return correct / total;
};

describe("hybrid-classifier integration", () => {
  it("classifies full scene with acceptable accuracy", async () => {
    const started = performance.now();
    logTestStep("hybrid-full-scene");

    const lines = await loadFixture("sample-screenplay-full-scene");
    const classified = classifyText(lines.join("\n"));

    assertAllLinesClassified(classified);
    assertSequenceValid(
      classified.map((line, index) => ({
        lineIndex: index,
        text: line.text,
        assignedType: line.type,
        originalConfidence: line.confidence,
        classificationMethod: line.classificationMethod,
      }))
    );

    const expectedClassifications: Record<number, ElementType> = {
      0: "sceneHeaderTopLine",
      1: "action",
      2: "character",
      3: "parenthetical",
      4: "dialogue",
      5: "character",
      6: "dialogue",
      7: "transition",
      8: "sceneHeaderTopLine",
      9: "action",
    };

    const accuracy = computeAccuracy(
      classified.map((entry) => entry.type),
      expectedClassifications
    );

    expect(accuracy).toBeGreaterThanOrEqual(0.6);

    logTestSuiteEnd(
      "hybrid-full-scene",
      1,
      0,
      Math.round(performance.now() - started)
    );
  });

  it("classifies mixed screenplay fixture without undefined results", async () => {
    const lines = await loadFixture("sample-screenplay-mixed");
    const classified = classifyText(lines.join("\n"));

    assertAllLinesClassified(classified);
    expect(classified.length).toBeGreaterThan(0);
  });

  it("classifies pure action fixture as action-dominant", async () => {
    const lines = await loadFixture("sample-screenplay-action");
    const classified = classifyText(lines.join("\n"));

    const actionRatio =
      classified.filter((line) => line.type === "action").length /
      Math.max(1, classified.length);
    expect(actionRatio).toBeGreaterThanOrEqual(0.8);
  });

  it("classifies pure dialogue fixture as dialogue exchange", async () => {
    const lines = await loadFixture("sample-screenplay-dialogue");
    const classified = classifyText(lines.join("\n"));

    const hasCharacter = classified.some((line) => line.type === "character");
    const hasDialogue = classified.some((line) => line.type === "dialogue");

    expect(hasCharacter).toBe(true);
    expect(hasDialogue).toBe(true);
  });

  it("handles dirty input gracefully without throwing", async () => {
    const lines = await loadFixture("sample-dirty-input");

    expect(() => classifyText(lines.join("\n"))).not.toThrow();
  });
});

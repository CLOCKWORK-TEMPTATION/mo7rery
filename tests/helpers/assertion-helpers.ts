import { expect } from "vitest";
import type {
  ClassifiedLine,
  ElementType,
} from "../../src/extensions/classification-types";

export type ClassificationResult =
  | ClassifiedLine
  | {
      type?: ElementType;
      assignedType?: ElementType;
      confidence?: number;
      originalConfidence?: number;
    };

export type LineType = ElementType;

const readType = (result: ClassificationResult): ElementType | undefined =>
  (result as { assignedType?: ElementType }).assignedType ??
  (result as { type?: ElementType }).type;

const readConfidence = (result: ClassificationResult): number | undefined =>
  (result as { originalConfidence?: number }).originalConfidence ??
  (result as { confidence?: number }).confidence;

export const assertClassificationType = (
  result: ClassificationResult,
  expected: LineType
): void => {
  expect(readType(result)).toBe(expected);
};

export const assertClassificationConfidence = (
  result: ClassificationResult,
  minConfidence: number
): void => {
  expect(readConfidence(result)).toBeGreaterThanOrEqual(minConfidence);
};

export const assertAllLinesClassified = (
  results: ClassificationResult[]
): void => {
  results.forEach((result, index) => {
    expect(readType(result), `line ${index} must be classified`).toBeTruthy();
  });
};

export const assertSequenceValid = (results: ClassificationResult[]): void => {
  for (let index = 0; index < results.length; index += 1) {
    const current = readType(results[index]);
    const previous = index > 0 ? readType(results[index - 1]) : undefined;

    if (current === "parenthetical") {
      expect(["character", "dialogue"].includes(previous ?? "")).toBe(true);
    }

    if (current === "dialogue") {
      expect(
        ["character", "dialogue", "parenthetical"].includes(previous ?? "")
      ).toBe(true);
    }
  }
};

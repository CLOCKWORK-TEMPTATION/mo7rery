import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "../config/test-fixtures";
import { sanitizeInput } from "../../src/pipeline/input-sanitizer";
import {
  normalizeNewlines,
  finalRenderLineNormalize,
} from "../../src/pipeline/normalize";
import { classifyText } from "../../src/extensions/paste-classifier";
import { scoreLine } from "../../src/pipeline/quality/line-quality";
import {
  assertAllLinesClassified,
  assertSequenceValid,
} from "../helpers/assertion-helpers";
import { logTestSuiteEnd, logTestStep } from "../config/test-logger";

describe("smoke integration", () => {
  it("runs critical path: fixture -> sanitize -> normalize -> classify -> quality", async () => {
    const started = performance.now();
    logTestStep("smoke-load-fixture");

    const raw = await loadRawFixture("sample-screenplay-full-scene");

    logTestStep("smoke-sanitize");
    const sanitized = sanitizeInput(raw).text;

    logTestStep("smoke-normalize");
    const normalized = normalizeNewlines(sanitized)
      .split(/\r?\n/)
      .map((line) => finalRenderLineNormalize(line))
      .join("\n");

    logTestStep("smoke-classify");
    const classified = classifyText(normalized);
    assertAllLinesClassified(classified);

    assertSequenceValid(
      classified.map((line, lineIndex) => ({
        lineIndex,
        text: line.text,
        assignedType: line.type,
        originalConfidence: line.confidence,
        classificationMethod: line.classificationMethod,
      }))
    );

    logTestStep("smoke-quality");
    const qualityScores = classified.map((line) => scoreLine(line.text).score);
    const averageQuality =
      qualityScores.reduce((sum, value) => sum + value, 0) /
      Math.max(1, qualityScores.length);

    expect(averageQuality).toBeGreaterThan(0.6);

    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(10_000);

    logTestSuiteEnd("smoke-integration", 1, 0, Math.round(elapsed));
  });
});

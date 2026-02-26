import { describe, expect, it } from "vitest";
import {
  runSanitizedImportPipeline,
  shouldUseSanitizedPipeline,
} from "../../../src/pipeline/sanitized-import-pipeline";
import { loadRawFixture } from "../../config/test-fixtures";
import { logTestStep } from "../../config/test-logger";

describe("sanitized-import-pipeline integration", () => {
  it("routes dirty inputs to sanitized pipeline and cleans them", async () => {
    logTestStep("sanitized-pipeline-dirty");
    const input = await loadRawFixture("sample-dirty-input");

    expect(shouldUseSanitizedPipeline(input)).toBe(true);

    const result = runSanitizedImportPipeline(input);
    expect(result.wasModified).toBe(true);
    expect(result.cleanText).not.toContain("[pStyle=");
  });

  it("keeps clean text unchanged", async () => {
    logTestStep("sanitized-pipeline-clean");
    const input = await loadRawFixture("sample-screenplay-action");

    const result = runSanitizedImportPipeline(input);
    expect(result.cleanText.trim()).toBe(input.trim());
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createScreenplayEditor } from "../../../src/editor";
import { runTextIngestionPipeline } from "../../../src/pipeline/ingestion-orchestrator";
import { loadRawFixture } from "../../config/test-fixtures";
import { assertAllLinesClassified } from "../../helpers/assertion-helpers";
import { classifyText } from "../../../src/extensions/paste-classifier";
import { logTestStep } from "../../config/test-logger";

describe("ingestion-orchestrator integration", () => {
  it("processes full screenplay text through raw-text ingestion path", async () => {
    logTestStep("ingestion-full-scene");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createScreenplayEditor(mount);

    const input = await loadRawFixture("sample-screenplay-full-scene");
    const result = await runTextIngestionPipeline(editor.view, input, {
      source: "import",
    });

    expect(result.success).toBe(true);
    expect(result.itemsProcessed).toBeGreaterThan(0);

    const classified = classifyText(input);
    assertAllLinesClassified(classified);

    editor.destroy();
    mount.remove();
  });

  it("handles dirty text without throwing and keeps output clean", async () => {
    logTestStep("ingestion-dirty-input");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createScreenplayEditor(mount);

    const input = await loadRawFixture("sample-dirty-input");
    const result = await runTextIngestionPipeline(editor.view, input, {
      source: "import",
    });

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);

    editor.destroy();
    mount.remove();
  });

  it("returns empty classification pipeline result for empty text", async () => {
    logTestStep("ingestion-empty");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createScreenplayEditor(mount);

    const result = await runTextIngestionPipeline(editor.view, "", {
      source: "import",
    });

    expect(result.success).toBe(true);
    expect(result.itemsProcessed).toBe(0);

    editor.destroy();
    mount.remove();
  });

  it("finishes critical scene ingestion in less than five seconds", async () => {
    logTestStep("ingestion-performance");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createScreenplayEditor(mount);
    const input = await loadRawFixture("sample-screenplay-full-scene");

    const started = performance.now();
    await runTextIngestionPipeline(editor.view, input, { source: "import" });
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(5_000);

    editor.destroy();
    mount.remove();
  });
});

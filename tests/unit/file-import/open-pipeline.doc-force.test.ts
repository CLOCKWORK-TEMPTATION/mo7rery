import { describe, expect, it } from "vitest";
import { buildFileOpenPipelineAction } from "../../../src/utils/file-import";
import type { FileExtractionResult } from "../../../src/types/file-import";

describe("open pipeline doc force path", () => {
  it("forces doc structured extraction into classified-text path", () => {
    const extraction: FileExtractionResult = {
      text: "سطر أكشن",
      fileType: "doc",
      method: "doc-converter-flow",
      usedOcr: false,
      warnings: [],
      attempts: ["doc-converter-flow"],
      structuredBlocks: [{ formatId: "action", text: "سطر أكشن" }],
    };

    const action = buildFileOpenPipelineAction(extraction, "replace");
    expect(action.kind).toBe("import-classified-text");
  });
});

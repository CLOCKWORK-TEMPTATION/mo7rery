import { describe, expect, it } from "vitest";
import { buildFileOpenPipelineAction } from "../../../src/utils/file-import";
import type { FileExtractionResult } from "../../../src/types/file-import";

describe("open pipeline pdf force path", () => {
  it("forces pdf structured extraction into classified-text path", () => {
    const extraction: FileExtractionResult = {
      text: "سطر أكشن",
      fileType: "pdf",
      method: "ocr-mistral",
      usedOcr: true,
      warnings: [],
      attempts: ["pdf-converter-flow"],
      structuredBlocks: [{ formatId: "action", text: "سطر أكشن" }],
    };

    const action = buildFileOpenPipelineAction(extraction, "replace");
    expect(action.kind).toBe("import-classified-text");
  });
});


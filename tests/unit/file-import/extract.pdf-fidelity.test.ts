import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileExtractionResult } from "../../../src/types/file-import";

const {
  extractFileWithBackendMock,
  isBackendExtractionConfiguredMock,
  isBrowserExtractionSupportedMock,
} = vi.hoisted(() => ({
  extractFileWithBackendMock: vi.fn(),
  isBackendExtractionConfiguredMock: vi.fn(),
  isBrowserExtractionSupportedMock: vi.fn(),
}));

vi.mock("../../../src/utils/file-import/extract/backend-extract", () => ({
  extractFileWithBackend: extractFileWithBackendMock,
  isBackendExtractionConfigured: isBackendExtractionConfiguredMock,
}));

vi.mock("../../../src/utils/file-import/extract/browser-extract", () => ({
  extractFileInBrowser: vi.fn(),
  isBrowserExtractionSupported: isBrowserExtractionSupportedMock,
}));

import { extractImportedFile } from "../../../src/utils/file-import/extract";

describe("extractImportedFile pdf raw fidelity", () => {
  beforeEach(() => {
    extractFileWithBackendMock.mockReset();
    isBackendExtractionConfiguredMock.mockReset();
    isBrowserExtractionSupportedMock.mockReset();
    isBackendExtractionConfiguredMock.mockReturnValue(true);
    isBrowserExtractionSupportedMock.mockReturnValue(false);
  });

  it("keeps pdf OCR text without preprocessing or synthetic structured blocks", async () => {
    const backendResult: FileExtractionResult = {
      text: "سطر\tأول\r\nسطر ثاني\r\rسطر ثالث",
      fileType: "pdf",
      method: "ocr-mistral",
      usedOcr: true,
      warnings: [],
      attempts: ["pdf-converter-flow"],
    };
    extractFileWithBackendMock.mockResolvedValue(backendResult);

    const file = new File(["pdf-binary"], "sample.pdf", {
      type: "application/pdf",
    });

    const result = await extractImportedFile(file, {
      endpoint: "http://127.0.0.1:8787/api/file-extract",
    });

    expect(result.text).toBe("سطر\tأول\nسطر ثاني\n\nسطر ثالث");
    expect(result.text.includes("\t")).toBe(true);
    expect(result.structuredBlocks).toBeUndefined();
    expect(result.normalizationApplied).toEqual([]);
    expect(result.attempts).toEqual(["pdf-converter-flow"]);
  });
});

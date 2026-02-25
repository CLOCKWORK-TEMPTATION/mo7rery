import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  isBackendExtractionConfigured: vi.fn<(endpoint?: string) => boolean>(),
  extractFileWithBackend: vi.fn(),
}));

vi.mock("../../../src/utils/file-import/extract/backend-extract", () => ({
  isBackendExtractionConfigured: doubles.isBackendExtractionConfigured,
  extractFileWithBackend: doubles.extractFileWithBackend,
}));

import { extractImportedFile } from "../../../src/utils/file-import/extract";

describe("extractImportedFile backend-only strict", () => {
  beforeEach(() => {
    doubles.isBackendExtractionConfigured.mockReset();
    doubles.extractFileWithBackend.mockReset();

    doubles.isBackendExtractionConfigured.mockReturnValue(true);
    doubles.extractFileWithBackend.mockImplementation(async (_file, fileType) => ({
      text: "سطر اختبار",
      fileType,
      method: "backend-api",
      usedOcr: false,
      warnings: [],
      attempts: ["backend-api"],
    }));
  });

  it("fails fast when backend endpoint is not configured", async () => {
    doubles.isBackendExtractionConfigured.mockReturnValue(false);
    const file = new File(["test"], "sample.txt", { type: "text/plain" });

    await expect(extractImportedFile(file)).rejects.toThrow(
      /Backend extraction endpoint غير مضبوط/
    );
    expect(doubles.extractFileWithBackend).not.toHaveBeenCalled();
  });

  it.each([
    ["sample.doc", "doc"],
    ["sample.docx", "docx"],
    ["sample.txt", "txt"],
    ["sample.fountain", "fountain"],
    ["sample.fdx", "fdx"],
  ] as const)(
    "routes %s through backend extraction only",
    async (filename, expectedType) => {
      const file = new File(["test"], filename, {
        type: "application/octet-stream",
      });

      const extraction = await extractImportedFile(file);

      expect(doubles.extractFileWithBackend).toHaveBeenCalledWith(
        file,
        expectedType,
        undefined
      );
      expect(extraction.fileType).toBe(expectedType);
    }
  );
});

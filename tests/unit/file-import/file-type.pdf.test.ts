import { describe, expect, it } from "vitest";
import { getFileType } from "../../../src/types/file-import";

describe("file-import type detection", () => {
  it("detects pdf extension", () => {
    expect(getFileType("sample.pdf")).toBe("pdf");
  });
});

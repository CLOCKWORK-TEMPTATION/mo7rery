import { describe, expect, it } from "vitest";
import { extractImportedFile } from "../../../src/utils/file-import/extract";

describe("extractImportedFile unsupported type", () => {
  it("rejects unsupported files in open pipeline", async () => {
    const file = new File(["binary"], "sample.png", {
      type: "image/png",
    });

    await expect(extractImportedFile(file)).rejects.toThrow(
      /نوع الملف غير مدعوم/
    );
  });
});

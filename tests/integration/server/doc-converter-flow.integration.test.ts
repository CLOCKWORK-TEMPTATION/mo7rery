import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { logTestStep } from "../../config/test-logger";

const docFixture = resolve(process.cwd(), "tests/fixtures/sample.doc");
const docxFixture = resolve(process.cwd(), "tests/fixtures/sample.docx");
const hasAntiwordRuntime = (): boolean => {
  const probe = spawnSync("antiword", ["-h"], {
    windowsHide: true,
    encoding: "utf-8",
  });
  return !(
    probe.error &&
    "code" in probe.error &&
    probe.error.code === "ENOENT"
  );
};

describe("doc-converter-flow integration", () => {
  it("converts .doc buffer to text when fixture is available", async () => {
    logTestStep("doc-converter-doc");
    if (!existsSync(docFixture) || !hasAntiwordRuntime()) {
      return;
    }

    const { convertDocBufferToText } =
      await import("../../../server/doc-converter-flow.mjs");
    const buffer = await readFile(docFixture);
    const result = await convertDocBufferToText(buffer, "sample.doc");

    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("keeps arabic text readable (no mojibake)", async () => {
    logTestStep("doc-converter-arabic");
    if (!existsSync(docFixture) || !hasAntiwordRuntime()) {
      return;
    }

    const { convertDocBufferToText } =
      await import("../../../server/doc-converter-flow.mjs");
    const buffer = await readFile(docFixture);
    const result = await convertDocBufferToText(buffer, "sample.doc");

    expect(result.text).not.toContain("Ø");
    expect(/[\u0600-\u06FF]/.test(result.text)).toBe(true);
  });

  it("fails gracefully for unsupported/missing-content buffers", async () => {
    logTestStep("doc-converter-missing-file");
    const { convertDocBufferToText } =
      await import("../../../server/doc-converter-flow.mjs");

    await expect(
      convertDocBufferToText(Buffer.from("not-a-doc"), "missing.doc")
    ).rejects.toBeInstanceOf(Error);
  });

  it("does not crash when passing docx fixture buffer", async () => {
    logTestStep("doc-converter-docx-buffer");
    if (!existsSync(docxFixture)) {
      return;
    }

    const { convertDocBufferToText } =
      await import("../../../server/doc-converter-flow.mjs");
    const buffer = await readFile(docxFixture);

    await expect(
      convertDocBufferToText(buffer, "sample.docx")
    ).rejects.toBeInstanceOf(Error);
  });
});

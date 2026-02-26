import { describe, expect, it } from "vitest";
import { stripOcrArtifactLines } from "../../../server/ocr-text-cleanup.mjs";

describe("ocr-text-cleanup", () => {
  it("removes separator/page marker lines and keeps screenplay content", () => {
    const source = [
      "============================================================",
      "الصفحة 1",
      "============================================================",
      "",
      "مشهد1\t\tنهار - داخلي",
      "شقة سيد نفيسة - الصالة",
      "",
      "============================================================",
      "الصفحة 2",
      "============================================================",
      "",
      "قطع",
      "مشهد2\t\tنهار - خارجي",
    ].join("\n");

    const cleaned = stripOcrArtifactLines(source);

    expect(cleaned.removedLines).toBeGreaterThanOrEqual(6);
    expect(cleaned.text).not.toContain("الصفحة 1");
    expect(cleaned.text).not.toContain(
      "================================================"
    );
    expect(cleaned.text).toContain("مشهد1");
    expect(cleaned.text).toContain("مشهد2");
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/extensions/line-repair", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../src/extensions/line-repair")>();
  return {
    ...actual,
    shouldMergeWrappedLines: vi.fn(() => true),
  };
});

import { classifyText } from "../../../src/extensions/paste-classifier";

describe("paste-classifier pdf-open profile", () => {
  it("skips wrapped-line merge branch in pdf-open profile", () => {
    const text = "سطر أول\nسطر ثاني";

    const pasteProfile = classifyText(text);
    const pdfOpenProfile = classifyText(text, undefined, {
      classificationProfile: "pdf-open",
    });

    expect(pasteProfile.length).toBe(1);
    expect(pdfOpenProfile.length).toBe(2);
  });

  it("propagates source profile and hint type on classified lines", () => {
    const text = "يرفع يده\nثم يخرج";

    const classified = classifyText(text, undefined, {
      classificationProfile: "pdf-open",
      structuredHints: [{ formatId: "action", text }],
    });

    expect(classified.length).toBeGreaterThan(0);
    expect(classified.every((line) => line.sourceProfile === "pdf-open")).toBe(
      true
    );
    expect(classified.some((line) => line.sourceHintType === "action")).toBe(
      true
    );
  });
});

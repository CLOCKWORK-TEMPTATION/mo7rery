import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/extensions/line-repair", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../src/extensions/line-repair")
    >();
  return {
    ...actual,
    shouldMergeWrappedLines: vi.fn(() => true),
  };
});

import { classifyText } from "../../../src/extensions/paste-classifier";

describe("paste-classifier source profile", () => {
  it("propagates generic-open source profile and hint type on classified lines", () => {
    const text = "يرفع يده\nثم يخرج";

    const classified = classifyText(text, undefined, {
      classificationProfile: "generic-open",
      structuredHints: [{ formatId: "action", text }],
    });

    expect(classified.length).toBeGreaterThan(0);
    expect(
      classified.every((line) => line.sourceProfile === "generic-open")
    ).toBe(true);
    expect(classified.some((line) => line.sourceHintType === "action")).toBe(
      true
    );
  });
});

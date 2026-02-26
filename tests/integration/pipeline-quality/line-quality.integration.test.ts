import { describe, expect, it } from "vitest";
import { scoreLine } from "../../../src/pipeline/quality/line-quality";
import { logTestStep } from "../../config/test-logger";

describe("line-quality integration", () => {
  it("assigns high score to healthy screenplay lines", () => {
    logTestStep("line-quality-high");

    const sceneHeader = scoreLine("داخلي - شقة أحمد - ليل");
    const dialogue = scoreLine("أحمد: أنا جاهز");

    expect(sceneHeader.score).toBeGreaterThan(0.6);
    expect(dialogue.score).toBeGreaterThan(0.6);
  });

  it("assigns lower score to noisy or meaningless lines", () => {
    logTestStep("line-quality-low");

    const noisy = scoreLine("□□� ### @@");
    const mixed = scoreLine("abc123 !!! □□");

    expect(noisy.score).toBeLessThan(0.7);
    expect(mixed.score).toBeLessThan(1);
  });
});

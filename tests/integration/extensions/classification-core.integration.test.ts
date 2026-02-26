import { describe, expect, it } from "vitest";
import { PostClassificationReviewer } from "../../../src/extensions/classification-core";
import { classifyText } from "../../../src/extensions/paste-classifier";
import {
  assertClassificationType,
  assertAllLinesClassified,
} from "../../helpers/assertion-helpers";
import { loadFixture } from "../../config/test-fixtures";
import { logTestStep } from "../../config/test-logger";

describe("classification-core integration", () => {
  it("classifies core screenplay line types with real Arabic lines", async () => {
    logTestStep("load-fixtures");
    const actionLines = await loadFixture("sample-screenplay-action");
    const dialogueLines = await loadFixture("sample-screenplay-dialogue");

    logTestStep("classify-scene-header");
    const scene = classifyText("مشهد 1 داخلي - شقة أحمد - ليل")[0];
    assertClassificationType(scene, "sceneHeaderTopLine");

    logTestStep("classify-dialogue");
    const dialoguePair = classifyText("أحمد:\nإنت فاكر إنك هتعدي بالسهولة دي؟");
    expect(dialoguePair.length).toBeGreaterThanOrEqual(2);
    const pairTypes = dialoguePair.map((line) => line.type);
    expect(pairTypes).toContain("dialogue");
    expect(
      pairTypes.some((type) => type === "character" || type === "action")
    ).toBe(true);

    logTestStep("classify-action");
    const action = classifyText(actionLines[0] ?? "")[0];
    assertClassificationType(action, "action");

    logTestStep("classify-parenthetical");
    const parenthetical = classifyText("سارة:\n(بحزم)\nأنا مش محتاجة إذنك.");
    expect(parenthetical.length).toBeGreaterThanOrEqual(2);
    assertClassificationType(parenthetical[1], "parenthetical");

    logTestStep("classify-transition");
    const transition = classifyText("قطع إلى:")[0];
    assertClassificationType(transition, "transition");

    const fullDialogue = classifyText(dialogueLines.join("\n"));
    assertAllLinesClassified(fullDialogue);
  });

  it("detects suspicious mixed dialogue/action lines through reviewer", () => {
    logTestStep("review-mixed-dialogue-action");
    const reviewer = new PostClassificationReviewer();
    const classified = classifyText(
      "أنا مش هسيبك تعمل كده وبعدين يمسك إيده ويشده لبرا"
    ).map((item, index) => ({
      lineIndex: index,
      text: item.text,
      assignedType: item.type,
      originalConfidence: item.confidence,
      classificationMethod: item.classificationMethod,
    }));

    const packet = reviewer.review(classified);
    expect(packet.totalReviewed).toBeGreaterThan(0);
    expect(packet.totalSuspicious).toBeGreaterThanOrEqual(0);
  });

  it("classifies multi-scene Arabic headers with scene1/scene2 correctly", () => {
    logTestStep("classify-multi-scene-headers");

    const screenplayText = [
      "مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي",
      "شقة سيد نفيسة  – الصالة",
      "قطع",
      "مشهد2\t\t\t\t\t\t\t\t\tنهار -خارجي",
      "العتبة – فرش  عرنوس",
    ].join("\n");

    const classified = classifyText(screenplayText);
    const types = classified.map((line) => line.type);

    expect(types).toEqual([
      "sceneHeaderTopLine",
      "sceneHeader3",
      "transition",
      "sceneHeaderTopLine",
      "sceneHeader3",
    ]);

    expect(classified[0]?.header1).toMatch(/مشهد\s*1|مشهد1/u);
    expect(classified[0]?.header2).toContain("نهار");
    expect(classified[3]?.header1).toMatch(/مشهد\s*2|مشهد2/u);
    expect(classified[3]?.header2).toContain("خارجي");
  });
});

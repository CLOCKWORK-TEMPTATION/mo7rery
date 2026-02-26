import { describe, expect, it } from "vitest";
import { ContextMemoryManager } from "../../../src/extensions/context-memory-manager";
import { HybridClassifier } from "../../../src/extensions/hybrid-classifier";
import { ScreenplayBuilder } from "../../helpers/screenplay-builders";
import { logTestStep } from "../../config/test-logger";
import type { ClassificationContext } from "../../../src/extensions/classification-types";

const createContext = (
  previousTypes: ClassificationContext["previousTypes"] = []
): ClassificationContext => ({
  previousTypes,
  previousType:
    previousTypes.length > 0 ? previousTypes[previousTypes.length - 1] : null,
  isInDialogueBlock: previousTypes.includes("dialogue"),
  isAfterSceneHeaderTopLine:
    previousTypes[previousTypes.length - 1] === "sceneHeaderTopLine",
});

describe("context-memory-manager integration", () => {
  it("starts with empty memory snapshot", () => {
    logTestStep("memory-init");
    const manager = new ContextMemoryManager();
    const snapshot = manager.getSnapshot();

    expect(snapshot.recentTypes).toEqual([]);
    expect(snapshot.characterFrequency.size).toBe(0);
  });

  it("stores context after recording character lines", () => {
    logTestStep("memory-store-character");
    const manager = new ContextMemoryManager();

    manager.record({ type: "character", text: "أحمد:", confidence: 0.95 });
    const snapshot = manager.getSnapshot();

    expect(snapshot.characterFrequency.get("أحمد")).toBe(1);
    expect(snapshot.recentTypes.at(-1)).toBe("character");
  });

  it("tracks sequence metadata across multiple records", () => {
    logTestStep("memory-sequence");
    const manager = new ContextMemoryManager();
    const lines = new ScreenplayBuilder()
      .addSceneHeader("داخلي - مكتب - نهار")
      .addAction("يجلس على الكرسي")
      .addCharacter("أحمد")
      .addDialogue("ابدأ الآن")
      .addCharacter("سارة")
      .addDialogue("حاضر")
      .build();

    manager.record({
      type: "sceneHeaderTopLine",
      text: lines[0] ?? "",
      confidence: 0.9,
    });
    manager.record({ type: "action", text: lines[1] ?? "", confidence: 0.9 });
    manager.record({
      type: "character",
      text: lines[2] ?? "",
      confidence: 0.95,
    });
    manager.record({ type: "dialogue", text: lines[3] ?? "", confidence: 0.9 });
    manager.record({
      type: "character",
      text: lines[4] ?? "",
      confidence: 0.95,
    });
    manager.record({ type: "dialogue", text: lines[5] ?? "", confidence: 0.9 });

    const snapshot = manager.getSnapshot();
    expect(snapshot.recentTypes.length).toBe(6);
    expect(snapshot.recentTypes[0]).toBe("sceneHeaderTopLine");
    expect(snapshot.characterFrequency.get("سارة")).toBe(1);
  });

  it("resets memory state fully", () => {
    logTestStep("memory-reset");
    const manager = new ContextMemoryManager();
    manager.record({ type: "character", text: "أحمد:", confidence: 0.95 });

    manager.reset();
    const snapshot = manager.getSnapshot();

    expect(snapshot.characterFrequency.size).toBe(0);
    expect(snapshot.recentTypes).toEqual([]);
  });

  it("improves ambiguous classification when memory context exists", () => {
    logTestStep("memory-effect-on-hybrid");
    const manager = new ContextMemoryManager();
    const classifier = new HybridClassifier();

    manager.record({ type: "character", text: "أحمد:", confidence: 0.95 });
    const withMemory = classifier.classifyLine(
      "أحمد:",
      "character",
      createContext(["dialogue"]),
      manager.getSnapshot()
    );

    const emptyManager = new ContextMemoryManager();
    const withoutMemory = classifier.classifyLine(
      "أحمد:",
      "character",
      createContext(["dialogue"]),
      emptyManager.getSnapshot()
    );

    expect(withMemory.type).toBe("character");
    expect(withMemory.confidence).toBeGreaterThanOrEqual(
      withoutMemory.confidence
    );
  });
});

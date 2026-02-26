import { describe, expect, it } from "vitest";
import {
  applyCommandBatch,
  createImportOperationState,
  validateAndFilterCommands,
} from "../../../src/pipeline/command-engine";
import { buildItemSnapshots } from "../../../src/pipeline/fingerprint";
import { logTestStep } from "../../config/test-logger";

describe("command-engine integration", () => {
  it("applies relabel and split commands on real editor-item map", async () => {
    logTestStep("command-engine-apply-batch");

    const state = createImportOperationState("op-1", "import");
    const items = new Map([
      [
        "i1",
        {
          itemId: "i1",
          type: "action" as const,
          text: "أحمد: مرحباً يا صديقي",
        },
      ],
    ]);

    const snapshots = await buildItemSnapshots([
      { itemId: "i1", type: "action", rawText: "أحمد: مرحباً يا صديقي" },
    ]);
    snapshots.forEach((snapshot) =>
      state.snapshots.set(snapshot.itemId, snapshot)
    );

    const response = {
      apiVersion: "2.0" as const,
      mode: "auto-apply" as const,
      importOpId: "op-1",
      requestId: "req-1",
      status: "ok" as const,
      commands: [
        {
          op: "relabel" as const,
          itemId: "i1",
          newType: "character" as const,
          confidence: 0.9,
          reason: "اسم شخصية",
        },
      ],
      latencyMs: 10,
    };

    const result = await applyCommandBatch(
      response,
      state,
      items,
      () => "new-id"
    );

    expect(result.status).toBe("applied");
    expect(result.telemetry.commandsApplied).toBe(1);
    expect(items.get("i1")?.type).toBe("character");
  });

  it("discards stale batches and keeps state unchanged", async () => {
    logTestStep("command-engine-stale");

    const state = createImportOperationState("op-active", "import");
    const items = new Map();

    const result = await applyCommandBatch(
      {
        apiVersion: "2.0",
        mode: "auto-apply",
        importOpId: "op-old",
        requestId: "req-stale",
        status: "ok",
        commands: [],
        latencyMs: 1,
      },
      state,
      items,
      () => "id"
    );

    expect(result.status).toBe("stale_discarded");
  });

  it("filters invalid raw commands before apply", () => {
    logTestStep("command-engine-validate");

    const filtered = validateAndFilterCommands([
      { op: "relabel", itemId: "i1", newType: "action", confidence: 1 },
      { op: "relabel", itemId: "", newType: "action" },
      { op: "unknown", itemId: "i2" },
    ]);

    expect(filtered.valid.length).toBe(1);
    expect(filtered.invalidCount).toBe(2);
  });
});

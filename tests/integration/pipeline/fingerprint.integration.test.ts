import { describe, expect, it } from "vitest";
import {
  buildItemSnapshots,
  computeFingerprint,
  computeFingerprintSync,
  matchesSnapshot,
} from "../../../src/pipeline/fingerprint";
import { logTestStep } from "../../config/test-logger";

describe("fingerprint integration", () => {
  it("computes stable fingerprints for same type/text", async () => {
    logTestStep("fingerprint-stable");

    const a = await computeFingerprint("dialogue", "مرحباً");
    const b = await computeFingerprint("dialogue", "مرحباً");

    expect(a).toBe(b);
  });

  it("sync and async fingerprints are deterministic strings", async () => {
    logTestStep("fingerprint-sync-async");

    const asyncFp = await computeFingerprint("action", "يدخل أحمد الغرفة");
    const syncFp = computeFingerprintSync("action", "يدخل أحمد الغرفة");

    expect(typeof asyncFp).toBe("string");
    expect(typeof syncFp).toBe("string");
    expect(asyncFp.length).toBeGreaterThanOrEqual(16);
    expect(syncFp.length).toBeGreaterThanOrEqual(16);
  });

  it("builds snapshots and matches unchanged items", async () => {
    logTestStep("fingerprint-snapshot");

    const snapshots = await buildItemSnapshots([
      { itemId: "1", type: "action", rawText: "يدخل" },
      { itemId: "2", type: "dialogue", rawText: "مرحباً" },
    ]);

    expect(snapshots).toHaveLength(2);
    const matched = await matchesSnapshot(snapshots[0], "action", "يدخل");
    expect(matched).toBe(true);
  });
});

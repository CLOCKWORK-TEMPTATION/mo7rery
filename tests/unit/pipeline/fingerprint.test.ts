/**
 * اختبار F — Fingerprint Specification
 * يتحقق من ثبات البصمة وعدم حساسيتها للتطبيع
 */
import { describe, expect, it } from "vitest";
import {
  computeFingerprintSync,
  buildItemSnapshots,
  matchesSnapshot,
} from "../../../src/pipeline/fingerprint";

describe("computeFingerprintSync", () => {
  it("يُنتج بصمة ثابتة لنفس المدخلات", () => {
    const fp1 = computeFingerprintSync("dialogue", "مرحباً");
    const fp2 = computeFingerprintSync("dialogue", "مرحباً");
    expect(fp1).toBe(fp2);
  });

  it("يُنتج بصمات مختلفة لأنواع مختلفة", () => {
    const fp1 = computeFingerprintSync("dialogue", "مرحباً");
    const fp2 = computeFingerprintSync("action", "مرحباً");
    expect(fp1).not.toBe(fp2);
  });

  it("يُنتج بصمات مختلفة لنصوص مختلفة", () => {
    const fp1 = computeFingerprintSync("dialogue", "مرحباً");
    const fp2 = computeFingerprintSync("dialogue", "وداعاً");
    expect(fp1).not.toBe(fp2);
  });

  it("لا يُطبّع المسافات — مسافة في البداية تغير البصمة", () => {
    const fp1 = computeFingerprintSync("action", "يدخل أحمد");
    const fp2 = computeFingerprintSync("action", " يدخل أحمد");
    expect(fp1).not.toBe(fp2);
  });

  it("لا يُطبّع المسافات الداخلية — مسافة مزدوجة تغير البصمة", () => {
    const fp1 = computeFingerprintSync("action", "يدخل أحمد");
    const fp2 = computeFingerprintSync("action", "يدخل  أحمد");
    expect(fp1).not.toBe(fp2);
  });

  it("يُنتج hex string من 16 حرفاً (djb2 fallback)", () => {
    const fp = computeFingerprintSync("action", "test");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("buildItemSnapshots", () => {
  it("يبني لقطات لمجموعة عناصر", async () => {
    const snapshots = await buildItemSnapshots([
      { itemId: "a", type: "dialogue", rawText: "مرحباً" },
      { itemId: "b", type: "action", rawText: "يدخل" },
    ]);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].itemId).toBe("a");
    expect(snapshots[0].fingerprint).toBeTruthy();
    expect(snapshots[1].itemId).toBe("b");
  });
});

describe("matchesSnapshot", () => {
  it("يُرجع true عند تطابق البصمة", async () => {
    const snapshots = await buildItemSnapshots([
      { itemId: "a", type: "dialogue", rawText: "مرحباً" },
    ]);
    const matches = await matchesSnapshot(snapshots[0], "dialogue", "مرحباً");
    expect(matches).toBe(true);
  });

  it("يُرجع false عند تغير النص", async () => {
    const snapshots = await buildItemSnapshots([
      { itemId: "a", type: "dialogue", rawText: "مرحباً" },
    ]);
    const matches = await matchesSnapshot(snapshots[0], "dialogue", "مرحباً يا");
    expect(matches).toBe(false);
  });

  it("يُرجع false عند تغير النوع", async () => {
    const snapshots = await buildItemSnapshots([
      { itemId: "a", type: "dialogue", rawText: "مرحباً" },
    ]);
    const matches = await matchesSnapshot(snapshots[0], "action", "مرحباً");
    expect(matches).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  addRequestId,
  calculateFingerprint,
  createImportSnapshot,
  createImportSnapshotWithMethods,
  getImportSnapshot,
  getSnapshotItem,
  hasRequestId,
  verifyFingerprint,
} from "../../../src/pipeline/import-state";

describe("import-state", () => {
  it("ينشئ snapshot ويهمل العناصر التي بلا _itemId", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1700000000000);

    const importOpId = "op-create-1";
    const snapshot = createImportSnapshot(importOpId, [
      { _itemId: "a1", type: "action", text: "يدخل أحمد" },
      { type: "dialogue", text: "عنصر بلا معرف" },
      { _itemId: "d1", type: "dialogue", text: "مرحباً" },
    ]);

    expect(snapshot.importOpId).toBe(importOpId);
    expect(snapshot.createdAt).toBe(1700000000000);
    expect(snapshot.items.size).toBe(2);
    expect(snapshot.appliedRequestIds.size).toBe(0);

    const stored = getImportSnapshot(importOpId);
    expect(stored).toBe(snapshot);

    const itemA1 = getSnapshotItem(importOpId, "a1");
    expect(itemA1).toBeDefined();
    expect(itemA1?.rawTextLength).toBe("يدخل أحمد".length);
    expect(itemA1?.fingerprint).toBe(
      calculateFingerprint("action", "يدخل أحمد")
    );

    nowSpy.mockRestore();
  });

  it("يدير requestId بشكل idempotent عبر hasRequestId/addRequestId", () => {
    const importOpId = "op-idem-1";
    createImportSnapshot(importOpId, [
      { _itemId: "x", type: "action", text: "نص" },
    ]);

    expect(hasRequestId(importOpId, "r-1")).toBe(false);

    addRequestId(importOpId, "r-1");
    expect(hasRequestId(importOpId, "r-1")).toBe(true);

    addRequestId(importOpId, "r-1");
    const snapshot = getImportSnapshot(importOpId);
    expect(snapshot?.appliedRequestIds.size).toBe(1);
  });

  it("يتعامل بأمان مع snapshot غير موجود عند فحص/إضافة requestId", () => {
    expect(hasRequestId("missing-op", "req-1")).toBe(false);
    expect(() => addRequestId("missing-op", "req-1")).not.toThrow();
  });

  it("يتحقق من fingerprint بشكل صحيح", () => {
    const importOpId = "op-fp-1";
    createImportSnapshot(importOpId, [
      { _itemId: "i1", type: "dialogue", text: "مرحباً" },
    ]);

    const expected = calculateFingerprint("dialogue", "مرحباً");

    expect(verifyFingerprint(importOpId, "i1", expected)).toBe(true);
    expect(verifyFingerprint(importOpId, "i1", "deadbeef")).toBe(false);
    expect(verifyFingerprint(importOpId, "missing-item", expected)).toBe(false);
    expect(verifyFingerprint("missing-op", "i1", expected)).toBe(false);
  });

  it("calculateFingerprint حتمية وحساسة للنوع والمسافات والأسطر", () => {
    const fp1 = calculateFingerprint("action", "يدخل أحمد");
    const fp2 = calculateFingerprint("action", "يدخل أحمد");
    const fp3 = calculateFingerprint("dialogue", "يدخل أحمد");
    const fp4 = calculateFingerprint("action", " يدخل أحمد");
    const fp5 = calculateFingerprint("action", "يدخل\nأحمد");

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1).not.toBe(fp4);
    expect(fp1).not.toBe(fp5);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it("ينظف snapshots الأقدم من 5 دقائق عند إنشاء snapshot جديد", () => {
    const nowSpy = vi.spyOn(Date, "now");

    const base = 1_700_000_000_000;
    nowSpy.mockReturnValue(base);
    createImportSnapshot("op-old", [
      { _itemId: "old-1", type: "action", text: "قديم" },
    ]);
    expect(getImportSnapshot("op-old")).toBeDefined();

    nowSpy.mockReturnValue(base + 6 * 60 * 1000);
    createImportSnapshot("op-new", [
      { _itemId: "new-1", type: "action", text: "جديد" },
    ]);

    expect(getImportSnapshot("op-old")).toBeUndefined();
    expect(getImportSnapshot("op-new")).toBeDefined();

    nowSpy.mockRestore();
  });

  it("createImportSnapshotWithMethods يضيف methods تعمل على نفس الحالة", () => {
    const importOpId = "op-with-methods-1";
    const snapshot = createImportSnapshotWithMethods(importOpId, [
      { _itemId: "m1", type: "action", text: "مشهد" },
    ]);

    expect(snapshot.hasRequestId("rq-1")).toBe(false);
    snapshot.addRequestId("rq-1");
    expect(snapshot.hasRequestId("rq-1")).toBe(true);

    expect(hasRequestId(importOpId, "rq-1")).toBe(true);
  });
});

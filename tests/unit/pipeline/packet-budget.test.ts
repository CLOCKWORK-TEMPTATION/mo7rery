/**
 * اختبار ميزانية الحزمة — packet-budget
 */
import { describe, expect, it } from "vitest";
import {
  sortByPriority,
  buildPacketWithBudget,
  planChunks,
  prepareItemForPacket,
  DEFAULT_PACKET_BUDGET,
} from "../../../src/pipeline/packet-budget";
import type { SuspiciousItemForPacket } from "../../../src/pipeline/packet-budget";

const makeItem = (
  itemId: string,
  isForced: boolean,
  suspicionScore: number,
  textLength = 100
): SuspiciousItemForPacket => ({
  itemId,
  isForced,
  suspicionScore,
  textLength,
  previewText: "x".repeat(Math.min(textLength, 500)),
  estimatedChars: Math.min(textLength, 500) + 100,
});

describe("sortByPriority", () => {
  it("يرتب forced أولاً", () => {
    const items = [makeItem("a", false, 90), makeItem("b", true, 80)];
    const sorted = sortByPriority(items);
    expect(sorted[0].itemId).toBe("b");
  });

  it("يرتب بالـ suspicion score تنازلياً داخل نفس الفئة", () => {
    const items = [
      makeItem("a", false, 70),
      makeItem("b", false, 90),
      makeItem("c", false, 80),
    ];
    const sorted = sortByPriority(items);
    expect(sorted.map((i) => i.itemId)).toEqual(["b", "c", "a"]);
  });
});

describe("buildPacketWithBudget", () => {
  it("يحترم حد العناصر في الحزمة", () => {
    const config = {
      ...DEFAULT_PACKET_BUDGET,
      maxSuspiciousLinesPerRequest: 2,
    };
    const items = [
      makeItem("a", false, 90),
      makeItem("b", false, 80),
      makeItem("c", false, 70),
    ];
    const result = buildPacketWithBudget(items, config);
    expect(result.included).toHaveLength(2);
    expect(result.overflow).toHaveLength(1);
    expect(result.wasTruncated).toBe(true);
  });

  it("يحترم حد الأحرف", () => {
    const config = { ...DEFAULT_PACKET_BUDGET, maxPacketChars: 300 };
    const items = [
      makeItem("a", false, 90, 200),
      makeItem("b", false, 80, 200),
    ];
    const result = buildPacketWithBudget(items, config);
    expect(result.included).toHaveLength(1);
    expect(result.overflow).toHaveLength(1);
  });

  it("forced يتجاوز حد الأحرف إذا كان أول عنصر", () => {
    const config = { ...DEFAULT_PACKET_BUDGET, maxPacketChars: 50 };
    const items = [makeItem("a", true, 90, 200)];
    const result = buildPacketWithBudget(items, config);
    expect(result.included).toHaveLength(1);
  });
});

describe("planChunks", () => {
  it("يقسم إلى chunks عند تجاوز الحدود", () => {
    const config = {
      ...DEFAULT_PACKET_BUDGET,
      maxSuspiciousLinesPerRequest: 2,
    };
    const items = [
      makeItem("a", false, 90),
      makeItem("b", false, 80),
      makeItem("c", false, 70),
      makeItem("d", false, 60),
    ];
    const plan = planChunks(items, config);
    expect(plan.chunkCount).toBe(2);
    expect(plan.chunks[0].included).toHaveLength(2);
    expect(plan.chunks[1].included).toHaveLength(2);
  });
});

describe("prepareItemForPacket", () => {
  it("يقتطع النص حسب الحد", () => {
    const longText = "أ".repeat(1000);
    const item = prepareItemForPacket("a", longText, 80, false);
    expect(item.previewText.length).toBeLessThanOrEqual(500);
    expect(item.textLength).toBe(1000);
  });
});

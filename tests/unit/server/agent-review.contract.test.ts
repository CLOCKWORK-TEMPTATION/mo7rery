const createSuspiciousLine = (
  itemIndex: number,
  routingBand: "agent-candidate" | "agent-forced" = "agent-candidate",
  assignedType = "dialogue"
) => ({
  itemIndex,
  lineIndex: itemIndex,
  text: `line-${itemIndex}`,
  assignedType,
  totalSuspicion: 90,
  reasons: ["test reason"],
  contextLines: [],
  escalationScore: routingBand === "agent-forced" ? 92 : 84,
  routingBand,
  criticalMismatch: routingBand === "agent-forced",
  distinctDetectors: routingBand === "agent-forced" ? 2 : 1,
});

describe("agent-review contract", () => {
  it("fills required/forced indexes from suspicious lines when omitted", async () => {
    const { validateAgentReviewRequestBody } =
      await import("../../../server/agent-review.mjs");

    const payload = validateAgentReviewRequestBody({
      sessionId: "s-1",
      importOpId: "op-1",
      totalReviewed: 2,
      suspiciousLines: [
        createSuspiciousLine(0, "agent-candidate"),
        createSuspiciousLine(1, "agent-forced"),
      ],
    });

    expect(payload.requiredItemIds).toEqual(["item-0", "item-1"]);
    expect(payload.forcedItemIds).toEqual(["item-1"]);
  });

  it("rejects forced indexes outside required indexes", async () => {
    const { validateAgentReviewRequestBody } =
      await import("../../../server/agent-review.mjs");

    expect(() =>
      validateAgentReviewRequestBody({
        sessionId: "s-2",
        importOpId: "op-2",
        totalReviewed: 2,
        suspiciousLines: [
          createSuspiciousLine(0, "agent-candidate"),
          createSuspiciousLine(1, "agent-forced"),
        ],
        requiredItemIds: ["item-0"],
        forcedItemIds: ["item-1"],
      })
    ).toThrow(/forcedItemIds must be subset of requiredItemIds/i);
  });

  it("returns error with unresolved forced lines when ANTHROPIC_API_KEY is missing", async () => {
    const { reviewSuspiciousLinesWithClaude } =
      await import("../../../server/agent-review.mjs");

    const previousKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const response = await reviewSuspiciousLinesWithClaude({
        sessionId: "s-3",
        importOpId: "op-3",
        totalReviewed: 2,
        suspiciousLines: [
          createSuspiciousLine(0, "agent-candidate"),
          createSuspiciousLine(1, "agent-forced"),
        ],
        requiredItemIds: ["item-0", "item-1"],
        forcedItemIds: ["item-1"],
      });

      expect(response.status).toBe("error");
      expect(response.meta?.requestedCount).toBe(2);
      expect(response.meta?.missingItemIds).toEqual(["item-0", "item-1"]);
      expect(response.meta?.unresolvedForcedItemIds).toEqual(["item-1"]);
    } finally {
      if (previousKey) {
        process.env.ANTHROPIC_API_KEY = previousKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it("returns warning (not error) when no forced lines exist and key is missing", async () => {
    const { reviewSuspiciousLinesWithClaude } =
      await import("../../../server/agent-review.mjs");

    const previousKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const response = await reviewSuspiciousLinesWithClaude({
        sessionId: "s-4",
        importOpId: "op-4",
        totalReviewed: 1,
        suspiciousLines: [createSuspiciousLine(0, "agent-candidate")],
        requiredItemIds: ["item-0"],
        forcedItemIds: [],
      });

      expect(response.status).toBe("partial");
      expect(response.meta?.requestedCount).toBe(1);
      expect(response.meta?.missingItemIds).toEqual(["item-0"]);
      expect(response.meta?.unresolvedForcedItemIds).toEqual([]);
    } finally {
      if (previousKey) {
        process.env.ANTHROPIC_API_KEY = previousKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it("returns deterministic applied commands when mock mode is enabled", async () => {
    const { reviewSuspiciousLinesWithClaude, validateAgentReviewRequestBody } =
      await import("../../../server/agent-review.mjs");

    const previousKey = process.env.ANTHROPIC_API_KEY;
    const previousMockMode = process.env.AGENT_REVIEW_MOCK_MODE;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AGENT_REVIEW_MOCK_MODE = "success";

    try {
      const requestPayload = validateAgentReviewRequestBody({
        sessionId: "s-5",
        importOpId: "op-5",
        totalReviewed: 2,
        suspiciousLines: [
          createSuspiciousLine(0, "agent-candidate"),
          createSuspiciousLine(1, "agent-forced"),
        ],
        requiredItemIds: ["item-0", "item-1"],
        forcedItemIds: ["item-1"],
      });

      const response = await reviewSuspiciousLinesWithClaude(requestPayload);

      expect(response.status).toBe("applied");
      expect(response.commands).toHaveLength(2);
      expect(response.meta?.missingItemIds).toEqual([]);
      expect(response.meta?.unresolvedForcedItemIds).toEqual([]);
      expect(
        response.commands.find((command) => command.itemId === "item-1")
          ?.newType
      ).toBe("action");
    } finally {
      if (previousKey) {
        process.env.ANTHROPIC_API_KEY = previousKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }

      if (previousMockMode) {
        process.env.AGENT_REVIEW_MOCK_MODE = previousMockMode;
      } else {
        delete process.env.AGENT_REVIEW_MOCK_MODE;
      }
    }
  });
});

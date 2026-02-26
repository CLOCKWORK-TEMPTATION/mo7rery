import { afterEach, describe, expect, it, vi } from "vitest";

describe("paste-classifier resilience", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("generates item ids with getRandomValues fallback when randomUUID is unavailable", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array): Uint8Array => {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = (index * 17) & 0xff;
        }
        return array;
      },
    });

    const { classifyText } =
      await import("../../../src/extensions/paste-classifier");
    const classified = classifyText("هذا سطر اختبار");

    expect(classified.length).toBeGreaterThan(0);
    expect(classified[0]?._itemId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("keeps local classification when fail-open is enabled and remote review fails", async () => {
    vi.stubEnv(
      "VITE_AGENT_REVIEW_BACKEND_URL",
      "http://127.0.0.1:8787/api/agent/review"
    );
    vi.stubEnv("VITE_AGENT_REVIEW_FAIL_OPEN", "true");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network down");
    });

    const { classifyTextWithAgentReview } =
      await import("../../../src/extensions/paste-classifier");

    await expect(
      classifyTextWithAgentReview("أحمد:\nلازم نكمل الطريق.")
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: expect.any(String),
          text: expect.any(String),
        }),
      ])
    );
  });

  it("fails fast when fail-open is disabled and remote review fails", async () => {
    vi.stubEnv(
      "VITE_AGENT_REVIEW_BACKEND_URL",
      "http://127.0.0.1:8787/api/agent/review"
    );
    vi.stubEnv("VITE_AGENT_REVIEW_FAIL_OPEN", "false");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network down");
    });

    const { classifyTextWithAgentReview } =
      await import("../../../src/extensions/paste-classifier");

    await expect(
      classifyTextWithAgentReview("أحمد:\nلازم نكمل الطريق.")
    ).rejects.toThrow();
  });
});

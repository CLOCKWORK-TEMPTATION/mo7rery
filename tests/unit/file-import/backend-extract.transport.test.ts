import { describe, expect, it, vi } from "vitest";
import { extractFileWithBackend } from "../../../src/utils/file-import";

const buildSuccessResponse = () =>
  new Response(
    JSON.stringify({
      success: true,
      data: {
        text: "نص مستخرج",
        method: "doc-converter-flow",
        usedOcr: false,
        warnings: [],
        attempts: ["doc-converter-flow"],
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );

describe("backend extract transport", () => {
  it("sends extraction as JSON payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildSuccessResponse());
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const file = new File(["doc-content"], "sample.doc", {
      type: "application/msword",
    });
    await extractFileWithBackend(file, "doc", {
      endpoint: "http://127.0.0.1:8787/api/file-extract",
      timeoutMs: 5000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toBe("http://127.0.0.1:8787/api/file-extract");
    expect(requestInit?.headers).toEqual({ "Content-Type": "application/json" });
    expect(typeof requestInit?.body).toBe("string");
  });

  it("raises connectivity error when backend is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network failed"));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const file = new File(["doc-content"], "sample.doc", {
      type: "application/msword",
    });
    await expect(
      extractFileWithBackend(file, "doc", {
        endpoint: "http://127.0.0.1:8787/api/file-extract",
        timeoutMs: 5000,
      })
    ).rejects.toThrow(/تعذر الاتصال بخدمة Backend extraction/);
  });
});

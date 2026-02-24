import { describe, expect, it, vi } from "vitest";
import { extractFileWithBackend } from "../../../src/utils/file-import";

const buildSuccessResponse = () =>
  new Response(
    JSON.stringify({
      success: true,
      data: {
        text: "نص مستخرج",
        method: "ocr-mistral",
        usedOcr: true,
        warnings: [],
        attempts: ["pdf-converter-flow"],
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );

describe("backend extract transport", () => {
  it("sends pdf extraction as FormData first", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildSuccessResponse());
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const file = new File(["pdf-content"], "sample.pdf", {
      type: "application/pdf",
    });
    await extractFileWithBackend(file, "pdf", {
      endpoint: "http://127.0.0.1:8787/api/file-extract",
      timeoutMs: 5000,
      pdfPreferFormData: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toBe("http://127.0.0.1:8787/api/files/extract");
    expect(requestInit?.body).toBeInstanceOf(FormData);
  });

  it("falls back to json transport when form-data transport fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(buildSuccessResponse());
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const file = new File(["pdf-content"], "sample.pdf", {
      type: "application/pdf",
    });
    const result = await extractFileWithBackend(file, "pdf", {
      endpoint: "http://127.0.0.1:8787/api/file-extract",
      timeoutMs: 5000,
      pdfPreferFormData: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(firstUrl).toBe("http://127.0.0.1:8787/api/files/extract");
    expect(firstInit?.body).toBeInstanceOf(FormData);

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit | undefined,
    ];
    expect(secondUrl).toBe("http://127.0.0.1:8787/api/file-extract");
    expect(secondInit?.headers).toEqual({ "Content-Type": "application/json" });
    expect(typeof secondInit?.body).toBe("string");

    expect(result.warnings[0]).toContain("FormData");
    expect(result.attempts).toContain("backend-formdata-failed");
  });
});

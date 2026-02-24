import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  readBackendHealth,
  startBackendServerHarness,
  type BackendServerHarness,
} from "./backend-server-harness";

const randomPort = (): number => 20000 + Math.floor(Math.random() * 20000);

describe("backend /api/file-extract contract", () => {
  let harness: BackendServerHarness | null = null;

  beforeAll(async () => {
    harness = await startBackendServerHarness(randomPort());
  }, 40_000);

  afterAll(async () => {
    if (harness) {
      await harness.stop();
      harness = null;
    }
  });

  it("accepts json extract requests", async () => {
    if (!harness) throw new Error("Harness not started");
    const response = await fetch(`${harness.baseUrl}/api/file-extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "sample.txt",
        extension: "txt",
        fileBase64: Buffer.from("نص تجريبي", "utf8").toString("base64"),
      }),
    });

    expect(response.ok).toBe(true);
    const body = (await response.json()) as {
      success: boolean;
      data?: { method?: string };
    };
    expect(body.success).toBe(true);
    expect(body.data?.method).toBe("native-text");
  });

  it("accepts multipart extract requests", async () => {
    if (!harness) throw new Error("Harness not started");
    const boundary = "----vitest-boundary";
    const multipartBody =
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="sample.txt"\r\n' +
      "Content-Type: text/plain\r\n\r\n" +
      "نص multipart\r\n" +
      `--${boundary}--\r\n`;

    const response = await fetch(`${harness.baseUrl}/api/files/extract`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    expect(response.ok).toBe(true);
    const body = (await response.json()) as {
      success: boolean;
      data?: { method?: string };
    };
    expect(body.success).toBe(true);
    expect(body.data?.method).toBe("native-text");
  });

  it("health exposes pdf flow readiness fields", async () => {
    if (!harness) throw new Error("Harness not started");
    const health = (await readBackendHealth(harness.baseUrl)) as {
      pdfTextLayerScriptAvailable?: unknown;
      pdfSinglePipelineEnabled?: unknown;
      pdfSelectiveOcrEnabled?: unknown;
    };

    expect(typeof health.pdfTextLayerScriptAvailable).toBe("boolean");
    expect(health.pdfSinglePipelineEnabled).toBe(true);
    expect(typeof health.pdfSelectiveOcrEnabled).toBe("boolean");
  });
});

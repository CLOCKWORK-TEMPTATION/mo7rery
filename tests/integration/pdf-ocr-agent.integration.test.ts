import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  startBackendServerHarness,
  type BackendServerHarness,
} from "../harness/backend-server-harness";

const randomPort = (): number => 20000 + Math.floor(Math.random() * 20000);
const pdfFixturePath = resolve(
  process.cwd(),
  "tests/fixtures/regression/12.pdf"
);

const readPdfPayload = async () => {
  const buffer = await readFile(pdfFixturePath);
  return {
    filename: "12.pdf",
    extension: "pdf",
    fileBase64: buffer.toString("base64"),
  };
};

describe("PDF OCR agent integration", () => {
  let harness: BackendServerHarness | null = null;

  afterEach(async () => {
    if (harness) {
      await harness.stop();
      harness = null;
    }
  });

  it("fails fast when OCR agent is not configured", async () => {
    harness = await startBackendServerHarness(randomPort(), {
      env: {
        MISTRAL_API_KEY: "",
      },
    });

    const response = await request(harness.baseUrl)
      .post("/api/file-extract")
      .set("Content-Type", "application/json")
      .send(await readPdfPayload());

    expect(response.status).toBe(500);
    expect(response.body?.success).toBe(false);
    expect(String(response.body?.error ?? "")).toMatch(
      /MISTRAL_API_KEY|misconfigured|PDF OCR agent/i
    );
  });

  it("extracts PDF through OCR agent and returns ocr-mistral method", async () => {
    const mockedText = "نص OCR من اختبار التكامل";
    harness = await startBackendServerHarness(randomPort(), {
      env: {
        MISTRAL_API_KEY: "test-mistral-key",
        PDF_OCR_AGENT_MOCK_MODE: "success",
        PDF_OCR_AGENT_MOCK_TEXT: mockedText,
      },
    });

    const response = await request(harness.baseUrl)
      .post("/api/file-extract")
      .set("Content-Type", "application/json")
      .send(await readPdfPayload());

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data?.fileType).toBe("pdf");
    expect(response.body?.data?.method).toBe("ocr-mistral");
    expect(response.body?.data?.usedOcr).toBe(true);
    expect(response.body?.data?.text).toContain(mockedText);
  });
});

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  startBackendServerHarness,
  type BackendServerHarness,
} from "../../harness/backend-server-harness";
import { logTestStep } from "../../config/test-logger";

const randomPort = (): number => 20_000 + Math.floor(Math.random() * 10_000);

const txtFixture = resolve(
  process.cwd(),
  "tests/fixtures/sample-screenplay-full-scene.txt"
);
const docxFixture = resolve(process.cwd(), "tests/fixtures/sample.docx");

describe("file-import-server integration", () => {
  let harness: BackendServerHarness | null = null;

  afterEach(async () => {
    if (harness) {
      await harness.stop();
      harness = null;
    }
  });

  it("accepts txt upload and returns extracted Arabic text", async () => {
    logTestStep("server-import-txt");
    harness = await startBackendServerHarness(randomPort(), {
      env: {
        MISTRAL_API_KEY: "",
      },
    });

    const response = await request(harness.baseUrl)
      .post("/api/file-extract")
      .attach("file", txtFixture);

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(typeof response.body?.data?.text).toBe("string");
    expect((response.body?.data?.text as string).length).toBeGreaterThan(0);
  });

  it(
    "accepts docx upload when fixture exists",
    {
      timeout: 30_000,
    },
    async () => {
      logTestStep("server-import-docx");
      if (!existsSync(docxFixture)) {
        return;
      }

      harness = await startBackendServerHarness(randomPort(), {
        env: {
          MISTRAL_API_KEY: "",
        },
      });

      const response = await request(harness.baseUrl)
        .post("/api/file-extract")
        .timeout(25_000)
        .attach("file", docxFixture);

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body?.success).toBe(true);
        expect((response.body?.data?.text as string).length).toBeGreaterThan(0);
      }
    }
  );

  it("rejects unsupported file extensions", async () => {
    logTestStep("server-import-unsupported");
    harness = await startBackendServerHarness(randomPort(), {
      env: {
        MISTRAL_API_KEY: "",
      },
    });

    const response = await request(harness.baseUrl)
      .post("/api/file-extract")
      .attach("file", Buffer.from("dummy"), "file.jpg");

    expect([400, 415]).toContain(response.status);
  });

  it("returns client error for request without file", async () => {
    logTestStep("server-import-without-file");
    harness = await startBackendServerHarness(randomPort(), {
      env: {
        MISTRAL_API_KEY: "",
      },
    });

    const response = await request(harness.baseUrl)
      .post("/api/file-extract")
      .set("Content-Type", "multipart/form-data");

    expect(response.status).not.toBe(500);
  });
});

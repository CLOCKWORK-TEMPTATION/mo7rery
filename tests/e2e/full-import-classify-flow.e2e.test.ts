import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import {
  startBackendServerHarness,
  type BackendServerHarness,
} from "../harness/backend-server-harness";

const backendPort = 18987;
const fixturePath = resolve(
  process.cwd(),
  "tests/fixtures/sample-screenplay-full-scene.txt"
);

test.describe("full import classify flow", () => {
  test("imports txt file from UI and classifies content", async ({ page }) => {
    let harness: BackendServerHarness | null = null;
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    try {
      harness = await startBackendServerHarness(backendPort, {
        env: {
          MISTRAL_API_KEY: "",
          AGENT_REVIEW_MOCK_MODE: "success",
        },
      });

      await page.goto("/");

      await page.getByTestId("menu-section-ملف").click();
      const chooserPromise = page.waitForEvent("filechooser");
      await page.getByTestId("menu-action-open-file").click();
      const chooser = await chooserPromise;
      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/api/file-extract") &&
            res.request().method() === "POST",
          {
            timeout: 30_000,
          }
        ),
        chooser.setFiles(fixturePath),
      ]);
      expect(response.ok()).toBe(true);

      const editor = page.locator(".app-editor-host .ProseMirror").first();
      await expect(
        editor,
        "imported screenplay should contain the first scene header"
      ).toContainText(/مشهد\s*1\s*داخلي\s*-\s*شقة أحمد\s*-\s*ليل/u, {
        timeout: 30_000,
      });

      const lineMarkers = page.locator(
        "[data-type='scene-header-top-line'], [data-type='character'], [data-type='dialogue']"
      );
      await expect(lineMarkers.first()).toBeVisible();

      expect(consoleErrors.length).toBe(0);
    } finally {
      if (harness) {
        await harness.stop();
      }
    }
  });
});

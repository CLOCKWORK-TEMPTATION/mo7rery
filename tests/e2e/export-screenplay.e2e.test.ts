import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const sceneText = readFileSync(
  resolve(process.cwd(), "tests/fixtures/sample-screenplay-full-scene.txt"),
  "utf-8"
);

const countLines = (value: string): number => value.split(/\r?\n/).length;

test.describe("export screenplay", () => {
  test("exports screenplay as downloadable html file", async ({ page }) => {
    await page.goto("/");

    const editor = page.locator(".app-editor-host .ProseMirror").first();
    await editor.click();

    await page.evaluate((text) => {
      const element = document.querySelector(".app-editor-host .ProseMirror");
      if (!element) return;
      const transfer = new DataTransfer();
      transfer.setData("text/plain", text);
      const event = new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
    }, sceneText);

    await expect(editor).toContainText(
      /مشهد\s*1\s*داخلي\s*-\s*شقة أحمد\s*-\s*ليل/u,
      {
        timeout: 30_000,
      }
    );

    await page.getByTestId("menu-section-ملف").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("menu-action-export-html").click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).not.toBeNull();

    const fileBuffer = readFileSync(filePath!);
    expect(fileBuffer.byteLength).toBeGreaterThan(0);

    const exportedText = fileBuffer.toString("utf-8");
    expect(/[\u0600-\u06FF]/.test(exportedText)).toBe(true);

    const sourceLines = countLines(sceneText);
    const exportedLines = countLines(exportedText);
    expect(exportedLines).toBeGreaterThanOrEqual(Math.floor(sourceLines * 0.7));
  });
});

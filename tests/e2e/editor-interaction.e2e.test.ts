import { test, expect } from "@playwright/test";

test.describe("editor interaction", () => {
  test("loads editor shell and allows RTL typing", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("app-header")).toBeVisible();
    await expect(page.getByTestId("editor-area")).toBeVisible();
    await expect(page.getByTestId("app-sidebar")).toBeVisible();

    const editor = page.locator(".app-editor-host .ProseMirror").first();
    await editor.click();
    await page.keyboard.insertText("مشهد 1 داخلي - شقة أحمد - ليل");

    await expect(editor).toContainText("مشهد 1 داخلي - شقة أحمد - ليل");

    const direction = await editor.evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      return style.direction;
    });
    expect(direction).toBe("rtl");

    await page.keyboard.press("Enter");
    await page.keyboard.insertText("يدخل أحمد الغرفة");
    await expect(editor).toContainText("يدخل أحمد الغرفة");
  });
});

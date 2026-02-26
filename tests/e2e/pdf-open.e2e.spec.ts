import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import {
  startBackendServerHarness,
  type BackendServerHarness,
} from "../harness/backend-server-harness";

const pdfFixturePath = resolve(
  process.cwd(),
  "tests/fixtures/regression/12.pdf"
);
const backendPort = 18987;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const mockedOcrText = "نص OCR من اختبار E2E";

const openPdfFromUi = async (
  page: import("@playwright/test").Page
): Promise<void> => {
  const openButton = page.getByRole("button", { name: "فتح ملف" });

  if ((await openButton.count()) > 0) {
    const chooserPromise = page.waitForEvent("filechooser");
    await openButton.first().click();
    const chooser = await chooserPromise;
    await chooser.setFiles(pdfFixturePath);
    return;
  }

  const shortcut = process.platform === "darwin" ? "Meta+O" : "Control+O";
  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press(shortcut);
  const chooser = await chooserPromise;
  await chooser.setFiles(pdfFixturePath);
};

test("fails opening PDF when OCR backend is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("filmlane.autosave.document-text.v1");
  });
  await page.goto("/");
  await openPdfFromUi(page);

  await expect(page.getByText("تعذر فتح الملف")).toBeVisible({
    timeout: 30_000,
  });
});

test("opens PDF through OCR backend then renders text in editor", async ({
  page,
}) => {
  let harness: BackendServerHarness | null = null;
  try {
    harness = await startBackendServerHarness(backendPort, {
      env: {
        MISTRAL_API_KEY: "test-mistral-key",
        PDF_OCR_AGENT_MOCK_MODE: "success",
        PDF_OCR_AGENT_MOCK_TEXT: mockedOcrText,
        AGENT_REVIEW_MOCK_MODE: "success",
      },
    });
    const healthResponse = await fetch(`${backendUrl}/health`);
    expect(healthResponse.ok).toBe(true);

    await page.addInitScript(() => {
      window.localStorage.removeItem("filmlane.autosave.document-text.v1");
    });
    await page.goto("/");
    await openPdfFromUi(page);

    const extractResponse = await page.waitForResponse(
      (response) =>
        response.url().includes("/api/file-extract") &&
        response.request().method() === "POST",
      { timeout: 30_000 }
    );
    expect(extractResponse.ok()).toBe(true);
    const extractPayload = (await extractResponse.json()) as {
      success?: boolean;
      data?: { method?: string; text?: string };
    };
    expect(extractPayload.success).toBe(true);
    expect(extractPayload.data?.method).toBe("ocr-mistral");
    expect(extractPayload.data?.text ?? "").toContain(mockedOcrText);

    await expect(
      page.locator(".app-editor-host .ProseMirror").first()
    ).toContainText(mockedOcrText, {
      timeout: 120_000,
    });
    await expect(page.getByText("تعذر فتح الملف")).toHaveCount(0);
  } finally {
    if (harness) {
      await harness.stop();
    }
  }
});

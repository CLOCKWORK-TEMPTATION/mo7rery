import type { TextItem } from "../types.js";

// مهم: في Node ESM
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

type PdfJsTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
  dir?: "ltr" | "rtl" | "ttb";
};

export async function extractPdfTextItems(pdfBuffer: Uint8Array): Promise<{
  pageCount: number;
  pages: { page: number; width: number; height: number; items: TextItem[] }[];
}> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer }); // PDF.js getDocument() مدخل أساسي للتحميل :contentReference[oaicite:2]{index=2}
  const pdf = await loadingTask.promise;

  const pages: {
    page: number;
    width: number;
    height: number;
    items: TextItem[];
  }[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = (await pdf.getPage(p)) as any;
    const viewport = page.getViewport({ scale: 1.0 });

    // getTextContent() يعيد TextContent، مع توحيد الفراغات لمسافة قياسية حسب الوثائق :contentReference[oaicite:3]{index=3}
    const tc = await page.getTextContent({
      includeMarkedContent: false,
      disableNormalization: false,
    });

    const items: TextItem[] = [];

    for (const it of tc.items as PdfJsTextItem[]) {
      if (!it?.str) continue;

      // transform = [a, b, c, d, e, f]
      const [, , , , e, f] = it.transform || [0, 0, 0, 0, 0, 0];
      const x = e ?? 0;
      const y = f ?? 0;
      const w = Math.max(0, it.width ?? 0);
      const h = Math.max(0, it.height ?? 0);

      items.push({
        text: it.str,
        x,
        y,
        w,
        h,
        page: p - 1,
        fontName: it.fontName,
        dir: it.dir,
      });
    }

    pages.push({
      page: p - 1,
      width: viewport.width,
      height: viewport.height,
      items,
    });
  }

  return { pageCount: pdf.numPages, pages };
}

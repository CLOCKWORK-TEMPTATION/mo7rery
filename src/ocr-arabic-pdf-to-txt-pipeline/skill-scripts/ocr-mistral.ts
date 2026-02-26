#!/usr/bin/env npx tsx
/**
 * ocr-mistral.ts — استخراج النص من PDF عبر Mistral OCR 3
 *
 * الاستخدام:
 *   npx tsx ocr-mistral.ts --input "/path/to/file.pdf" --output "/path/to/result.json"
 *   npx tsx ocr-mistral.ts --input "/path/to/file.pdf" --output "/path/to/result.json" --pages "0-9"
 *
 * المتطلبات:
 *   - متغير البيئة MISTRAL_API_KEY
 *   - حزمة @mistralai/mistralai
 *
 * المخرج: ملف JSON يحتوي نتائج OCR لكل صفحة
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

// ─── أنواع البيانات ───────────────────────────────────────────

interface OcrPageResult {
  /** رقم الصفحة (يبدأ من 0) */
  index: number;
  /** النص المستخرج بصيغة Markdown */
  markdown: string;
  /** الصور المكتشفة في الصفحة */
  images: Array<{
    id: string;
    bbox: {
      top_left_x: number;
      top_left_y: number;
      bottom_right_x: number;
      bottom_right_y: number;
    };
  }>;
}

interface OcrResult {
  /** اسم الملف المصدر */
  source: string;
  /** النموذج المستخدم */
  model: string;
  /** عدد الصفحات المعالجة */
  total_pages: number;
  /** مجموع بايتات المستند */
  doc_size_bytes: number | null;
  /** نتائج كل صفحة */
  pages: OcrPageResult[];
  /** وقت المعالجة بالثواني */
  processing_time_seconds: number;
}

// ─── تحليل المعاملات ──────────────────────────────────────────

function parseArgs(): {
  input: string;
  output: string;
  pages: number[] | null;
} {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  let pagesStr = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) input = args[++i];
    else if (args[i] === "--output" && args[i + 1]) output = args[++i];
    else if (args[i] === "--pages" && args[i + 1]) pagesStr = args[++i];
  }

  if (!input || !output) {
    console.error(
      "الاستخدام: npx tsx ocr-mistral.ts --input <pdf> --output <json> [--pages 0-9|all]"
    );
    process.exit(1);
  }

  // تحليل نطاق الصفحات
  let pages: number[] | null = null;
  if (pagesStr && pagesStr !== "all") {
    const match = pagesStr.match(/^(\d+)-(\d+)$/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      // أرقام مفصولة بفاصلة
      pages = pagesStr.split(",").map((s) => parseInt(s.trim(), 10));
    }
  }

  return { input, output, pages };
}

// ─── المنطق الرئيسي ──────────────────────────────────────────

async function runOcr(): Promise<void> {
  const { input, output, pages } = parseArgs();

  // التحقق من المفتاح
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) {
    console.error("خطأ: متغير البيئة MISTRAL_API_KEY غير موجود");
    process.exit(1);
  }

  // استيراد ديناميكي لـ Mistral SDK
  const { Mistral } = await import("@mistralai/mistralai");
  const client = new Mistral({ apiKey });

  // قراءة PDF وتحويله لـ base64
  console.error(`قراءة الملف: ${input}`);
  const pdfBuffer = readFileSync(input);
  const base64Pdf = pdfBuffer.toString("base64");
  const docSizeBytes = pdfBuffer.byteLength;

  console.error(`حجم الملف: ${(docSizeBytes / 1024 / 1024).toFixed(2)} MB`);

  // فحص حد الحجم
  if (docSizeBytes > 50 * 1024 * 1024) {
    console.error("تحذير: الملف أكبر من 50MB — قد يرفضه Mistral API");
  }

  // بناء طلب OCR
  const ocrParams: Record<string, unknown> = {
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      documentUrl: `data:application/pdf;base64,${base64Pdf}`,
    },
    includeImageBase64: false,
    tableFormat: "markdown",
  };

  if (pages !== null) {
    ocrParams["pages"] = pages;
    console.error(`معالجة صفحات محددة: ${pages.join(", ")}`);
  } else {
    console.error("معالجة كل الصفحات...");
  }

  // تنفيذ OCR
  const startTime = Date.now();

  try {
    const response = await client.ocr.process(ocrParams as any);
    const elapsed = (Date.now() - startTime) / 1000;

    // بناء النتيجة
    const result: OcrResult = {
      source: basename(input),
      model: (response as any).model ?? "mistral-ocr-latest",
      total_pages: (response as any).pages?.length ?? 0,
      doc_size_bytes:
        (response as any).usage_info?.doc_size_bytes ?? docSizeBytes,
      processing_time_seconds: Math.round(elapsed * 100) / 100,
      pages: [],
    };

    for (const page of (response as any).pages ?? []) {
      result.pages.push({
        index: page.index,
        markdown: page.markdown ?? "",
        images: (page.images ?? []).map((img: any) => ({
          id: img.id,
          bbox: {
            top_left_x: img.top_left_x ?? 0,
            top_left_y: img.top_left_y ?? 0,
            bottom_right_x: img.bottom_right_x ?? 0,
            bottom_right_y: img.bottom_right_y ?? 0,
          },
        })),
      });
    }

    // كتابة النتيجة
    writeFileSync(output, JSON.stringify(result, null, 2), "utf-8");
    console.error(
      `تمت المعالجة: ${result.total_pages} صفحة في ${elapsed.toFixed(1)} ثانية`
    );
    console.error(`المخرج: ${output}`);

    // إخراج ملخص على stdout
    console.log(
      JSON.stringify({
        success: true,
        pages_processed: result.total_pages,
        model: result.model,
        time_seconds: result.processing_time_seconds,
        output_path: output,
      })
    );
  } catch (error: any) {
    const elapsed = (Date.now() - startTime) / 1000;
    console.error(`فشل OCR بعد ${elapsed.toFixed(1)} ثانية`);
    console.error(`الخطأ: ${error?.message ?? error}`);

    // محاولة تحديد نوع الخطأ
    const statusCode = error?.statusCode ?? error?.status;
    if (statusCode === 401) {
      console.error("→ مفتاح API غير صالح");
    } else if (statusCode === 413) {
      console.error("→ الملف أكبر من الحد المسموح");
    } else if (statusCode === 429) {
      console.error("→ تجاوز حد الطلبات — انتظر ثم أعد المحاولة");
    }

    console.log(
      JSON.stringify({
        success: false,
        error: error?.message ?? String(error),
        status_code: statusCode ?? null,
      })
    );
    process.exit(1);
  }
}

runOcr();

import { defaultConfig } from "./config.js";
import { extractPdfTextItems } from "./pdf/text-layer-extractor.js";
import { buildLinesFromTextItems } from "./pdf/line-builder.js";
import { markAndFilterArtifacts } from "./pdf/page-artifacts.js";
import { applyQualityScoring } from "./quality/line-quality.js";
import {
  getSuspiciousPages,
  countSuspiciousLines,
} from "./quality/suspicious-detector.js";
import { applyScreenplayValidation } from "./domain/arabic-screenplay-validator.js";
import { finalRenderLineNormalize } from "./normalize.js";
import type {
  DocumentExtraction,
  OcrProvider,
  PageExtraction,
  PipelineConfig,
} from "./types.js";
import { applyOcrPatchesToPages } from "./patch/constrained-corrector.js";

export async function runPdfTextLayerFirstPipeline(args: {
  pdfBuffer: Buffer;
  filePath: string;
  config?: Partial<PipelineConfig>;
  ocrProvider?: OcrProvider | null;
}): Promise<DocumentExtraction> {
  const config: PipelineConfig = deepMerge(defaultConfig, args.config ?? {});
  const startedAt = new Date().toISOString();

  const extracted = await extractPdfTextItems(new Uint8Array(args.pdfBuffer));

  let pages: PageExtraction[] = extracted.pages.map((p) => {
    let lines = buildLinesFromTextItems(p.page, p.items, config.lineMerge);
    lines = markAndFilterArtifacts(lines);
    lines = applyQualityScoring(lines);
    if (config.domain.screenplayArabicMode) {
      lines = applyScreenplayValidation(lines);
    }

    return {
      page: p.page,
      width: p.width,
      height: p.height,
      lines,
      rawTextItemsCount: p.items.length,
      usedOcr: false,
    };
  });

  const linesTotalBeforePatch = pages.reduce((s, p) => s + p.lines.length, 0);
  const suspiciousBefore = countSuspiciousLines(
    pages,
    config.quality.suspiciousThreshold
  );

  let pagesSentToOcr: number[] = [];
  let patchedLines = 0;

  if (
    config.ocr.enabled &&
    args.ocrProvider &&
    config.ocr.provider !== "none"
  ) {
    pagesSentToOcr = getSuspiciousPages(
      pages,
      config.quality.suspiciousThreshold
    );

    if (pagesSentToOcr.length > 0) {
      const batches = chunk(pagesSentToOcr, config.ocr.maxPagesPerBatch);
      const allOcrResults = [];

      for (const batch of batches) {
        const res = await args.ocrProvider.processPdfPages({
          pdfBuffer: args.pdfBuffer,
          pages: batch,
          hint: "Arabic screenplay text. Preserve line order. No paraphrasing.",
        });
        allOcrResults.push(...res);
      }

      const patched = applyOcrPatchesToPages({
        pages,
        ocrResults: allOcrResults,
        config,
      });

      pages = patched.pages;
      patchedLines = patched.patchedLines;

      // إعادة تقييم الجودة بعد التصحيح
      for (const p of pages) {
        p.lines = applyQualityScoring(p.lines);
        if (config.domain.screenplayArabicMode) {
          p.lines = applyScreenplayValidation(p.lines);
        }
      }
    }
  }

  // Normalize render output (بدون تغيير البنية)
  for (const p of pages) {
    for (const l of p.lines) {
      l.text = finalRenderLineNormalize(l.text);
    }
  }

  const suspiciousAfter = countSuspiciousLines(
    pages,
    config.quality.suspiciousThreshold
  );

  const doc: DocumentExtraction = {
    pages,
    metadata: {
      filePath: args.filePath,
      pageCount: extracted.pageCount,
      strategy: "text-layer-first",
      startedAt,
      finishedAt: new Date().toISOString(),
    },
    stats: {
      pagesTotal: extracted.pageCount,
      pagesWithTextLayer: extracted.pages.filter((p) => p.items.length > 0)
        .length,
      pagesSentToOcr: pagesSentToOcr.length,
      linesTotalBeforePatch,
      suspiciousLinesBeforePatch: suspiciousBefore,
      patchedLines,
      suspiciousLinesAfterPatch: suspiciousAfter,
    },
  };

  return doc;
}

export function renderDocumentText(doc: DocumentExtraction): string {
  const out: string[] = [];

  for (const page of doc.pages) {
    for (const line of page.lines) {
      out.push(line.text);
    }
    // فاصل صفحة اختياري — ألغِه لو تريد مطابقة أقرب للـDOCX بدون فواصل
    // out.push("");
  }

  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function deepMerge<T>(base: T, patch: Partial<T>): T {
  if (Array.isArray(base)) {
    return [...base] as T;
  }

  if (!isObject(base) || !isObject(patch)) {
    return (patch ?? base) as T;
  }

  const out: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;

    const currentValue = out[key];
    if (isObject(value) && isObject(currentValue)) {
      out[key] = deepMerge(currentValue, value);
      continue;
    }

    out[key] = value;
  }

  return out as T;
}

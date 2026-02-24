#!/usr/bin/env node
import path from "node:path";
import { readBinary, writeText } from "./pipeline/io.js";
import {
  runPdfTextLayerFirstPipeline,
  renderDocumentText,
} from "./pipeline/pdf-extractor.js";
import { MistralOcrProvider } from "./pipeline/ocr/mistral-ocr-provider.js";

type OcrProviderName = "mistral" | "azure" | "none";

const resolveOcrProvider = (): OcrProviderName => {
  const rawProvider = process.env.OCR_PROVIDER;
  if (
    rawProvider === "mistral" ||
    rawProvider === "azure" ||
    rawProvider === "none"
  ) {
    return rawProvider;
  }
  return "mistral";
};

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node dist/cli.js <input.pdf> [output.txt]");
    process.exit(1);
  }

  const outPath =
    process.argv[3] ||
    path.join(
      path.dirname(pdfPath),
      path.basename(pdfPath, path.extname(pdfPath)) + ".extracted.txt"
    );

  const pdfBuffer = await readBinary(pdfPath);

  const ocrProviderName = resolveOcrProvider();
  const ocrProvider =
    ocrProviderName === "none" ? null : new MistralOcrProvider();

  const result = await runPdfTextLayerFirstPipeline({
    pdfBuffer,
    filePath: pdfPath,
    ocrProvider,
    config: {
      ocr: {
        enabled: ocrProviderName !== "none",
        provider: ocrProviderName,
        maxPagesPerBatch: 6,
      },
      quality: {
        suspiciousThreshold: 0.62,
        weirdCharRatioThreshold: 0.12,
        minArabicRatioForArabicDocs: 0.15,
      },
    },
  });

  const text = renderDocumentText(result);
  await writeText(outPath, text);

  process.stdout.write(
    `${JSON.stringify(
      {
        output: outPath,
        stats: result.stats,
        metadata: result.metadata,
      },
      null,
      2
    )}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

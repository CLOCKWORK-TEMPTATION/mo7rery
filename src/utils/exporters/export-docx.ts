import {
  buildPayloadMarker,
  createPayloadFromBlocks,
  encodeScreenplayPayload,
  type ScreenplayBlock,
} from "../file-import/document-model";
import {
  type DocxParagraphPreset,
  getDocxPresetForFormat,
  normalizeText,
  pointsToTwips,
  resolveBlocksForExport,
} from "./shared";

export interface ExportToDocxOptions {
  blocks?: ScreenplayBlock[];
}

const DEFAULT_DOCX_FONT = "AzarMehrMonospaced-San";
const DEFAULT_DOCX_SIZE_HALF_POINTS = 24;

const mapAlignment = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AlignmentType: any,
  alignment: DocxParagraphPreset["alignment"]
) => {
  switch (alignment) {
    case "center":
      return AlignmentType.CENTER;
    case "left":
      return AlignmentType.LEFT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.RIGHT;
  }
};

/**
 * يبني فقرة DOCX واحدة من كتلة سيناريو.
 */
const buildDocxParagraph = (
  block: ScreenplayBlock,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modules: { AlignmentType: any; Paragraph: any; TextRun: any }
) => {
  const { AlignmentType, Paragraph, TextRun } = modules;
  const preset = getDocxPresetForFormat(block.formatId);
  return new Paragraph({
    bidirectional: true,
    alignment: mapAlignment(AlignmentType, preset.alignment),
    spacing: {
      before: pointsToTwips(preset.spacingBeforePt ?? 0),
      after: pointsToTwips(preset.spacingAfterPt ?? 0),
    },
    indent: {
      start: preset.indentStartTwip,
      end: preset.indentEndTwip,
    },
    children: [
      new TextRun({
        text: normalizeText(block.text),
        font: DEFAULT_DOCX_FONT,
        size: DEFAULT_DOCX_SIZE_HALF_POINTS,
        bold: preset.bold,
        italics: preset.italics,
      }),
    ],
  });
};

/**
 * يبني فقرة scene-header-top-line خاصة:
 * header-1 (يمين) + tab + header-2 (يسار) في نفس السطر.
 *
 * في DOCX: نستخدم tab stops لمحاكاة flex layout.
 * header-1 على اليمين، header-2 على اليسار باستخدام right tab stop.
 */
const buildTopLineParagraph = (
  header1Text: string,
  header2Text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modules: { AlignmentType: any; Paragraph: any; TextRun: any; TabStopPosition: any; TabStopType: any }
) => {
  const { Paragraph, TextRun, AlignmentType } = modules;
  const h1 = normalizeText(header1Text);
  const h2 = normalizeText(header2Text);

  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: {
      before: pointsToTwips(12),
      after: pointsToTwips(0),
    },
    children: [
      new TextRun({
        text: h1,
        font: DEFAULT_DOCX_FONT,
        size: DEFAULT_DOCX_SIZE_HALF_POINTS,
        bold: true,
      }),
      // إضافة مسافات بين header-1 و header-2
      new TextRun({
        text: `\t${h2}`,
        font: DEFAULT_DOCX_FONT,
        size: DEFAULT_DOCX_SIZE_HALF_POINTS,
        bold: true,
      }),
    ],
    tabStops: [
      {
        type: "left" as const,
        position: 8640, // ~6 inches (نهاية السطر تقريبًا)
      },
    ],
  });
};

export const exportToDocx = async (
  content: string,
  filename: string = "screenplay.docx",
  options?: ExportToDocxOptions
): Promise<void> => {
  const docxLib = await import("docx");
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = docxLib;
  const modules = { AlignmentType, Paragraph, TextRun, TabStopPosition: undefined, TabStopType: undefined };

  const blocks = resolveBlocksForExport(content, options?.blocks);
  const payload = createPayloadFromBlocks(blocks, {
    font: "AzarMehrMonospaced-San",
    size: "12pt",
  });
  const payloadMarker = buildPayloadMarker(encodeScreenplayPayload(payload));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paragraphs: any[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = normalizeText(block.text);
    if (!text && block.formatId !== "scene-header-top-line") continue;

    // scene-header-top-line: wrapper — نتخطاه (الأبناء header-1 + header-2 موجودين)
    if (block.formatId === "scene-header-top-line") {
      continue;
    }

    // دمج scene-header-1 + scene-header-2 في سطر واحد
    if (block.formatId === "scene-header-1") {
      const next = blocks[i + 1];
      if (next && next.formatId === "scene-header-2") {
        paragraphs.push(
          buildTopLineParagraph(text, next.text, modules)
        );
        i += 1;
      } else {
        paragraphs.push(buildDocxParagraph(block, modules));
      }
      continue;
    }

    paragraphs.push(buildDocxParagraph(block, modules));
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      new Paragraph({
        bidirectional: true,
        children: [
          new TextRun({
            text: "",
            font: DEFAULT_DOCX_FONT,
            size: DEFAULT_DOCX_SIZE_HALF_POINTS,
          }),
        ],
      })
    );
  }

  // Marker مخفي لاسترجاع payload 1:1 عند إعادة فتح الملف.
  paragraphs.push(
    new Paragraph({
      bidirectional: true,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: payloadMarker,
          color: "FFFFFF",
          size: 2,
          font: DEFAULT_DOCX_FONT,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

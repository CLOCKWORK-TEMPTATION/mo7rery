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

export const exportToDocx = async (
  content: string,
  filename: string = "screenplay.docx",
  options?: ExportToDocxOptions
): Promise<void> => {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } =
    await import("docx");

  const blocks = resolveBlocksForExport(content, options?.blocks);
  const payload = createPayloadFromBlocks(blocks, {
    font: "AzarMehrMonospaced-San",
    size: "12pt",
  });
  const payloadMarker = buildPayloadMarker(encodeScreenplayPayload(payload));

  const paragraphs = blocks.map((block) => {
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
  });

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

import {
  htmlToScreenplayBlocks,
  type ScreenplayBlock,
} from "../file-import/document-model";

export interface ExportRequest {
  html: string;
  fileNameBase?: string;
  title?: string;
}

export interface BlockExportRequest {
  html: string;
  fileNameBase?: string;
  blocks?: ScreenplayBlock[];
}

export type DocxParagraphPreset = {
  alignment: "right" | "center" | "left" | "justify";
  bold?: boolean;
  italics?: boolean;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  indentStartTwip?: number;
  indentEndTwip?: number;
};

const DEFAULT_EXPORT_FILE_BASE = "screenplay";

export const downloadBlob = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const sanitizeExportFileBaseName = (
  fileNameBase?: string
): string => {
  const candidate = (fileNameBase ?? DEFAULT_EXPORT_FILE_BASE).trim();
  const normalized = candidate
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");
  return normalized || DEFAULT_EXPORT_FILE_BASE;
};

export const pointsToTwips = (value: number): number =>
  Math.max(0, Math.round(value * 20));

export const normalizeText = (value: string): string =>
  (value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .trim();

export const resolveBlocksForExport = (
  content: string,
  blocks?: ScreenplayBlock[]
): ScreenplayBlock[] => {
  if (Array.isArray(blocks) && blocks.length > 0) {
    return blocks;
  }
  return htmlToScreenplayBlocks(content);
};

export const getDocxPresetForFormat = (
  formatId: ScreenplayBlock["formatId"]
): DocxParagraphPreset => {
  switch (formatId) {
    case "basmala":
      return {
        alignment: "center",
        bold: true,
        spacingAfterPt: 10,
      };
    case "scene-header-1":
      return {
        alignment: "right",
        bold: true,
        spacingBeforePt: 8,
        spacingAfterPt: 6,
      };
    case "scene-header-2":
      return {
        alignment: "right",
        spacingAfterPt: 4,
      };
    case "scene-header-3":
      return {
        alignment: "center",
        spacingAfterPt: 4,
      };
    case "scene-header-top-line":
      return {
        alignment: "right",
        spacingAfterPt: 6,
      };
    case "character":
      return {
        alignment: "center",
        bold: true,
        spacingBeforePt: 8,
        spacingAfterPt: 2,
      };
    case "dialogue":
      return {
        alignment: "right",
        spacingAfterPt: 6,
        indentStartTwip: 960,
        indentEndTwip: 720,
      };
    case "parenthetical":
      return {
        alignment: "center",
        italics: true,
        spacingAfterPt: 4,
      };
    case "transition":
      return {
        alignment: "left",
        bold: true,
        spacingBeforePt: 6,
        spacingAfterPt: 6,
      };
    case "action":
      return {
        alignment: "justify",
        spacingAfterPt: 6,
      };
    default:
      return {
        alignment: "right",
        spacingAfterPt: 6,
      };
  }
};

export const buildFullHtmlDocument = (
  bodyHtml: string,
  title = "تصدير محرر السيناريو"
): string => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      margin: 0 auto;
      width: min(794px, 100%);
      padding: 28px;
      direction: rtl;
      text-align: right;
      font-family: 'Cairo', system-ui, sans-serif;
      line-height: 1.8;
      color: #0f172a;
      background: #ffffff;
      box-sizing: border-box;
    }
    [data-type] {
      white-space: pre-wrap;
    }
    [data-type="basmala"] {
      text-align: center;
      font-weight: 700;
      margin-bottom: 10px;
    }
    [data-type="scene-header-top-line"] {
      text-align: right;
      margin: 0 0 12px 0;
    }
    [data-type="scene-header-1"] {
      text-align: right;
      font-weight: 700;
      margin-top: 8px;
      margin-bottom: 6px;
    }
    [data-type="scene-header-2"] {
      text-align: right;
      margin-bottom: 4px;
    }
    [data-type="scene-header-3"] {
      text-align: center;
      margin-bottom: 4px;
    }
    [data-type="action"] {
      text-align: justify;
      margin-bottom: 6px;
    }
    [data-type="character"] {
      text-align: center;
      font-weight: 700;
      margin-top: 8px;
      margin-bottom: 2px;
    }
    [data-type="dialogue"] {
      text-align: right;
      margin-bottom: 6px;
      padding-right: 48px;
      padding-left: 36px;
    }
    [data-type="parenthetical"] {
      text-align: center;
      font-style: italic;
      margin-bottom: 4px;
    }
    [data-type="transition"] {
      text-align: left;
      font-weight: 700;
      margin-top: 6px;
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

import { XMLBuilder } from "fast-xml-parser";
import type { ScreenplayBlock } from "../file-import/document-model";
import {
  type BlockExportRequest,
  downloadBlob,
  normalizeText,
  resolveBlocksForExport,
  sanitizeExportFileBaseName,
} from "./shared";

type FdxParagraphType =
  | "Scene Heading"
  | "Action"
  | "Character"
  | "Dialogue"
  | "Parenthetical"
  | "Transition"
  | "General";

const mapFormatIdToFdxType = (
  formatId: ScreenplayBlock["formatId"]
): FdxParagraphType => {
  switch (formatId) {
    case "scene-header-1":
    case "scene-header-2":
    case "scene-header-3":
    case "scene-header-top-line":
      return "Scene Heading";
    case "action":
      return "Action";
    case "character":
      return "Character";
    case "dialogue":
      return "Dialogue";
    case "parenthetical":
      return "Parenthetical";
    case "transition":
      return "Transition";
    case "basmala":
      return "General";
    default:
      return "Action";
  }
};

interface FdxParagraph {
  "@_Type": FdxParagraphType;
  Text: string;
  SceneProperties?: { "@_Title": string };
}

/**
 * يبني مصفوفة فقرات FDX من كتل السيناريو.
 * يدمج scene-header-1 + scene-header-2 المتتاليين في Scene Heading واحد.
 */
const buildFdxParagraphs = (blocks: ScreenplayBlock[]): FdxParagraph[] => {
  const paragraphs: FdxParagraph[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = normalizeText(block.text);
    if (!text) continue;

    // دمج scene-header-1 + scene-header-2 المتتاليين
    if (block.formatId === "scene-header-1") {
      const next = blocks[i + 1];
      let combinedText = text;
      if (next && next.formatId === "scene-header-2") {
        const nextText = normalizeText(next.text);
        if (nextText) {
          combinedText = `${text} - ${nextText}`;
        }
        i += 1;
      }
      paragraphs.push({
        "@_Type": "Scene Heading",
        Text: combinedText,
        SceneProperties: { "@_Title": combinedText },
      });
      continue;
    }

    paragraphs.push({
      "@_Type": mapFormatIdToFdxType(block.formatId),
      Text: text,
    });
  }

  return paragraphs;
};

export const exportAsFdx = (request: BlockExportRequest): void => {
  const blocks = resolveBlocksForExport(request.html, request.blocks);
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase);

  const paragraphs = buildFdxParagraphs(blocks);

  // استخراج أسماء الشخصيات للـ SmartType
  const characterNames = [
    ...new Set(
      blocks
        .filter((b) => b.formatId === "character")
        .map((b) => normalizeText(b.text))
        .filter(Boolean)
    ),
  ];

  const fdxDocument = {
    FinalDraft: {
      "@_DocumentType": "Script",
      "@_Template": "No",
      "@_Version": "5",
      Content: {
        Paragraph: paragraphs,
      },
      SmartType: {
        Characters: {
          Character: characterNames.map((name) => ({ "@_Name": name })),
        },
        Extensions: {
          Extension: ["(V.O.)", "(O.S.)", "(CONT'D)"],
        },
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    suppressEmptyNode: false,
    processEntities: true,
  });

  const xmlBody = builder.build(fdxDocument);
  const xmlString = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n${xmlBody}`;

  const blob = new Blob([xmlString], {
    type: "application/xml;charset=utf-8",
  });
  downloadBlob(`${fileBase}.fdx`, blob);
};

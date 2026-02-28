import type { ScreenplayBlock } from "../file-import/document-model";
import { sanitizeExportFileBaseName } from "./shared";

interface ExportAsClassifiedOptions {
  fileNameBase?: string;
  blocks: ScreenplayBlock[];
}

const mapFormatIdToClassifiedElement = (
  formatId: ScreenplayBlock["formatId"]
): string => {
  switch (formatId) {
    case "basmala":
      return "BASMALA";
    case "scene-header-1":
      return "SCENE-HEADER-1";
    case "scene-header-2":
      return "SCENE-HEADER-2";
    case "scene-header-3":
      return "SCENE-HEADER-3";
    case "scene-header-top-line":
      // Usually scene-header-1 and 2 are nested. This wrapper can be ignored or mapped to ACTION if orphaned.
      return "ACTION";
    case "action":
      return "ACTION";
    case "character":
      return "CHARACTER";
    case "dialogue":
      return "DIALOGUE";
    case "parenthetical":
      // Schema doesn't have parenthetical, merging with dialogue
      return "DIALOGUE";
    case "transition":
      return "TRANSITION";
    default:
      return "ACTION";
  }
};

const normalizeText = (text: string): string => {
  return text.replace(/\s+/g, " ").trim();
};

export const generateClassifiedText = (blocks: ScreenplayBlock[]): string => {
  const lines: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = normalizeText(block.text);
    if (!text) continue;

    if (block.formatId === "scene-header-top-line") {
      continue;
    }

    const element = mapFormatIdToClassifiedElement(block.formatId);
    let finalValue = text;

    if (element === "CHARACTER") {
      if (!finalValue.endsWith(":")) {
        finalValue += " :";
      }
    }

    lines.push(`${element} = ${finalValue}`);
  }

  return lines.join("\n");
};

export const exportAsClassified = ({
  fileNameBase,
  blocks,
}: ExportAsClassifiedOptions): void => {
  const textContent = generateClassifiedText(blocks);
  const safeName =
    (sanitizeExportFileBaseName(fileNameBase ?? "النص_المصنف") ||
      "النص_المصنف") + ".txt";

  const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

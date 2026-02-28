import type { ScreenplayBlock } from "../../utils/file-import/document-model";
import type { UnstructuredItemType, UnstructuredResult } from "./types";

function assertUnreachable(value: never): never {
  throw new Error(`Unhandled UnstructuredItemType: ${String(value)}`);
}

function mapTypeToFormatId(
  t: UnstructuredItemType
): ScreenplayBlock["formatId"] {
  switch (t) {
    case "BASMALA":
      return "basmala";
    case "SCENE-HEADER-1":
      return "scene-header-1";
    case "SCENE-HEADER-2":
      return "scene-header-2";
    case "SCENE-HEADER-3":
      return "scene-header-3";
    case "ACTION":
      return "action";
    case "CHARACTER":
      return "character";
    case "DIALOGUE":
      return "dialogue";
    case "TRANSITION":
      return "transition";
  }

  return assertUnreachable(t);
}

export function toStructuredBlocks(
  result: UnstructuredResult
): ScreenplayBlock[] {
  return result.items.map((it) => ({
    formatId: mapTypeToFormatId(it.type),
    text: it.normalized.trimEnd(),
  }));
}

export function toStructuredText(blocks: ScreenplayBlock[]): string {
  return blocks
    .map((b) => (b.text ?? "").trimEnd())
    .filter((t) => t.length > 0)
    .join("\n");
}

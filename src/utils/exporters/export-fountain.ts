import type { ScreenplayBlock } from "../file-import/document-model";
import {
  type BlockExportRequest,
  downloadBlob,
  normalizeText,
  resolveBlocksForExport,
  sanitizeExportFileBaseName,
} from "./shared";

/**
 * يبني نص Fountain من كتل السيناريو.
 *
 * ملاحظات RTL/عربي:
 * - `@` prefix لأسماء الشخصيات (العربية ليس فيها UPPERCASE)
 * - `.` prefix لعناوين المشاهد (لا تبدأ بـ INT./EXT.)
 * - `> text <` للنص المركزي (بسملة)
 * - `> text` للانتقالات المفروضة
 */
const buildFountainString = (blocks: ScreenplayBlock[]): string => {
  const lines: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = normalizeText(block.text);
    if (!text) continue;

    switch (block.formatId) {
      case "basmala":
        lines.push("", `> ${text} <`, "");
        break;

      case "scene-header-1": {
        // دمج scene-header-1 + scene-header-2 المتتاليين
        const next = blocks[i + 1];
        let heading = text;
        if (next && next.formatId === "scene-header-2") {
          const nextText = normalizeText(next.text);
          if (nextText) {
            heading = `${text} - ${nextText}`;
          }
          i += 1;
        }
        lines.push("", `.${heading}`, "");
        break;
      }

      case "scene-header-2":
      case "scene-header-3":
      case "scene-header-top-line":
        lines.push("", `.${text}`, "");
        break;

      case "action":
        lines.push("", text, "");
        break;

      case "character":
        lines.push("", `@${text}`);
        break;

      case "dialogue":
        lines.push(text, "");
        break;

      case "parenthetical": {
        // تأكد إن النص محاط بأقواس
        const cleaned = text.replace(/^\(|\)$/g, "");
        lines.push(`(${cleaned})`);
        break;
      }

      case "transition":
        lines.push("", `> ${text}`, "");
        break;

      default:
        lines.push("", text, "");
        break;
    }
  }

  // تنظيف الأسطر الفارغة المتتالية (3+ → 2)
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
};

export const exportAsFountain = (request: BlockExportRequest): void => {
  const blocks = resolveBlocksForExport(request.html, request.blocks);
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase);

  const fountainText = buildFountainString(blocks);

  const blob = new Blob([fountainText], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(`${fileBase}.fountain`, blob);
};

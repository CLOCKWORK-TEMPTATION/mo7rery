import type { ExtractedLine } from "../types.js";

const ARTIFACT_PATTERNS: RegExp[] = [
    /^\s*\d+\s*$/,                   // رقم صفحة فقط
    /^\s*[-—–]{3,}\s*$/,             // فواصل
    /^\s*Page\s+\d+\s*$/i,
    /^\s*<!--.*-->\s*$/i,
];

export function markAndFilterArtifacts(lines: ExtractedLine[]): ExtractedLine[] {
    const out: ExtractedLine[] = [];

    for (const line of lines) {
        const txt = line.text.trim();

        let artifact = false;
        for (const rx of ARTIFACT_PATTERNS) {
            if (rx.test(txt)) {
                artifact = true;
                break;
            }
        }

        if (artifact) {
            line.flags.push("artifact");
            line.quality.probableArtifact = true;
            // نحذف artifacts الواضحة
            continue;
        }

        out.push(line);
    }

    return out;
}

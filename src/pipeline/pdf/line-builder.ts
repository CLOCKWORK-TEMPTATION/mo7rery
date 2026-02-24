import type { ExtractedLine, TextItem } from "../types.js";
import { normalizeSpaces } from "../normalize.js";

type BuildOpts = {
    yTolerance: number;
    xGapMergeThreshold: number;
    minSpaceInsertGap: number;
};

function sortReadingOrder(items: TextItem[]): TextItem[] {
    // ترتيب تقريبي مناسب للعربية/النصوص العادية:
    // من أعلى لأسفل، ثم من اليسار لليمين داخل نفس السطر.
    // ملاحظة: العربية نفسها داخل item.str بالفعل غالبًا محفوظة بالترتيب النصي.
    return [...items].sort((a, b) => {
        const dy = Math.abs(b.y - a.y);
        if (dy > 2) return b.y - a.y; // PDF.js origin غالبًا أسفل الصفحة
        return a.x - b.x;
    });
}

function groupByLineY(items: TextItem[], yTolerance: number): TextItem[][] {
    const sorted = sortReadingOrder(items);
    const lines: TextItem[][] = [];

    for (const item of sorted) {
        let placed = false;
        for (const line of lines) {
            const avgY = line.reduce((s, it) => s + it.y, 0) / line.length;
            if (Math.abs(item.y - avgY) <= yTolerance) {
                line.push(item);
                placed = true;
                break;
            }
        }
        if (!placed) lines.push([item]);
    }

    // إعادة ترتيب الأسطر من أعلى لأسفل بصريًا
    lines.sort((a, b) => {
        const ay = a.reduce((s, it) => s + it.y, 0) / a.length;
        const by = b.reduce((s, it) => s + it.y, 0) / b.length;
        return by - ay;
    });

    return lines;
}

function lineTextFromItems(items: TextItem[], opts: BuildOpts): string {
    // داخل السطر: ترتيب حسب x
    const sorted = [...items].sort((a, b) => a.x - b.x);
    let out = "";
    let prev: TextItem | null = null;

    for (const it of sorted) {
        const t = it.text ?? "";
        if (!t) continue;

        if (!prev) {
            out += t;
            prev = it;
            continue;
        }

        const prevRight = prev.x + prev.w;
        const gap = it.x - prevRight;

        if (gap >= opts.minSpaceInsertGap && gap <= opts.xGapMergeThreshold) {
            out += " ";
        }
        // إذا gap صغير جدًا: غالبًا نفس الكلمة/كتلة
        // إذا gap كبير جدًا: نترك كما هو الآن؛ يمكن لاحقًا تحسينه حسب layout
        out += t;
        prev = it;
    }

    return normalizeSpaces(out);
}

export function buildLinesFromTextItems(
    page: number,
    items: TextItem[],
    opts: BuildOpts
): ExtractedLine[] {
    const groups = groupByLineY(items, opts.yTolerance);

    return groups
        .map((group, i): ExtractedLine => {
            const text = lineTextFromItems(group, opts);
            const xs = group.map((g) => g.x);
            const ys = group.map((g) => g.y);
            const rs = group.map((g) => g.x + g.w);
            const ts = group.map((g) => g.y + g.h);

            return {
                id: `p${page}_l${i}`,
                page,
                lineNoOnPage: i,
                text,
                source: "text-layer",
                bbox: {
                    x: Math.min(...xs),
                    y: Math.min(...ys),
                    w: Math.max(...rs) - Math.min(...xs),
                    h: Math.max(...ts) - Math.min(...ys),
                },
                items: group,
                quality: {
                    score: 1,
                    reasons: [],
                    weirdCharRatio: 0,
                    arabicRatio: 0,
                    digitRatio: 0,
                    punctuationRatio: 0,
                    hasBrokenArabicPattern: false,
                    suspiciousDialoguePattern: false,
                    probableArtifact: false,
                },
                flags: [],
            };
        })
        .filter((l) => l.text.length > 0);
}

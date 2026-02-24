/**
 * @file input-sanitizer.test.ts
 * @description Comprehensive unit tests for the input sanitizer (Pipeline 0)
 */

import { describe, expect, it } from "vitest";
import {
  sanitizeInput,
  needsSanitization,
} from "../../../src/pipeline/input-sanitizer";

// ─── Suite 1: pstyle-bracket-prefix ──────────────────────────────────

describe("pstyle-bracket-prefix", () => {
  it("strips [pStyle=-] from all lines of a multi-line text", () => {
    const input = `[pStyle=-] بسم الله الرحمن الرحيم
[pStyle=-] مشهد1
[pStyle=-] شقة سيد مونسة`;

    const result = sanitizeInput(input);

    expect(result.text).toBe(`بسم الله الرحمن الرحيم
مشهد1
شقة سيد مونسة`);
    expect(result.report.wasModified).toBe(true);
  });

  it("strips [pStyle=Heading1] with different values", () => {
    const input = `[pStyle=Heading1] عنوان رئيسي
[pStyle=Normal] نص عادي
[pStyle=Title] العنوان`;

    const result = sanitizeInput(input);

    expect(result.text).toBe(`عنوان رئيسي
نص عادي
العنوان`);
    expect(result.report.wasModified).toBe(true);
  });

  it("preserves Arabic text after the prefix", () => {
    const input = "[pStyle=-] بسمة : 28 مليون جنيه";
    const result = sanitizeInput(input);

    expect(result.text).toBe("بسمة : 28 مليون جنيه");
  });

  it("lines without prefix remain unchanged", () => {
    const input = `هذا سطر عادي
وهذا سطر آخر
بدون بادئات`;

    const result = sanitizeInput(input);

    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
  });

  it("mixed lines: some with prefix, some without", () => {
    const input = `[pStyle=-] سطر مع بادئة
سطر بدون بادئة
[pStyle=-] سطر آخر مع بادئة`;

    const result = sanitizeInput(input);

    expect(result.text).toBe(`سطر مع بادئة
سطر بدون بادئة
سطر آخر مع بادئة`);
  });

  it("reports correct matchCount", () => {
    const input = `[pStyle=-] سطر 1
[pStyle=-] سطر 2
سطر عادي
[pStyle=-] سطر 3`;

    const result = sanitizeInput(input);
    const rule = result.report.rulesApplied.find(
      (r) => r.ruleId === "pstyle-bracket-prefix"
    );

    expect(rule?.applied).toBe(true);
    expect(rule?.matchCount).toBe(3);
    expect(result.report.totalMatchCount).toBe(3);
  });

  it("reports sampleMatches (max 3)", () => {
    const input = `[pStyle=-] سطر 1
[pStyle=Heading1] سطر 2
[pStyle=Normal] سطر 3
[pStyle=Title] سطر 4
[pStyle=Custom] سطر 5`;

    const result = sanitizeInput(input);
    const rule = result.report.rulesApplied.find(
      (r) => r.ruleId === "pstyle-bracket-prefix"
    );

    expect(rule?.sampleMatches).toHaveLength(3);
    expect(rule?.sampleMatches[0]).toBe("[pStyle=-]");
    expect(rule?.sampleMatches[1]).toBe("[pStyle=Heading1]");
    expect(rule?.sampleMatches[2]).toBe("[pStyle=Normal]");
  });

  it("scene header line becomes clean: [pStyle=-] مشهد1\\t\\t\\t\\t\\t\\t\\t\\t\\tنهار -داخلي → مشهد1\\t\\t\\t\\t\\t\\t\\t\\t\\tنهار -داخلي", () => {
    const input = "[pStyle=-] مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي";
    const result = sanitizeInput(input);

    expect(result.text).toBe("مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي");
  });
});

// ─── Suite 2: xml-artifact-tags ──────────────────────────────────────

describe("xml-artifact-tags", () => {
  it("strips <w:r> and </w:r> tags", () => {
    const input = "<w:r>نص داخل وسم</w:r>";
    const result = sanitizeInput(input);

    expect(result.text).toBe("نص داخل وسم");
    expect(result.report.wasModified).toBe(true);
  });

  it('strips tags with attributes: <w:t xml:space="preserve">', () => {
    const input = '<w:t xml:space="preserve">نص محفوظ</w:t>';
    const result = sanitizeInput(input);

    expect(result.text).toBe("نص محفوظ");
  });

  it("preserves text between tags: <w:t>مرحبا</w:t> → مرحبا", () => {
    const input = "<w:t>مرحبا</w:t>";
    const result = sanitizeInput(input);

    expect(result.text).toBe("مرحبا");
  });

  it("strips multiple XML artifacts in one line", () => {
    const input =
      '<w:r><w:rPr></w:rPr><w:t xml:space="preserve">مرحبا بكم</w:t></w:r>';
    const result = sanitizeInput(input);

    expect(result.text).toBe("مرحبا بكم");
  });

  it("does NOT strip regular HTML tags like <p>, <div>", () => {
    const input = "<p>هذا نص في فقرة</p><div>وهذا في div</div>";
    const result = sanitizeInput(input);

    // Regular HTML tags are NOT handled by this rule (handled elsewhere)
    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
  });

  it("reports correct matchCount for XML tags", () => {
    const input = "<w:r><w:t>نص</w:t></w:r>";
    const result = sanitizeInput(input);
    const rule = result.report.rulesApplied.find(
      (r) => r.ruleId === "xml-artifact-tags"
    );

    expect(rule?.applied).toBe(true);
    expect(rule?.matchCount).toBe(4); // <w:r>, <w:t>, </w:t>, </w:r>
  });
});

// ─── Suite 3: word-field-codes ───────────────────────────────────────

describe("word-field-codes", () => {
  it('strips {HYPERLINK "https://example.com"}', () => {
    const input = 'زيارة {HYPERLINK "https://example.com"} للمزيد';
    const result = sanitizeInput(input);

    expect(result.text).toBe("زيارة  للمزيد");
    expect(result.report.wasModified).toBe(true);
  });

  it('strips {PAGE }, {TOC \\o "1-3"}', () => {
    const input1 = "صفحة {PAGE } من التقرير";
    const result1 = sanitizeInput(input1);

    expect(result1.text).toBe("صفحة  من التقرير");

    const input2 = 'جدول المحتويات {TOC \\o "1-3"} هنا';
    const result2 = sanitizeInput(input2);

    expect(result2.text).toBe("جدول المحتويات  هنا");
  });

  it("does NOT strip normal curly braces in Arabic text like {مثال}", () => {
    const input = "هذا نص عادي {مثال} بأقواس";
    const result = sanitizeInput(input);

    // No field code pattern (requires uppercase letters followed by space)
    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
  });

  it("requires uppercase letters and space to match", () => {
    const input1 = "{lowercase text}";
    const result1 = sanitizeInput(input1);
    expect(result1.text).toBe(input1);

    const input2 = "{UPPERCASE}"; // No space after
    const result2 = sanitizeInput(input2);
    expect(result2.text).toBe(input2);

    const input3 = "{PAGE }"; // Valid: uppercase + space
    const result3 = sanitizeInput(input3);
    expect(result3.text).toBe("");
  });

  it("reports sampleMatches for field codes", () => {
    const input = '{HYPERLINK "url1"} {PAGE } {TOC \\o "1-3"} {REF bookmark}';
    const result = sanitizeInput(input);
    const rule = result.report.rulesApplied.find(
      (r) => r.ruleId === "word-field-codes"
    );

    expect(rule?.applied).toBe(true);
    expect(rule?.matchCount).toBe(4);
    expect(rule?.sampleMatches).toHaveLength(3); // Max 3 samples
  });
});

// ─── Suite 4: double-bracket-metadata ────────────────────────────────

describe("double-bracket-metadata", () => {
  it("strips [style=font-weight:bold] from line starts", () => {
    const input = "[style=font-weight:bold] نص غامق";
    const result = sanitizeInput(input);

    expect(result.text).toBe("نص غامق");
    expect(result.report.wasModified).toBe(true);
  });

  it("strips [class=MsoNormal] from line starts", () => {
    const input = "[class=MsoNormal] فقرة عادية";
    const result = sanitizeInput(input);

    expect(result.text).toBe("فقرة عادية");
  });

  it("strips multiple metadata types: style, class, lang, align, dir", () => {
    const input = `[style=color:red] سطر 1
[class=heading] سطر 2
[lang=ar-SA] سطر 3
[align=center] سطر 4
[dir=rtl] سطر 5`;

    const result = sanitizeInput(input);

    expect(result.text).toBe(`سطر 1
سطر 2
سطر 3
سطر 4
سطر 5`);
  });

  it("does NOT strip brackets in the middle of a line", () => {
    const input = "نص عادي [style=bold] في الوسط";
    const result = sanitizeInput(input);

    // Only strips from line start
    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
  });

  it("reports correct matchCount", () => {
    const input = `[style=bold] سطر 1
[class=Normal] سطر 2
سطر عادي
[lang=ar] سطر 3`;

    const result = sanitizeInput(input);
    const rule = result.report.rulesApplied.find(
      (r) => r.ruleId === "double-bracket-metadata"
    );

    expect(rule?.applied).toBe(true);
    expect(rule?.matchCount).toBe(3);
  });
});

// ─── Suite 5: zero-width-clusters ────────────────────────────────────

describe("zero-width-clusters", () => {
  it("strips 3+ consecutive zero-width chars", () => {
    // U+200B (ZWSP) repeated 5 times
    const zwsp = "\u200B\u200B\u200B\u200B\u200B";
    const input = `نص قبل${zwsp}نص بعد`;
    const result = sanitizeInput(input);

    expect(result.text).toBe("نص قبلنص بعد");
    expect(result.report.wasModified).toBe(true);
  });

  it("does NOT strip single or double zero-width chars (may be intentional RTL markers)", () => {
    // Single RLM (U+200F)
    const input1 = "نص\u200Fعربي";
    const result1 = sanitizeInput(input1);
    expect(result1.text).toBe(input1);

    // Double ZWNJ (U+200C)
    const input2 = "نص\u200C\u200Cعربي";
    const result2 = sanitizeInput(input2);
    expect(result2.text).toBe(input2);
  });

  it("strips exactly 3 zero-width chars (minimum cluster)", () => {
    const input = "نص\u200B\u200B\u200Bعربي";
    const result = sanitizeInput(input);

    expect(result.text).toBe("نصعربي");
  });

  it("handles multiple clusters in same text", () => {
    const cluster1 = "\u200B\u200B\u200B";
    const cluster2 = "\u200E\u200E\u200E\u200E";
    const input = `أول${cluster1}ثاني${cluster2}ثالث`;
    const result = sanitizeInput(input);

    expect(result.text).toBe("أولثانيثالث");
  });

  it("reports sample as [N zero-width chars]", () => {
    const cluster = "\u200B\u200B\u200B\u200B\u200B";
    const input = `نص${cluster}عربي`;
    const result = sanitizeInput(input);
    const rule = result.report.rulesApplied.find(
      (r) => r.ruleId === "zero-width-clusters"
    );

    expect(rule?.applied).toBe(true);
    expect(rule?.matchCount).toBe(1);
    expect(rule?.sampleMatches[0]).toBe("[5 zero-width chars]");
  });

  it("handles all zero-width char types: ZWSP, ZWNJ, ZWJ, LRM, RLM, ALM, BOM", () => {
    const mixed = "\u200B\u200C\u200D"; // ZWSP + ZWNJ + ZWJ = 3 chars
    const input = `نص${mixed}عربي`;
    const result = sanitizeInput(input);

    expect(result.text).toBe("نصعربي");
  });
});

// ─── Suite 6: needsSanitization() ────────────────────────────────────

describe("needsSanitization()", () => {
  it("returns true for text with [pStyle=-]", () => {
    const input = "[pStyle=-] بسم الله";
    expect(needsSanitization(input)).toBe(true);
  });

  it("returns true for text with XML artifacts", () => {
    const input = "<w:r>نص</w:r>";
    expect(needsSanitization(input)).toBe(true);
  });

  it("returns true for text with field codes", () => {
    const input = '{HYPERLINK "url"}';
    expect(needsSanitization(input)).toBe(true);
  });

  it("returns true for text with metadata brackets", () => {
    const input = "[style=bold] نص";
    expect(needsSanitization(input)).toBe(true);
  });

  it("returns true for text with zero-width clusters", () => {
    const input = "نص\u200B\u200B\u200Bعربي";
    expect(needsSanitization(input)).toBe(true);
  });

  it("returns false for clean Arabic text", () => {
    const input = "بسم الله الرحمن الرحيم";
    expect(needsSanitization(input)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(needsSanitization("")).toBe(false);
  });

  it("returns false for text with normal brackets", () => {
    const input = "نص عادي [مثال] بأقواس {عادية}";
    expect(needsSanitization(input)).toBe(false);
  });
});

// ─── Suite 7: Composability ──────────────────────────────────────────

describe("composability", () => {
  it("text with BOTH pstyle prefixes AND XML artifacts gets both cleaned", () => {
    const input = "[pStyle=-] <w:r>بسم الله</w:r>";
    const result = sanitizeInput(input);

    expect(result.text).toBe("بسم الله");
    expect(result.report.wasModified).toBe(true);

    const pstyleRule = result.report.rulesApplied.find(
      (r) => r.ruleId === "pstyle-bracket-prefix"
    );
    const xmlRule = result.report.rulesApplied.find(
      (r) => r.ruleId === "xml-artifact-tags"
    );

    expect(pstyleRule?.applied).toBe(true);
    expect(xmlRule?.applied).toBe(true);
  });

  it("report shows multiple rules applied", () => {
    const input = `[pStyle=-] <w:t>نص</w:t> {PAGE }`;
    const result = sanitizeInput(input);

    const appliedRules = result.report.rulesApplied.filter((r) => r.applied);
    expect(appliedRules).toHaveLength(3); // pstyle, xml, field-codes

    expect(appliedRules.map((r) => r.ruleId)).toContain(
      "pstyle-bracket-prefix"
    );
    expect(appliedRules.map((r) => r.ruleId)).toContain("xml-artifact-tags");
    expect(appliedRules.map((r) => r.ruleId)).toContain("word-field-codes");
  });

  it("all 5 rules can be applied in sequence", () => {
    const zwsp = "\u200B\u200B\u200B";
    const input = `[pStyle=-] [style=bold] <w:r>{PAGE }نص${zwsp}</w:r>`;
    const result = sanitizeInput(input);

    const appliedRules = result.report.rulesApplied.filter((r) => r.applied);
    expect(appliedRules).toHaveLength(5); // All rules applied
  });
});

// ─── Suite 8: Edge cases ─────────────────────────────────────────────

describe("edge cases", () => {
  it("empty string: returns empty, wasModified=false", () => {
    const result = sanitizeInput("");

    expect(result.text).toBe("");
    expect(result.report.wasModified).toBe(false);
    expect(result.report.totalMatchCount).toBe(0);
    expect(result.report.inputLineCount).toBe(1); // Empty string is 1 line
    expect(result.report.outputLineCount).toBe(1);
  });

  it("single line without any artifacts: passthrough", () => {
    const input = "بسم الله الرحمن الرحيم";
    const result = sanitizeInput(input);

    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
    expect(result.report.totalMatchCount).toBe(0);
  });

  it("very long text (100+ lines) still works", () => {
    const lines = Array.from({ length: 150 }, (_, i) => `[pStyle=-] سطر ${i}`);
    const input = lines.join("\n");
    const result = sanitizeInput(input);

    expect(result.report.inputLineCount).toBe(150);
    expect(result.report.wasModified).toBe(true);
    expect(result.report.totalMatchCount).toBe(150);
    // All pstyle prefixes should be removed
    expect(result.text).not.toContain("[pStyle=-]");
  });

  it("regular square brackets [مثال] are NOT stripped (no false positives)", () => {
    const input = "هذا نص [مثال] عادي";
    const result = sanitizeInput(input);

    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
  });

  it("brackets in dialogue: بسمة : أنا [متعبة] preserved", () => {
    const input = "بسمة : أنا [متعبة] جداً";
    const result = sanitizeInput(input);

    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
  });

  it("preserves empty lines", () => {
    const input = `سطر أول

سطر ثالث`;
    const result = sanitizeInput(input);

    expect(result.text).toBe(input);
    expect(result.report.inputLineCount).toBe(3);
    expect(result.report.outputLineCount).toBe(3);
  });

  it("preserves whitespace in text (only strips prefix whitespace)", () => {
    const input = "[pStyle=-]   نص بمسافات    كثيرة  ";
    const result = sanitizeInput(input);

    // Prefix and its trailing space removed, but text whitespace preserved
    expect(result.text).toBe("نص بمسافات    كثيرة  ");
  });

  it("handles text with only whitespace", () => {
    const input = "   \t  \n  \t  ";
    const result = sanitizeInput(input);

    expect(result.text).toBe(input);
    expect(result.report.wasModified).toBe(false);
  });

  it("report.durationMs is a positive number", () => {
    const result = sanitizeInput("بسم الله");

    expect(result.report.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.report.durationMs).toBe("number");
  });

  it("all rules in rulesApplied array even if not applied", () => {
    const input = "نص نظيف";
    const result = sanitizeInput(input);

    expect(result.report.rulesApplied).toHaveLength(5);

    const ruleIds = result.report.rulesApplied.map((r) => r.ruleId);
    expect(ruleIds).toContain("pstyle-bracket-prefix");
    expect(ruleIds).toContain("xml-artifact-tags");
    expect(ruleIds).toContain("word-field-codes");
    expect(ruleIds).toContain("double-bracket-metadata");
    expect(ruleIds).toContain("zero-width-clusters");

    // All should be applied=false
    result.report.rulesApplied.forEach((rule) => {
      expect(rule.applied).toBe(false);
      expect(rule.matchCount).toBe(0);
      expect(rule.sampleMatches).toHaveLength(0);
    });
  });
});

// ─── Suite 9: Real-world regression test ─────────────────────────────

describe("real-world regression test", () => {
  it("bug report: strips all [pStyle=-] prefixes and preserves content", () => {
    const input = `[pStyle=-] بسم الله الرحمن الرحيم
[pStyle=-] مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي
[pStyle=-] شقة سيد مونسة  — الصالة
[pStyle=-] فرق شقة يبدو عليها الاتساع الشديد
[pStyle=-] بسمة : 28 مليون جنيه
[pStyle=-] قطع`;

    const result = sanitizeInput(input);

    // All prefixes removed
    expect(result.text).not.toContain("[pStyle=-]");

    // Content preserved exactly
    const expectedLines = [
      "بسم الله الرحمن الرحيم",
      "مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي",
      "شقة سيد مونسة  — الصالة",
      "فرق شقة يبدو عليها الاتساع الشديد",
      "بسمة : 28 مليون جنيه",
      "قطع",
    ];
    expect(result.text).toBe(expectedLines.join("\n"));

    // Report validation
    expect(result.report.wasModified).toBe(true);
    expect(result.report.totalMatchCount).toBe(6); // 6 lines with prefixes

    const pstyleRule = result.report.rulesApplied.find(
      (r) => r.ruleId === "pstyle-bracket-prefix"
    );
    expect(pstyleRule?.applied).toBe(true);
    expect(pstyleRule?.matchCount).toBe(6);
    expect(pstyleRule?.sampleMatches).toHaveLength(3); // Max 3 samples
    expect(pstyleRule?.sampleMatches[0]).toBe("[pStyle=-]");
  });

  it("bug report: line count matches", () => {
    const input = `[pStyle=-] بسم الله الرحمن الرحيم
[pStyle=-] مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي
[pStyle=-] شقة سيد مونسة  — الصالة
[pStyle=-] فرق شقة يبدو عليها الاتساع الشديد
[pStyle=-] بسمة : 28 مليون جنيه
[pStyle=-] قطع`;

    const result = sanitizeInput(input);

    expect(result.report.inputLineCount).toBe(6);
    expect(result.report.outputLineCount).toBe(6);
  });

  it("bug report: tabs preserved in scene headers", () => {
    const input = "[pStyle=-] مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي";
    const result = sanitizeInput(input);

    // Count tabs
    const tabCount = (result.text.match(/\t/g) || []).length;
    expect(tabCount).toBe(9);
    expect(result.text).toBe("مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي");
  });

  it("real PDF import: mixed artifacts", () => {
    const input = `[pStyle=Title] <w:r><w:t>العنوان الرئيسي</w:t></w:r>
[pStyle=Normal] مشهد 1 {PAGE }
<w:r>وصف المشهد</w:r>
[style=font-weight:bold] شخصية: حوار هنا`;

    const result = sanitizeInput(input);

    const expectedLines = [
      "العنوان الرئيسي",
      "مشهد 1 ",
      "وصف المشهد",
      "شخصية: حوار هنا",
    ];
    expect(result.text).toBe(expectedLines.join("\n"));

    // Multiple rules applied
    const appliedRules = result.report.rulesApplied.filter((r) => r.applied);
    expect(appliedRules.length).toBeGreaterThanOrEqual(3);
  });
});

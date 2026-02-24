/**
 * @file sanitized-import-pipeline.test.ts
 * @description اختبارات لوحدة تنسيق خط أنابيب الاستيراد المُطهّر
 * Tests for the sanitized import pipeline orchestrator
 */

import { describe, it, expect } from "vitest";
import {
  shouldUseSanitizedPipeline,
  runSanitizedImportPipeline,
  type SanitizedImportResult,
} from "../../../src/pipeline/sanitized-import-pipeline";

describe("shouldUseSanitizedPipeline()", () => {
  it("returns true for text with [pStyle=-] prefixes", () => {
    const text = "[pStyle=-] بسم الله الرحمن الرحيم";
    expect(shouldUseSanitizedPipeline(text)).toBe(true);
  });

  it("returns true for text with <w:r> XML artifacts", () => {
    const text = "<w:r><w:t>مشهد1</w:t></w:r>";
    expect(shouldUseSanitizedPipeline(text)).toBe(true);
  });

  it("returns false for clean Arabic text", () => {
    const text = "بسم الله الرحمن الرحيم\nمشهد1\t\tنهار -داخلي";
    expect(shouldUseSanitizedPipeline(text)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(shouldUseSanitizedPipeline("")).toBe(false);
  });
});

describe("runSanitizedImportPipeline() — with non-standard input", () => {
  it("strips [pStyle=-] prefixes and returns clean text", () => {
    const input = "[pStyle=-] بسم الله الرحمن الرحيم";
    const result = runSanitizedImportPipeline(input);

    expect(result.cleanText).toBe("بسم الله الرحمن الرحيم");
    expect(result.cleanText).not.toContain("[pStyle=-]");
  });

  it("wasModified is true", () => {
    const input = "[pStyle=-] مشهد1";
    const result = runSanitizedImportPipeline(input);

    expect(result.wasModified).toBe(true);
  });

  it("originalText preserves original", () => {
    const input = "[pStyle=-] بسم الله الرحمن الرحيم";
    const result = runSanitizedImportPipeline(input);

    expect(result.originalText).toBe(input);
  });

  it("cleanText differs from originalText", () => {
    const input = "[pStyle=-] مشهد1";
    const result = runSanitizedImportPipeline(input);

    expect(result.cleanText).not.toBe(result.originalText);
  });

  it("sanitizationReport.totalMatchCount > 0", () => {
    const input = "[pStyle=-] بسم الله\n[pStyle=-] مشهد1";
    const result = runSanitizedImportPipeline(input);

    expect(result.sanitizationReport.totalMatchCount).toBeGreaterThan(0);
  });

  it("scene header is clean after sanitization", () => {
    const input = "[pStyle=-] مشهد1\t\tنهار -داخلي";
    const result = runSanitizedImportPipeline(input);

    expect(result.cleanText).toMatch(/^مشهد1/);
    expect(result.cleanText).not.toContain("[pStyle=-]");
  });
});

describe("runSanitizedImportPipeline() — with clean input", () => {
  it("returns same text when no sanitization needed", () => {
    const input = "بسم الله الرحمن الرحيم\nمشهد1\t\tنهار -داخلي";
    const result = runSanitizedImportPipeline(input);

    expect(result.cleanText).toBe(input);
  });

  it("wasModified is false", () => {
    const input = "بسم الله الرحمن الرحيم";
    const result = runSanitizedImportPipeline(input);

    expect(result.wasModified).toBe(false);
  });

  it("cleanText equals originalText", () => {
    const input = "مشهد1\t\tنهار -داخلي\nوصف المشهد";
    const result = runSanitizedImportPipeline(input);

    expect(result.cleanText).toBe(result.originalText);
  });

  it("sanitizationReport.totalMatchCount is 0", () => {
    const input = "بسم الله الرحمن الرحيم";
    const result = runSanitizedImportPipeline(input);

    expect(result.sanitizationReport.totalMatchCount).toBe(0);
  });
});

describe("runSanitizedImportPipeline() — full regression test", () => {
  const realInput = `[pStyle=-] بسم الله الرحمن الرحيم
[pStyle=-] مشهد1\t\t\t\t\t\t\t\t\tنهار -داخلي
[pStyle=-] شقة سيد مونسة  — الصالة
[pStyle=-] بسمة : 28 مليون جنيه
[pStyle=-] قطع`;

  let result: SanitizedImportResult;

  it("all prefixes removed", () => {
    result = runSanitizedImportPipeline(realInput);
    expect(result.cleanText).not.toContain("[pStyle=-]");
  });

  it("first line is بسم الله الرحمن الرحيم", () => {
    result = runSanitizedImportPipeline(realInput);
    const lines = result.cleanText.split("\n");
    expect(lines[0]).toBe("بسم الله الرحمن الرحيم");
  });

  it("last line is قطع", () => {
    result = runSanitizedImportPipeline(realInput);
    const lines = result.cleanText.split("\n");
    expect(lines[lines.length - 1]).toBe("قطع");
  });

  it("wasModified is true", () => {
    result = runSanitizedImportPipeline(realInput);
    expect(result.wasModified).toBe(true);
  });

  it("report shows pstyle-bracket-prefix rule applied", () => {
    result = runSanitizedImportPipeline(realInput);
    const appliedRule = result.sanitizationReport.rulesApplied.find(
      (r) => r.ruleId === "pstyle-bracket-prefix"
    );
    expect(appliedRule).toBeDefined();
    expect(appliedRule?.matchCount).toBeGreaterThan(0);
  });
});

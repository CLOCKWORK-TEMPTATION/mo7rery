/**
 * اختبار B — Trust Policy
 * يتحقق من تقييم مستويات الثقة وتحديد مسار المعالجة
 */
import { describe, expect, it } from "vitest";
import {
  assessTrustLevel,
  resolveImportAction,
} from "../../../src/pipeline/trust-policy";
import type { StructuredInput } from "../../../src/pipeline/trust-policy";

/* ─── مساعدات البناء ────────────────────────────────────────────── */

const validBlock = (type = "action", text = "يدخل أحمد الغرفة") => ({
  type,
  text,
});

const trustedInput = (): StructuredInput => ({
  blocks: [validBlock(), validBlock("dialogue", "مرحباً يا أصدقاء")],
  source: "filmlane-internal",
  systemGenerated: true,
  schemaValid: true,
  integrityChecked: true,
});

/* ─── الاختبارات ────────────────────────────────────────────────── */

describe("assessTrustLevel", () => {
  it("يُرجع trusted_structured عند استيفاء جميع المعايير", () => {
    const result = assessTrustLevel(trustedInput());
    expect(result.level).toBe("trusted_structured");
    expect(result.isSystemGenerated).toBe(true);
    expect(result.isSchemaValid).toBe(true);
    expect(result.isSourceTagged).toBe(true);
    expect(result.isIntegrityChecked).toBe(true);
  });

  it("يُرجع semi_structured عندما المخطط صالح لكن المعايير غير مكتملة", () => {
    const result = assessTrustLevel({
      blocks: [validBlock()],
      source: "external",
      systemGenerated: false,
      schemaValid: true,
    });
    expect(result.level).toBe("semi_structured");
  });

  it("يُرجع raw_text عندما المخطط غير صالح", () => {
    const result = assessTrustLevel({
      blocks: [{ type: "invalid-type", text: "test" }],
    });
    expect(result.level).toBe("raw_text");
  });

  it("يُرجع raw_text عندما الكتل فارغة", () => {
    const result = assessTrustLevel({ blocks: [] });
    expect(result.level).toBe("raw_text");
  });

  it("يُرجع raw_text عندما النص فارغ", () => {
    const result = assessTrustLevel({
      blocks: [{ type: "action", text: "   " }],
    });
    expect(result.level).toBe("raw_text");
  });

  it("يُرجع semi_structured إذا غاب systemGenerated", () => {
    const result = assessTrustLevel({
      blocks: [validBlock()],
      source: "paste",
      schemaValid: true,
      integrityChecked: true,
    });
    expect(result.level).toBe("semi_structured");
  });
});

describe("resolveImportAction", () => {
  it("trusted_structured → direct_import_with_bg_check", () => {
    expect(resolveImportAction("trusted_structured")).toBe(
      "direct_import_with_bg_check"
    );
  });

  it("semi_structured → fallback_to_classifier", () => {
    expect(resolveImportAction("semi_structured")).toBe(
      "fallback_to_classifier"
    );
  });

  it("raw_text → fallback_to_classifier", () => {
    expect(resolveImportAction("raw_text")).toBe("fallback_to_classifier");
  });
});

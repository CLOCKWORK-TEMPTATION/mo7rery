/**
 * اختبارات وحدة لـ isStandaloneBasmalaLine
 *
 * يغطي:
 * - بسملة مستقلة صحيحة (مع/بدون تشكيل/مسافات/أقواس)
 * - بسملة داخل سطر حواري (name: بسملة) → false
 * - حرف Unicode ﷽ → true
 * - حالات حدية (فارغ، نص عشوائي)
 */

import { describe, expect, it } from "vitest";
import {
  isBasmalaLine,
  isStandaloneBasmalaLine,
} from "../../../src/extensions/basmala";

describe("isStandaloneBasmalaLine — قبول بسملة مستقلة", () => {
  it("بسملة كاملة بدون تشكيل", () => {
    expect(isStandaloneBasmalaLine("بسم الله الرحمن الرحيم")).toBe(true);
  });

  it("بسملة بمسافات زائدة", () => {
    expect(isStandaloneBasmalaLine("  بسم الله الرحمن الرحيم  ")).toBe(true);
  });

  it("بسملة بأقواس", () => {
    expect(isStandaloneBasmalaLine("{بسم الله الرحمن الرحيم}")).toBe(true);
    expect(isStandaloneBasmalaLine("﴾بسم الله الرحمن الرحيم﴿")).toBe(true);
  });

  it("حرف Unicode الموحد ﷽", () => {
    expect(isStandaloneBasmalaLine("﷽")).toBe(true);
  });

  it("بسملة بتشكيل", () => {
    expect(isStandaloneBasmalaLine("بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ")).toBe(
      true
    );
  });
});

describe("isStandaloneBasmalaLine — رفض prefix حواري", () => {
  it("اسم شخصية : بسملة → false", () => {
    expect(isStandaloneBasmalaLine("بوسي : بسم الله الرحمن الرحيم")).toBe(
      false
    );
  });

  it("قال: بسملة → false", () => {
    expect(isStandaloneBasmalaLine("قال: بسم الله الرحمن الرحيم")).toBe(false);
  });

  it("أحمد : بسم الله → false", () => {
    expect(isStandaloneBasmalaLine("أحمد : بسم الله الرحمن الرحيم")).toBe(
      false
    );
  });

  it("full-width colon → false", () => {
    expect(isStandaloneBasmalaLine("بوسي ： بسم الله الرحمن الرحيم")).toBe(
      false
    );
  });
});

describe("isStandaloneBasmalaLine — حالات حدية", () => {
  it("نص فارغ → false", () => {
    expect(isStandaloneBasmalaLine("")).toBe(false);
  });

  it("null → false", () => {
    expect(isStandaloneBasmalaLine(null as unknown as string)).toBe(false);
  });

  it("نص عشوائي → false", () => {
    expect(isStandaloneBasmalaLine("يدخل أحمد الغرفة")).toBe(false);
  });

  it("بسم بدون الباقي → false", () => {
    expect(isStandaloneBasmalaLine("بسم")).toBe(false);
  });

  it("بسم الله فقط → false (ناقص الرحمن/الرحيم)", () => {
    expect(isStandaloneBasmalaLine("بسم الله")).toBe(false);
  });
});

describe("isBasmalaLine (الكاشف الواسع) — مقارنة سلوك", () => {
  it("بسملة مستقلة → true في الاثنين", () => {
    const text = "بسم الله الرحمن الرحيم";
    expect(isBasmalaLine(text)).toBe(true);
    expect(isStandaloneBasmalaLine(text)).toBe(true);
  });

  it("بسملة مع prefix → true في الواسع، false في الصارم", () => {
    const text = "بوسي : بسم الله الرحمن الرحيم";
    expect(isBasmalaLine(text)).toBe(true);
    expect(isStandaloneBasmalaLine(text)).toBe(false);
  });
});

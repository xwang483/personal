import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { excelSerialToIso, parseShipDate } from "../src/lib/dates.ts";
import { readIdentifier } from "../src/lib/identifiers.ts";
import { normalizePhone } from "../src/lib/phone.ts";

describe("phone normalization", () => {
  const accepted = [
    "13800001111",
    "138 0000 1111",
    "138-0000-1111",
    "+86 138 0000 1111",
    "+8613800001111",
    "008613800001111",
    "86 13800001111",
    "13800001111.0",
    "'13800001111",
    "１３８００００１１１１",
    "138.0000.1111",
  ];

  for (const value of accepted) {
    it(`accepts ${value}`, () => {
      assert.deepEqual(normalizePhone(value), { ok: true, phone: "13800001111" });
    });
  }

  it("accepts an Excel number", () => {
    assert.deepEqual(normalizePhone(13800001111), { ok: true, phone: "13800001111" });
  });

  it("rejects partial, wrong, and scientific numbers", () => {
    assert.equal(normalizePhone("1380000111").ok, false);
    assert.equal(normalizePhone("138000011112").ok, false);
    assert.equal(normalizePhone("12345678901").ok, false);
    assert.equal(normalizePhone("23800001111").ok, false);
    assert.equal(normalizePhone("").ok, false);
    assert.equal(normalizePhone("   ").ok, false);
    assert.equal(normalizePhone("1.3800001111e+10").ok, false);
    assert.equal(normalizePhone("13800001111' OR '1'='1").ok, false);
    const scientific = normalizePhone("1.38e10");
    assert.equal(scientific.ok, false);
    if (!scientific.ok) assert.equal(scientific.code, "precision");
  });
});

describe("dates and identifiers", () => {
  it("parses calendar dates and Excel serials", () => {
    assert.equal(parseShipDate("2026-03-02"), "2026-03-02");
    assert.equal(parseShipDate("2026/3/2"), "2026-03-02");
    assert.equal(parseShipDate("2026.3.2"), "2026-03-02");
    assert.equal(parseShipDate("2026年3月2日"), "2026-03-02");
    assert.equal(parseShipDate("20260302"), "2026-03-02");
    assert.equal(parseShipDate("2026-02-31"), null);
    assert.equal(excelSerialToIso(46083), "2026-03-02");
    assert.equal(parseShipDate(new Date(Date.UTC(2026, 2, 2))), "2026-03-02");
  });

  it("keeps text ids and warns on unsafe Excel numbers", () => {
    assert.deepEqual(readIdentifier("DEMO-SF-000001"), {
      empty: false,
      text: "DEMO-SF-000001",
      precisionLoss: false,
    });
    assert.deepEqual(readIdentifier("12345678901234567890"), {
      empty: false,
      text: "12345678901234567890",
      precisionLoss: false,
    });
    assert.equal(readIdentifier("123.0").text, "123");
    assert.equal(readIdentifier("123.0").precisionLoss, false);
    assert.equal(readIdentifier(13800001111).precisionLoss, false);
    assert.equal(readIdentifier(13800001111).text, "13800001111");
    const unsafe = readIdentifier(Number.MAX_SAFE_INTEGER + 2);
    assert.equal(unsafe.precisionLoss, true);
    assert.equal(readIdentifier("1.234567890123456789e+20").precisionLoss, true);
  });
});

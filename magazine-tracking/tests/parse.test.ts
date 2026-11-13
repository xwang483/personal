import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import { csvToSheet, decodeCsvBuffer } from "../src/lib/csv.ts";
import { parseSheet } from "../src/lib/parse-table.ts";
import { buildSampleCsv, buildTemplateCsv } from "../src/lib/samples.ts";
import { readUpload } from "../src/lib/upload.ts";

const header = "姓名,收货地址,邮寄方式,单号,日期,电话,,杂志名称,订单号";

describe("table import", () => {
  it("reads the fictional sample, ignores the blank column, and drops names", async () => {
    const parsed = await readUpload("虚构示例.csv", buildSampleCsv());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.encoding, "utf-8");
    assert.equal(parsed.table.validRows.length, 4);
    assert.ok(parsed.table.ignoredBlankColumns >= 1);
    assert.deepEqual(
      parsed.table.validRows.map((row) => row.phone).sort(),
      ["13800001111", "13800001111", "13900002222", "13900002222"].sort(),
    );
    const serialized = JSON.stringify(parsed.table.validRows);
    assert.equal(serialized.includes("虚构姓名"), false);
    assert.equal(serialized.includes("虚构地址"), false);
    assert.equal(serialized.includes("DEMO-ORDER-0001"), true);
  });

  it("reads GB18030 csv", async () => {
    const text = `${header}\n虚构姓名（不会被保存）,虚构地址（不会被保存）,顺丰速运,DEMO-SF-000001,2026-03-02,13800001111,,《刊林》（示例）,DEMO-ORDER-0001\n`;
    const buf = iconv.encode(text, "gb18030");
    assert.equal(decodeCsvBuffer(buf).encoding, "gb18030");
    const parsed = await readUpload("gb.csv", buf);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.table.validRows.length, 1);
    assert.equal(parsed.table.validRows[0]?.magazineName, "《刊林》（示例）");
  });

  it("rejects a missing header and an invalid phone without echoing the number", async () => {
    const missing = await readUpload("bad.csv", Buffer.from("姓名,单号\n甲,1\n", "utf8"));
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.match(missing.error, /电话/);

    const invalid = await readUpload(
      "bad.csv",
      Buffer.from(`${header}\n甲,地址,顺丰,DEMO-1,2026-03-02,1380000,,《刊林》（示例）,ORD\n`, "utf8"),
    );
    assert.equal(invalid.ok, true);
    if (!invalid.ok) return;
    assert.equal(invalid.table.validRows.length, 0);
    assert.equal(invalid.table.errors[0]?.field, "电话");
    assert.equal(JSON.stringify(invalid.table.errors).includes("1380000"), false);
  });

  it("collapses duplicate rows and warns on Excel precision loss", async () => {
    const duplicate = parseSheet(
      csvToSheet(
        `${header}\n甲,址,顺丰,DEMO-1,2026-03-02,13800001111,,杂志（示例）,ORD-1\n甲,址,顺丰,DEMO-1,2026-04-01,13800001111,,杂志（示例）,ORD-1\n`,
      ),
    );
    assert.equal(duplicate.ok, true);
    if (!duplicate.ok) return;
    assert.equal(duplicate.table.duplicateRows, 1);
    assert.equal(duplicate.table.validRows.length, 1);
    assert.equal(duplicate.table.validRows[0]?.shipDate, "2026-04-01");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("邮寄数据");
    sheet.addRow(["姓名", "收货地址", "邮寄方式", "单号", "日期", "电话", "", "杂志名称", "订单号"]);
    const lost = sheet.addRow(["甲", "址", "顺丰", Number.MAX_SAFE_INTEGER + 2, "2026-03-02", 13800001111, "", "杂志（示例）", "ORD-1"]);
    lost.getCell(4).value = Number.MAX_SAFE_INTEGER + 2;
    const kept = sheet.addRow(["乙", "址", "邮政", "12345678901234567890", new Date(Date.UTC(2026, 2, 2)), 13900002222, "", "另一本（示例）", "ORD-2"]);
    kept.getCell(4).numFmt = "@";
    const decoy = workbook.addWorksheet("不要读");
    decoy.addRow(["姓名", "收货地址", "邮寄方式", "单号", "日期", "电话", "", "杂志名称", "订单号"]);
    decoy.addRow(["丙", "秘密地址", "顺丰", "SHOULD-NOT-IMPORT", "2026-03-02", "13700003333", "", "不该出现", "ORD-9"]);
    const buf = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await readUpload("precision.xlsx", buf);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.table.validRows.length, 1);
    assert.equal(parsed.table.validRows[0]?.trackingNumber, "12345678901234567890");
    assert.equal(parsed.table.validRows[0]?.shipDate, "2026-03-02");
    assert.equal(parsed.table.errors.some((error) => error.field === "单号"), true);
    const blob = JSON.stringify(parsed.table);
    assert.equal(blob.includes("秘密地址"), false);
    assert.equal(blob.includes("SHOULD-NOT-IMPORT"), false);
  });

  it("rejects oversized and non-csv uploads", async () => {
    const big = await readUpload("big.csv", Buffer.alloc(5 * 1024 * 1024 + 1, 0x61));
    assert.equal(big.ok, false);
    if (!big.ok) assert.equal(big.status, 413);
    const text = await readUpload("notes.txt", Buffer.from(buildTemplateCsv()));
    assert.equal(text.ok, false);
    const fake = await readUpload("fake.xlsx", Buffer.from("not a workbook"));
    assert.equal(fake.ok, false);
  });
});

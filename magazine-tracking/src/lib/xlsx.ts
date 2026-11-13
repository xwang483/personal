import ExcelJS from "exceljs";
import { MAX_COLUMNS, MAX_SHEET_ROWS } from "@/lib/constants";
import type { RawCell, SheetRow } from "@/lib/types";

function unwrapExcelValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;

  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("");
  }
  if ("result" in value) {
    const result = value.result;
    if (result && typeof result === "object" && "error" in result) return null;
    return unwrapExcelValue(result as ExcelJS.CellValue);
  }
  if ("text" in value && typeof value.text === "string") return value.text;
  return null;
}

function readCell(cell: ExcelJS.Cell): RawCell {
  return {
    value: unwrapExcelValue(cell.value),
    text: typeof cell.text === "string" ? cell.text : "",
  };
}

export async function readXlsx(buf: Buffer): Promise<{ ok: true; rows: SheetRow[] } | { ok: false; error: string }> {
  if (buf.includes(Buffer.from("vbaProject.bin"))) {
    return { ok: false, error: "不支持带宏的工作簿。请另存为普通 .xlsx 后再上传。" };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buf as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  } catch {
    return { ok: false, error: "无法读取这个 Excel 文件。请上传未加密的 .xlsx。" };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "工作簿里没有工作表。" };

  const rowCount = sheet.rowCount;
  if (rowCount > MAX_SHEET_ROWS) {
    return { ok: false, error: `表格超过 ${MAX_SHEET_ROWS} 行，请拆分后再导入。` };
  }

  const columnCount = Math.min(sheet.columnCount || 0, MAX_COLUMNS);
  const rows: SheetRow[] = [];
  for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const cells: RawCell[] = [];
    for (let column = 1; column <= columnCount; column += 1) {
      cells.push(readCell(row.getCell(column)));
    }
    rows.push({ rowNumber, cells });
  }

  return { ok: true, rows };
}

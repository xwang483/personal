import {
  FIELD_LIMITS,
  MAX_DATA_ROWS,
  REQUIRED_HEADERS,
  type RequiredHeader,
} from "@/lib/constants";
import { parseShipDate } from "@/lib/dates";
import { hasControlChar, PRECISION_ID_MESSAGE, readIdentifier } from "@/lib/identifiers";
import { identityKey } from "@/lib/identity";
import { importPhoneMessage, normalizePhone } from "@/lib/phone";
import type { RowError, SheetRow, ValidRow } from "@/lib/types";

export type ParsedTable = {
  errors: RowError[];
  validRows: ValidRow[];
  blankRows: number;
  duplicateRows: number;
  totalDataRows: number;
  ignoredBlankColumns: number;
  ignoredColumns: string[];
};

export type ParseOutcome = { ok: true; table: ParsedTable } | { ok: false; error: string };

function cellText(cell: SheetRow["cells"][number] | undefined): string {
  if (!cell) return "";
  if (typeof cell.value === "string") return cell.value;
  if (typeof cell.text === "string" && cell.text) return cell.text;
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) return String(cell.value);
  return "";
}

function headerLabel(cell: SheetRow["cells"][number] | undefined): string {
  return cellText(cell).replace(/^\uFEFF/, "").normalize("NFKC").trim();
}

function plainText(cell: SheetRow["cells"][number] | undefined): string {
  if (!cell || cell.value == null) return "";
  if (cell.value instanceof Date) return "";
  if (typeof cell.value === "number") {
    if (!Number.isSafeInteger(cell.value)) return "";
    return String(cell.value);
  }
  if (typeof cell.value !== "string") return "";
  return cell.value.replace(/^\uFEFF/, "").trim();
}

function rowIsBlank(cells: SheetRow["cells"]): boolean {
  return cells.every((cell) => {
    if (cell.value == null || cell.value === "") return true;
    if (typeof cell.value === "string" && cell.value.trim() === "") return true;
    return false;
  });
}

export function parseSheet(rows: SheetRow[]): ParseOutcome {
  const headerIndex = rows.findIndex((row) => row.cells.some((cell) => headerLabel(cell) !== ""));
  if (headerIndex < 0) return { ok: false, error: "文件是空的。" };

  const headerRow = rows[headerIndex];
  const index: Partial<Record<RequiredHeader, number>> = {};
  const ignoredColumns: string[] = [];
  let ignoredBlankColumns = 0;

  headerRow.cells.forEach((cell, column) => {
    const label = headerLabel(cell);
    if (!label) {
      ignoredBlankColumns += 1;
      return;
    }
    if ((REQUIRED_HEADERS as readonly string[]).includes(label)) {
      const key = label as RequiredHeader;
      if (index[key] == null) index[key] = column;
      return;
    }
    ignoredColumns.push(label.slice(0, 40));
  });

  const missing = REQUIRED_HEADERS.filter((header) => index[header] == null);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `缺少表头：${missing.join("、")}。请使用模板，列名需要完全一致。空白间隔列可以保留。`,
    };
  }

  const errors: RowError[] = [];
  const pending: ValidRow[] = [];
  let blankRows = 0;
  let totalDataRows = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    if (rowIsBlank(row.cells)) {
      blankRows += 1;
      continue;
    }
    totalDataRows += 1;
    if (totalDataRows > MAX_DATA_ROWS) {
      return { ok: false, error: `数据行超过 ${MAX_DATA_ROWS} 行上限，请拆分后再导入。` };
    }

    const rowErrors: RowError[] = [];
    const at = (header: RequiredHeader) => row.cells[index[header] as number];

    let phone = "";
    const phoneCell = at("电话");
    const phoneId = readIdentifier(phoneCell?.value, phoneCell?.text);
    if (phoneId.precisionLoss) {
      rowErrors.push({ row: row.rowNumber, field: "电话", message: importPhoneMessage("precision") });
    } else {
      const normalized = normalizePhone(phoneId.empty ? "" : phoneId.text);
      if (!normalized.ok) {
        rowErrors.push({
          row: row.rowNumber,
          field: "电话",
          message: importPhoneMessage(normalized.code),
        });
      } else {
        phone = normalized.phone;
      }
    }

    let trackingNumber = "";
    const trackingCell = at("单号");
    const trackingId = readIdentifier(trackingCell?.value, trackingCell?.text);
    if (trackingId.precisionLoss) {
      rowErrors.push({ row: row.rowNumber, field: "单号", message: PRECISION_ID_MESSAGE });
    } else if (trackingId.empty) {
      rowErrors.push({ row: row.rowNumber, field: "单号", message: "单号为空。" });
    } else if (trackingId.text.length > FIELD_LIMITS.trackingNumber) {
      rowErrors.push({ row: row.rowNumber, field: "单号", message: "单号过长。" });
    } else if (hasControlChar(trackingId.text)) {
      rowErrors.push({ row: row.rowNumber, field: "单号", message: "单号含有无法使用的字符。" });
    } else {
      trackingNumber = trackingId.text;
    }

    let orderNumber = "";
    const orderCell = at("订单号");
    const orderId = readIdentifier(orderCell?.value, orderCell?.text);
    if (orderId.precisionLoss) {
      rowErrors.push({ row: row.rowNumber, field: "订单号", message: PRECISION_ID_MESSAGE });
    } else if (!orderId.empty) {
      if (orderId.text.length > FIELD_LIMITS.orderNumber) {
        rowErrors.push({ row: row.rowNumber, field: "订单号", message: "订单号过长。" });
      } else if (hasControlChar(orderId.text)) {
        rowErrors.push({ row: row.rowNumber, field: "订单号", message: "订单号含有无法使用的字符。" });
      } else {
        orderNumber = orderId.text;
      }
    }

    const shipDate = parseShipDate(at("日期")?.value);
    if (!shipDate) {
      rowErrors.push({
        row: row.rowNumber,
        field: "日期",
        message: "日期无法识别。请使用 2026-03-02 这样的日期。",
      });
    }

    const shippingMethod = plainText(at("邮寄方式"));
    if (!shippingMethod) {
      rowErrors.push({ row: row.rowNumber, field: "邮寄方式", message: "邮寄方式为空。" });
    } else if (shippingMethod.length > FIELD_LIMITS.shippingMethod || hasControlChar(shippingMethod)) {
      rowErrors.push({ row: row.rowNumber, field: "邮寄方式", message: "邮寄方式无法使用。" });
    }

    const magazineName = plainText(at("杂志名称"));
    if (!magazineName) {
      rowErrors.push({ row: row.rowNumber, field: "杂志名称", message: "杂志名称为空。" });
    } else if (magazineName.length > FIELD_LIMITS.magazineName || hasControlChar(magazineName)) {
      rowErrors.push({ row: row.rowNumber, field: "杂志名称", message: "杂志名称无法使用。" });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    pending.push({
      row: row.rowNumber,
      phone,
      magazineName,
      shipDate: shipDate as string,
      shippingMethod,
      trackingNumber,
      orderNumber,
    });
  }

  const byIdentity = new Map<string, ValidRow>();
  let duplicateRows = 0;
  for (const row of pending) {
    const key = identityKey(row);
    if (byIdentity.has(key)) duplicateRows += 1;
    byIdentity.set(key, row);
  }

  return {
    ok: true,
    table: {
      errors,
      validRows: [...byIdentity.values()],
      blankRows,
      duplicateRows,
      totalDataRows,
      ignoredBlankColumns,
      ignoredColumns: ignoredColumns.slice(0, 10),
    },
  };
}

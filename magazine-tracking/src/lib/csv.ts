import iconv from "iconv-lite";
import type { SheetRow } from "@/lib/types";

export function decodeCsvBuffer(buf: Buffer): { text: string; encoding: "utf-8" | "gb18030" } {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString("utf8"), encoding: "utf-8" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), encoding: "utf-8" };
  } catch {
    return { text: iconv.decode(buf, "gb18030"), encoding: "gb18030" };
  }
}

/** RFC4180-ish parser. Keeps empty rows so spreadsheet row numbers stay stable. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") continue;
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function csvToSheet(text: string): SheetRow[] {
  return parseCsv(text).map((cells, index) => ({
    rowNumber: index + 1,
    cells: cells.map((value) => ({ value, text: value })),
  }));
}

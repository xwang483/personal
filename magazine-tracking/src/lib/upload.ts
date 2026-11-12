import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { csvToSheet, decodeCsvBuffer } from "@/lib/csv";
import { parseSheet, type ParsedTable } from "@/lib/parse-table";
import { readXlsx } from "@/lib/xlsx";

export type UploadRead =
  | {
      ok: true;
      table: ParsedTable;
      fileType: "csv" | "xlsx";
      encoding: "utf-8" | "gb18030" | null;
      fileExt: "csv" | "xlsx";
    }
  | { ok: false; error: string; status: number };

function extensionOf(filename: string): "csv" | "xlsx" | null {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const match = base.toLowerCase().match(/\.(csv|xlsx)$/);
  if (!match) return null;
  return match[1] as "csv" | "xlsx";
}

export async function readUpload(filename: string, buf: Buffer): Promise<UploadRead> {
  if (buf.length === 0) return { ok: false, status: 400, error: "文件是空的。" };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "文件超过 5MB 上限。" };
  }

  const ext = extensionOf(filename);
  if (!ext) return { ok: false, status: 400, error: "只接受 .xlsx 和 .csv 文件。" };

  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  if (ext === "xlsx") {
    if (!isZip) return { ok: false, status: 400, error: "这个文件不是有效的 .xlsx。" };
    const sheet = await readXlsx(buf);
    if (!sheet.ok) return { ok: false, status: 400, error: sheet.error };
    const parsed = parseSheet(sheet.rows);
    if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
    return { ok: true, table: parsed.table, fileType: "xlsx", encoding: null, fileExt: "xlsx" };
  }

  if (isZip || buf.subarray(0, 4096).includes(0)) {
    return { ok: false, status: 400, error: "这个文件不是文本 CSV。" };
  }

  const decoded = decodeCsvBuffer(buf);
  const parsed = parseSheet(csvToSheet(decoded.text));
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  return {
    ok: true,
    table: parsed.table,
    fileType: "csv",
    encoding: decoded.encoding,
    fileExt: "csv",
  };
}

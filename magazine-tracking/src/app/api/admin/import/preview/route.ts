import { MAX_ERRORS_SHOWN, MAX_PREVIEW_ROWS, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { requireAdmin, json } from "@/lib/http";
import { maskPhone } from "@/lib/phone";
import { clientKey, importLimit, rateLimit } from "@/lib/rate-limit";
import { savePreview } from "@/lib/shipments";
import { readUpload } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = requireAdmin(req, true);
  if (denied) return denied;

  const limit = importLimit();
  const gate = rateLimit(`import:${clientKey(req)}`, limit.limit, limit.windowMs);
  if (!gate.ok) {
    return json(
      { error: "上传过于频繁，请稍后再试。" },
      429,
      { "Retry-After": String(gate.retryAfterSec) },
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return json({ error: "文件超过 5MB 上限。" }, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "无法读取上传的文件。" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "请选择要上传的文件。" }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "文件超过 5MB 上限。" }, 413);

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const uploaded = await readUpload(file.name, buf);
    if (!uploaded.ok) return json({ error: uploaded.error }, uploaded.status);

    const table = uploaded.table;
    const token = table.validRows.length > 0 ? savePreview(table.validRows, uploaded.fileExt) : null;
    const preview = table.validRows.slice(0, MAX_PREVIEW_ROWS).map((row) => ({
      row: row.row,
      magazineName: row.magazineName,
      date: row.shipDate,
      shippingMethod: row.shippingMethod,
      trackingNumber: row.trackingNumber,
      phoneMasked: maskPhone(row.phone),
    }));

    return json({
      token,
      fileType: uploaded.fileType,
      encoding: uploaded.encoding,
      totalDataRows: table.totalDataRows,
      blankRows: table.blankRows,
      validCount: table.validRows.length,
      duplicateRows: table.duplicateRows,
      ignoredBlankColumns: table.ignoredBlankColumns,
      ignoredColumns: table.ignoredColumns,
      errorCount: table.errors.length,
      errors: table.errors.slice(0, MAX_ERRORS_SHOWN),
      errorsTruncated: table.errors.length > MAX_ERRORS_SHOWN,
      preview,
      previewTruncated: table.validRows.length > preview.length,
      canCommit: table.validRows.length > 0,
    });
  } catch (error) {
    console.error("preview failed", error instanceof Error ? error.name : "error");
    return json({ error: "文件没有完成校验，请稍后再试。" }, 500);
  }
}

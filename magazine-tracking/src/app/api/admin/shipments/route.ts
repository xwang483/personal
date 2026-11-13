import { requireAdmin, json } from "@/lib/http";
import { parseJsonObject, readLimitedBody } from "@/lib/body";
import { normalizePhone } from "@/lib/phone";
import { deleteShipment, searchShipments } from "@/lib/shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req, false);
  if (denied) return denied;
  const url = new URL(req.url);
  const raw = url.searchParams.get("q") ?? "";
  const phone = normalizePhone(raw);
  const query = phone.ok ? phone.phone : raw.trim();
  return json({ shipments: searchShipments(query) });
}

export async function POST(req: Request) {
  const denied = requireAdmin(req, true);
  if (denied) return denied;
  const bytes = await readLimitedBody(req);
  if (!bytes) return json({ error: "请求无法处理。" }, 413);
  const body = parseJsonObject(bytes);
  const id = body?.id;
  if (typeof id !== "number" || !Number.isInteger(id)) return json({ error: "没有这条记录。" }, 400);
  if (!deleteShipment(id)) return json({ error: "没有这条记录。" }, 404);
  return json({ ok: true });
}

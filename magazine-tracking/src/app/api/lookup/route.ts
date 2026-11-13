import { parseJsonObject, readLimitedBody } from "@/lib/body";
import { json } from "@/lib/http";
import { readerPhoneFromRequest } from "@/lib/reader-session";
import { clientKey, lookupLimit, rateLimit } from "@/lib/rate-limit";
import { findByPhone } from "@/lib/shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json({ error: "请求无法处理。" }, 415);
  }

  const bytes = await readLimitedBody(req);
  if (!bytes) return json({ error: "请求无法处理。" }, 413);
  parseJsonObject(bytes);

  const limit = lookupLimit();
  const gate = rateLimit(`lookup:${clientKey(req)}`, limit.limit, limit.windowMs);
  if (!gate.ok) {
    return json(
      { error: "查询过于频繁，请稍后再试。" },
      429,
      { "Retry-After": String(gate.retryAfterSec) },
    );
  }

  const phone = readerPhoneFromRequest(req);
  if (!phone) return json({ error: "请先验证手机号。" }, 401);

  try {
    const result = findByPhone(phone);
    return json({ shipments: result.shipments, truncated: result.truncated });
  } catch (error) {
    console.error("lookup failed", error instanceof Error ? error.name : "error");
    return json({ error: "查询暂时不可用，请稍后再试。" }, 500);
  }
}

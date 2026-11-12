import { json } from "@/lib/http";
import { normalizePhone, publicPhoneMessage } from "@/lib/phone";
import { clientKey, lookupLimit, rateLimit } from "@/lib/rate-limit";
import { findByPhone } from "@/lib/shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return json({ error: "请求无法处理。" }, 413);
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json({ error: "请求无法处理。" }, 415);
  }

  const limit = lookupLimit();
  const gate = rateLimit(`lookup:${clientKey(req)}`, limit.limit, limit.windowMs);
  if (!gate.ok) {
    return json(
      { error: "查询过于频繁，请稍后再试。" },
      429,
      { "Retry-After": String(gate.retryAfterSec) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: publicPhoneMessage("invalid") }, 400);
  }

  const phoneValue =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { phone?: unknown }).phone
      : undefined;
  if (typeof phoneValue !== "string" || phoneValue.length > 32) {
    return json({ error: publicPhoneMessage("invalid") }, 400);
  }

  const normalized = normalizePhone(phoneValue);
  if (!normalized.ok) return json({ error: publicPhoneMessage(normalized.code) }, 400);

  try {
    const result = findByPhone(normalized.phone);
    return json({ shipments: result.shipments, truncated: result.truncated });
  } catch (error) {
    console.error("lookup failed", error instanceof Error ? error.name : "error");
    return json({ error: "查询暂时不可用，请稍后再试。" }, 500);
  }
}

import { requireAdmin, json } from "@/lib/http";
import { clientKey, importLimit, rateLimit } from "@/lib/rate-limit";
import { commitPreview } from "@/lib/shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = requireAdmin(req, true);
  if (denied) return denied;

  const limit = importLimit();
  const gate = rateLimit(`commit:${clientKey(req)}`, limit.limit, limit.windowMs);
  if (!gate.ok) {
    return json(
      { error: "操作过于频繁，请稍后再试。" },
      429,
      { "Retry-After": String(gate.retryAfterSec) },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return json({ error: "请求无法处理。" }, 415);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "预览已过期，请重新上传。" }, 400);
  }

  const token =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { token?: unknown }).token
      : undefined;
  if (typeof token !== "string" || token.length < 20 || token.length > 80) {
    return json({ error: "预览已过期，请重新上传。" }, 400);
  }

  try {
    const summary = commitPreview(token);
    if (!summary) return json({ error: "预览已过期，请重新上传。" }, 400);
    return json(summary);
  } catch (error) {
    console.error("commit failed", error instanceof Error ? error.name : "error");
    return json({ error: "导入没有完成，请重新上传后再确认。" }, 500);
  }
}

import { NextResponse } from "next/server";
import {
  checkCredentials,
  createSessionToken,
  isAdminConfigured,
  sessionCookieOptions,
} from "@/lib/auth";
import { isSameOrigin, json } from "@/lib/http";
import { clientKey, loginLimit, rateLimit } from "@/lib/rate-limit";
import { SESSION_TTL_SECONDS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "请求被拒绝。" }, 403);

  const limit = loginLimit();
  const gate = rateLimit(`login:${clientKey(req)}`, limit.limit, limit.windowMs);
  if (!gate.ok) {
    return json(
      { error: "尝试次数过多，请稍后再试。" },
      429,
      { "Retry-After": String(gate.retryAfterSec) },
    );
  }

  if (!isAdminConfigured()) return json({ error: "管理员登录尚未配置。" }, 503);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return json({ error: "请求无法处理。" }, 415);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "用户名或密码不正确。" }, 401);
  }

  const username =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { username?: unknown }).username
      : undefined;
  const password =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { password?: unknown }).password
      : undefined;

  if (typeof username !== "string" || typeof password !== "string") {
    return json({ error: "用户名或密码不正确。" }, 401);
  }
  if (username.length > 64 || password.length > 200 || !checkCredentials(username, password)) {
    return json({ error: "用户名或密码不正确。" }, 401);
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set({
    ...sessionCookieOptions(SESSION_TTL_SECONDS),
    value: createSessionToken(),
  });
  return response;
}

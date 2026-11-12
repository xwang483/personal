import { NextResponse } from "next/server";
import { isAdminConfigured, isAuthenticated } from "@/lib/auth";

export function json(body: unknown, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...Object.fromEntries(new Headers(headers).entries()),
    },
  });
}

export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, mutation: boolean): NextResponse | null {
  if (mutation && !isSameOrigin(req)) {
    return json({ error: "请求被拒绝。" }, 403);
  }
  if (!isAdminConfigured()) {
    return json({ error: "管理员登录尚未配置。" }, 503);
  }
  if (!isAuthenticated(req.headers.get("cookie"))) {
    return json({ error: "需要登录。" }, 401);
  }
  return null;
}

export function attachment(filename: string, body: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

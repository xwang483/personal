import { NextResponse } from "next/server";
import { parseJsonObject, readLimitedBody } from "@/lib/body";
import { json } from "@/lib/http";
import { clientKey, rateLimit, smsVerifyLimit } from "@/lib/rate-limit";
import { createReaderToken, readerAuthConfigured, readerCookieOptions } from "@/lib/reader-session";
import { exchangeWechatPhone } from "@/lib/wechat-phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "请求无法处理。" }, 415);
  }
  const bytes = await readLimitedBody(req);
  if (!bytes) return json({ error: "请求无法处理。" }, 413);
  const body = parseJsonObject(bytes);
  const loginCode = body?.code;
  if (typeof loginCode !== "string" || !loginCode.trim()) {
    return json({ error: "没有拿到微信手机号授权。" }, 400);
  }
  if (!readerAuthConfigured() || !process.env.WECHAT_APP_ID || !process.env.WECHAT_APP_SECRET) {
    return json({ error: "微信手机号验证尚未配置。请改用短信验证码。" }, 503);
  }

  const limit = smsVerifyLimit();
  const gate = rateLimit(`wechat-phone:${clientKey(req)}`, limit.limit, limit.windowMs);
  if (!gate.ok) {
    return json({ error: "验证次数过多，请稍后再试。" }, 429, { "Retry-After": String(gate.retryAfterSec) });
  }

  let phone: string | null = null;
  try {
    phone = await exchangeWechatPhone(loginCode.trim());
  } catch (error) {
    console.error("wechat phone failed", error instanceof Error ? error.name : "error");
    phone = null;
  }
  if (!phone) return json({ error: "微信没有返回可用的手机号。请改用短信验证码。" }, 400);

  const token = createReaderToken(phone);
  const response = NextResponse.json({ ok: true, token }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ ...readerCookieOptions(), value: token });
  return response;
}

import { NextResponse } from "next/server";
import { parseJsonObject, readLimitedBody } from "@/lib/body";
import { json } from "@/lib/http";
import { normalizePhone, publicPhoneMessage } from "@/lib/phone";
import { clientKey, rateLimit, smsVerifyLimit } from "@/lib/rate-limit";
import { createReaderToken, readerAuthConfigured, readerCookieOptions } from "@/lib/reader-session";
import { checkSmsCode } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "请求无法处理。" }, 415);
  }
  const bytes = await readLimitedBody(req);
  if (!bytes) return json({ error: "请求无法处理。" }, 413);
  const body = parseJsonObject(bytes);
  const phoneValue = body?.phone;
  const codeValue = body?.code;
  if (typeof phoneValue !== "string" || phoneValue.length > 32) {
    return json({ error: publicPhoneMessage("invalid") }, 400);
  }
  if (typeof codeValue !== "string" || codeValue.length > 8) {
    return json({ error: "验证码不正确或已过期。" }, 400);
  }
  const normalized = normalizePhone(phoneValue);
  if (!normalized.ok) return json({ error: publicPhoneMessage(normalized.code) }, 400);
  if (!readerAuthConfigured()) return json({ error: "验证码尚未配置。" }, 503);

  const limit = smsVerifyLimit();
  const ipGate = rateLimit(`sms-verify-ip:${clientKey(req)}`, limit.limit, limit.windowMs);
  const phoneGate = rateLimit(`sms-verify-phone:${normalized.phone}`, limit.limit, limit.windowMs);
  if (!ipGate.ok) {
    return json({ error: "验证次数过多，请稍后再试。" }, 429, { "Retry-After": String(ipGate.retryAfterSec) });
  }
  if (!phoneGate.ok) {
    return json({ error: "验证次数过多，请稍后再试。" }, 429, { "Retry-After": String(phoneGate.retryAfterSec) });
  }

  const checked = checkSmsCode(normalized.phone, codeValue.trim());
  if (!checked.ok) return json({ error: checked.error }, 400);

  const token = createReaderToken(normalized.phone);
  const response = NextResponse.json({ ok: true, token }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ ...readerCookieOptions(), value: token });
  return response;
}

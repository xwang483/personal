import { parseJsonObject, readLimitedBody } from "@/lib/body";
import { json } from "@/lib/http";
import { normalizePhone, publicPhoneMessage } from "@/lib/phone";
import { clientKey, rateLimit, smsSendIpLimit, smsSendPhoneLimit } from "@/lib/rate-limit";
import { issueSmsCode } from "@/lib/sms";

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
  if (typeof phoneValue !== "string" || phoneValue.length > 32) {
    return json({ error: publicPhoneMessage("invalid") }, 400);
  }
  const normalized = normalizePhone(phoneValue);
  if (!normalized.ok) return json({ error: publicPhoneMessage(normalized.code) }, 400);

  const ipLimit = smsSendIpLimit();
  const ipGate = rateLimit(`sms-send-ip:${clientKey(req)}`, ipLimit.limit, ipLimit.windowMs);
  if (!ipGate.ok) {
    return json({ error: "获取验证码过于频繁，请稍后再试。" }, 429, {
      "Retry-After": String(ipGate.retryAfterSec),
    });
  }
  const phoneLimit = smsSendPhoneLimit();
  const phoneGate = rateLimit(`sms-send-phone:${normalized.phone}`, phoneLimit.limit, phoneLimit.windowMs);
  if (!phoneGate.ok) {
    return json({ error: "获取验证码过于频繁，请稍后再试。" }, 429, {
      "Retry-After": String(phoneGate.retryAfterSec),
    });
  }

  const issued = await issueSmsCode(normalized.phone);
  if (!issued.ok) {
    return json(
      { error: issued.error },
      issued.status,
      issued.retryAfterSec ? { "Retry-After": String(issued.retryAfterSec) } : undefined,
    );
  }
  return json({ ok: true });
}

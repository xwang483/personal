import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { SMS_MAX_ATTEMPTS, SMS_RESEND_MS, SMS_TTL_MS } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { sendSmsCode } from "@/lib/sms-provider";

export type SmsIssue =
  | { ok: true }
  | { ok: false; status: 429 | 503; error: string; retryAfterSec?: number };

export type SmsCheck =
  | { ok: true }
  | { ok: false; error: string };

function pepper(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (secret.length < 32) return null;
  return secret;
}

function hashCode(phone: string, code: string, secret: string): string {
  return createHash("sha256").update(`${secret}\0${phone}\0${code}`).digest("hex");
}

function hashesEqual(stored: string, given: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function issueSmsCode(phone: string): Promise<SmsIssue> {
  const secret = pepper();
  if (!secret) return { ok: false, status: 503, error: "验证码尚未配置。" };

  const db = getDb();
  const now = Date.now();
  const latest = db
    .prepare("SELECT created_at FROM sms_codes WHERE phone = ? ORDER BY id DESC LIMIT 1")
    .get(phone) as { created_at?: number } | undefined;
  if (latest?.created_at && now - Number(latest.created_at) < SMS_RESEND_MS) {
    const retryAfterSec = Math.max(1, Math.ceil((Number(latest.created_at) + SMS_RESEND_MS - now) / 1000));
    return { ok: false, status: 429, error: "请稍后再获取验证码。", retryAfterSec };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  db.prepare(
    `INSERT INTO sms_codes (phone, code_hash, expires_at, attempts, used_at, created_at)
     VALUES (?, ?, ?, 0, NULL, ?)`,
  ).run(phone, hashCode(phone, code, secret), now + SMS_TTL_MS, now);

  try {
    await sendSmsCode(phone, code);
  } catch (error) {
    console.error("sms send failed", error instanceof Error ? error.name : "error");
    return { ok: false, status: 503, error: "验证码暂时发不出去，请稍后再试。" };
  }
  return { ok: true };
}

export function checkSmsCode(phone: string, code: string): SmsCheck {
  const secret = pepper();
  if (!secret) return { ok: false, error: "验证码尚未配置。" };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "验证码不正确。" };

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, code_hash, expires_at, attempts, used_at
       FROM sms_codes WHERE phone = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(phone) as
    | { id: number; code_hash: string; expires_at: number; attempts: number; used_at: number | null }
    | undefined;
  if (!row || row.used_at || Number(row.expires_at) < Date.now()) {
    return { ok: false, error: "验证码不正确或已过期。" };
  }
  if (Number(row.attempts) >= SMS_MAX_ATTEMPTS) {
    db.prepare("UPDATE sms_codes SET used_at = ? WHERE id = ? AND used_at IS NULL").run(Date.now(), row.id);
    return { ok: false, error: "验证次数过多，请重新获取验证码。" };
  }

  db.prepare("UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
  if (!hashesEqual(String(row.code_hash), hashCode(phone, code, secret))) {
    return { ok: false, error: "验证码不正确或已过期。" };
  }
  const spent = db
    .prepare("UPDATE sms_codes SET used_at = ? WHERE id = ? AND used_at IS NULL")
    .run(Date.now(), row.id);
  if (spent.changes !== 1) return { ok: false, error: "验证码不正确或已过期。" };
  return { ok: true };
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { READER_COOKIE, READER_SESSION_TTL_SECONDS } from "@/lib/constants";
import { readCookie, sessionCookieOptions } from "@/lib/auth";

type ReaderPayload = {
  k: "reader";
  p: string;
  exp: number;
};

function secret(): string | null {
  const value = process.env.ADMIN_SESSION_SECRET ?? "";
  if (value.length < 32 || value.length > 200) return null;
  return value;
}

export function readerAuthConfigured(): boolean {
  return secret() !== null;
}

export function createReaderToken(phone: string, ttlSeconds = READER_SESSION_TTL_SECONDS): string {
  const key = secret();
  if (!key) throw new Error("reader session is not configured");
  const payload: ReaderPayload = {
    k: "reader",
    p: phone,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", key).update(`reader.${body}`).digest("base64url");
  return `${body}.${signature}`;
}

export function readReaderPhone(token: string | undefined | null): string | null {
  const key = secret();
  if (!token || !key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;
  const expected = createHmac("sha256", key).update(`reader.${body}`).digest("base64url");
  const given = Buffer.from(signature);
  const actual = Buffer.from(expected);
  if (given.length !== actual.length || !timingSafeEqual(given, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<ReaderPayload>;
    if (payload.k !== "reader" || payload.exp == null || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.p !== "string" || !/^1[3-9]\d{9}$/.test(payload.p)) return null;
    return payload.p;
  } catch {
    return null;
  }
}

export function readerPhoneFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return readReaderPhone(bearer) ?? readReaderPhone(readCookie(req.headers.get("cookie"), READER_COOKIE));
}

export function readerCookieOptions(maxAge = READER_SESSION_TTL_SECONDS) {
  return { ...sessionCookieOptions(maxAge), name: READER_COOKIE };
}

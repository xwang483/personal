import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/constants";

type SessionPayload = {
  u: string;
  exp: number;
  t: string;
};

export function isAdminConfigured(): boolean {
  const username = process.env.ADMIN_USERNAME ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (username.trim().length < 1 || username.length > 64) return false;
  if (password.length < 8 || password.length > 200) return false;
  if (secret.length < 32 || secret.length > 200) return false;
  return true;
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

function passwordTag(): string {
  return createHash("sha256")
    .update(process.env.ADMIN_PASSWORD ?? "")
    .digest("base64url")
    .slice(0, 16);
}

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function checkCredentials(username: string, password: string): boolean {
  if (!isAdminConfigured()) return false;
  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPassword);
}

export function createSessionToken(): string {
  const payload: SessionPayload = {
    u: process.env.ADMIN_USERNAME ?? "",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    t: passwordTag(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || !isAdminConfigured()) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  if (!body || !signature) return false;

  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const given = Buffer.from(signature);
  const actual = Buffer.from(expected);
  if (given.length !== actual.length || !timingSafeEqual(given, actual)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
    if (payload.u !== process.env.ADMIN_USERNAME) return false;
    if (payload.t !== passwordTag()) return false;
    return true;
  } catch {
    return false;
  }
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function isAuthenticated(cookieHeader: string | null): boolean {
  return verifySessionToken(readCookie(cookieHeader, SESSION_COOKIE));
}

export function sessionCookieOptions(maxAge: number) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

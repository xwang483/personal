import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function bootEnv() {
  const dir = mkdtempSync(path.join(tmpdir(), "mag-"));
  process.env.DATABASE_PATH = path.join(dir, "shipments.sqlite");
  process.env.ADMIN_USERNAME = "editor";
  process.env.ADMIN_PASSWORD = "correct-horse-battery";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret-must-be-32chars";
  process.env.TRUST_PROXY = "0";
  process.env.LOOKUP_RATE_LIMIT = "1000";
  process.env.LOGIN_RATE_LIMIT = "1000";
  process.env.IMPORT_RATE_LIMIT = "1000";
  return dir;
}

export function request(pathname: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  headers.set("host", "localhost");
  const method = init.method ?? "GET";
  if (method !== "GET" && !headers.has("origin")) headers.set("origin", "http://localhost");
  if (cookie) headers.set("cookie", cookie);
  return new Request(new URL(pathname, "http://localhost").toString(), { ...init, headers });
}

export function sessionCookie(response: Response): string {
  const set = response.headers.getSetCookie();
  const raw = set.find((item) => item.startsWith("mag_session="));
  if (!raw) throw new Error("missing session cookie");
  return raw.split(";")[0] ?? raw;
}

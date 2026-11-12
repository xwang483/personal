type Bucket = number[];

const buckets = new Map<string, Bucket>();

function readNumber(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > max) return fallback;
  return Math.floor(value);
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5_000) buckets.clear();
  return { ok: true };
}

export function resetRateLimits() {
  buckets.clear();
}

export function lookupLimit() {
  return {
    limit: readNumber("LOOKUP_RATE_LIMIT", 20, 100_000),
    windowMs: readNumber("LOOKUP_RATE_WINDOW_MS", 10 * 60 * 1000, 24 * 60 * 60 * 1000),
  };
}

export function loginLimit() {
  return {
    limit: readNumber("LOGIN_RATE_LIMIT", 8, 100_000),
    windowMs: readNumber("LOGIN_RATE_WINDOW_MS", 15 * 60 * 1000, 24 * 60 * 60 * 1000),
  };
}

export function importLimit() {
  return {
    limit: readNumber("IMPORT_RATE_LIMIT", 30, 100_000),
    windowMs: readNumber("IMPORT_RATE_WINDOW_MS", 60 * 60 * 1000, 24 * 60 * 60 * 1000),
  };
}

export function clientKey(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const realIp = req.headers.get("x-real-ip")?.trim() ?? "";
    const candidate = forwarded || realIp;
    if (/^[a-fA-F0-9:.]{1,64}$/.test(candidate)) return candidate;
  }
  return "direct";
}

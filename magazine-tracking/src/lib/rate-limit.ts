type Bucket = number[];

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

function readNumber(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > max) return fallback;
  return Math.floor(value);
}

function remember(key: string, stamps: Bucket) {
  buckets.delete(key);
  buckets.set(key, stamps);
  while (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    remember(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  remember(key, recent);
  return { ok: true };
}

export function resetRateLimits() {
  buckets.clear();
}

export function rateLimitSize(): number {
  return buckets.size;
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

export function smsSendPhoneLimit() {
  return { limit: 5, windowMs: 10 * 60 * 1000 };
}

export function smsSendIpLimit() {
  return { limit: 20, windowMs: 10 * 60 * 1000 };
}

export function smsVerifyLimit() {
  return { limit: 10, windowMs: 10 * 60 * 1000 };
}

const IP = /^[a-fA-F0-9:.]{1,64}$/;

function forwardedAddresses(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => IP.test(part));
}

/**
 * Without TRUST_PROXY, a single X-Forwarded-For value is the address this
 * process recorded for the socket. A client-supplied chain is ignored so it
 * cannot mint a new bucket.
 * With TRUST_PROXY=1, the trusted proxy appends the client it saw. The key is
 * that written address: the entry TRUSTED_PROXY_HOPS from the right (default
 * the last hop). A spoofed prefix does not change the key.
 */
export function clientKey(req: Request): string {
  const hops = forwardedAddresses(req.headers.get("x-forwarded-for"));
  if (process.env.TRUST_PROXY !== "1") {
    return hops.length === 1 ? hops[0] : "direct";
  }
  if (hops.length === 0) return "direct";
  const trusted = readNumber("TRUSTED_PROXY_HOPS", 1, 8);
  const index = Math.max(0, hops.length - trusted);
  return hops[index];
}

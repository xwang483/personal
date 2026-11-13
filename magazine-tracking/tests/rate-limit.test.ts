import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, describe, it } from "node:test";
import { POST as lookup } from "../src/app/api/lookup/route.ts";
import { READER_COOKIE } from "../src/lib/constants.ts";
import { closeDb } from "../src/lib/db.ts";
import { rateLimit, rateLimitSize, resetRateLimits } from "../src/lib/rate-limit.ts";
import { createReaderToken } from "../src/lib/reader-session.ts";
import { bootEnv, request } from "./helpers.ts";

const dir = bootEnv();
process.env.LOOKUP_RATE_LIMIT = "2";
process.env.LOOKUP_RATE_WINDOW_MS = "60000";

describe("lookup rate limit", { concurrency: 1 }, () => {
  after(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("stops repeated queries", async () => {
    resetRateLimits();
    const cookie = `${READER_COOKIE}=${createReaderToken("13700004444")}`;
    const send = () =>
      lookup(
        request(
          "/api/lookup",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          },
          cookie,
        ),
      );
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 200);
    const blocked = await send();
    assert.equal(blocked.status, 429);
    assert.match(blocked.headers.get("retry-after") ?? "", /\d+/);
  });

  it("keeps a spoofed X-Forwarded-For prefix on the proxy-written hop", async () => {
    resetRateLimits();
    process.env.TRUST_PROXY = "1";
    process.env.TRUSTED_PROXY_HOPS = "1";
    const cookie = `${READER_COOKIE}=${createReaderToken("13700004444")}`;
    const send = (spoof: string) =>
      lookup(
        request(
          "/api/lookup",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": `${spoof}, 10.0.0.8`,
            },
            body: "{}",
          },
          cookie,
        ),
      );
    assert.equal((await send("1.1.1.1")).status, 200);
    assert.equal((await send("2.2.2.2")).status, 200);
    assert.equal((await send("3.3.3.3")).status, 429);
    process.env.TRUST_PROXY = "0";
  });

  it("evicts the oldest bucket instead of clearing every limit", () => {
    resetRateLimits();
    for (let i = 0; i < 5000; i += 1) rateLimit(`noise:${i}`, 2, 60_000);
    assert.equal(rateLimit("login:keep", 1, 60_000).ok, true);
    assert.equal(rateLimit("login:keep", 1, 60_000).ok, false);
    assert.ok(rateLimitSize() <= 5000);
  });
});

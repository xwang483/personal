import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, describe, it } from "node:test";
import { POST as lookup } from "../src/app/api/lookup/route.ts";
import { closeDb } from "../src/lib/db.ts";
import { resetRateLimits } from "../src/lib/rate-limit.ts";
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
    const send = () =>
      lookup(
        request("/api/lookup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: "13700004444" }),
        }),
      );
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 200);
    const blocked = await send();
    assert.equal(blocked.status, 429);
    assert.match(blocked.headers.get("retry-after") ?? "", /\d+/);
  });
});

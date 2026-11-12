import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, describe, it } from "node:test";
import { POST as login } from "../src/app/api/admin/login/route.ts";
import { POST as preview } from "../src/app/api/admin/import/preview/route.ts";
import { closeDb } from "../src/lib/db.ts";
import { bootEnv, request } from "./helpers.ts";

const dir = bootEnv();
delete process.env.ADMIN_PASSWORD;

describe("admin is closed until configured", { concurrency: 1 }, () => {
  after(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not accept a login or upload", async () => {
    const response = await login(
      request("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "editor", password: "correct-horse-battery" }),
      }),
    );
    assert.equal(response.status, 503);
    const form = new FormData();
    form.append("file", new File(["姓名\n"], "x.csv", { type: "text/csv" }));
    const uploaded = await preview(request("/api/admin/import/preview", { method: "POST", body: form }));
    assert.equal(uploaded.status, 503);
    const body = await uploaded.json();
    assert.equal(JSON.stringify(body).includes("correct-horse"), false);
  });
});

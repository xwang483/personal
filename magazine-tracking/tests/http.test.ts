import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { after, beforeEach, describe, it } from "node:test";
import { POST as login } from "../src/app/api/admin/login/route.ts";
import { POST as commit } from "../src/app/api/admin/import/commit/route.ts";
import { POST as preview } from "../src/app/api/admin/import/preview/route.ts";
import { GET as stats } from "../src/app/api/admin/stats/route.ts";
import { GET as template } from "../src/app/api/admin/template/route.ts";
import { POST as lookup } from "../src/app/api/lookup/route.ts";
import { closeDb, getDb } from "../src/lib/db.ts";
import { buildSampleCsv } from "../src/lib/samples.ts";
import { bootEnv, request, sessionCookie } from "./helpers.ts";

const dir = bootEnv();

async function signIn() {
  const response = await login(
    request("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "editor", password: "correct-horse-battery" }),
    }),
  );
  assert.equal(response.status, 200);
  const cookie = sessionCookie(response);
  assert.match(response.headers.getSetCookie().join(";"), /HttpOnly/i);
  return cookie;
}

async function postFile(cookie: string, filename: string, body: Buffer, type = "text/csv") {
  const form = new FormData();
  form.append("file", new File([body], filename, { type }));
  return preview(request("/api/admin/import/preview", { method: "POST", body: form }, cookie));
}

describe("lookup and admin import", { concurrency: 1 }, () => {
  beforeEach(() => {
    const db = getDb();
    db.exec("DELETE FROM shipments");
    db.exec("DELETE FROM import_previews");
    db.exec("DELETE FROM import_log");
  });

  after(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects anonymous admin access and does not import", async () => {
    const sample = buildSampleCsv();
    const form = new FormData();
    form.append("file", new File([sample], "sample.csv", { type: "text/csv" }));
    const denied = await preview(request("/api/admin/import/preview", { method: "POST", body: form }));
    assert.equal(denied.status, 401);
    assert.equal(JSON.stringify(await denied.json()).includes("虚构地址"), false);
    assert.equal((await stats(request("/api/admin/stats"))).status, 401);
    assert.equal((await template(request("/api/admin/template?kind=sample&format=csv"))).status, 401);
    const foreign = await preview(
      request("/api/admin/import/preview", {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: form,
      }),
    );
    assert.equal(foreign.status, 403);
    assert.equal(getDb().prepare("SELECT COUNT(*) AS c FROM shipments").get()?.c, 0);
  });

  it("rejects a bad login and a short secret configuration is not this case", async () => {
    const response = await login(
      request("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "editor", password: "wrong-password" }),
      }),
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.getSetCookie().length, 0);
  });

  it("imports the fictional sample once, then treats a repeat as unchanged", async () => {
    const cookie = await signIn();
    const firstPreview = await postFile(cookie, "sample.csv", buildSampleCsv());
    assert.equal(firstPreview.status, 200);
    const previewBody = await firstPreview.json();
    assert.equal(previewBody.validCount, 3);
    assert.equal(JSON.stringify(previewBody).includes("13800001111"), false);
    assert.equal(JSON.stringify(previewBody).includes("虚构姓名"), false);
    assert.equal(JSON.stringify(previewBody).includes("虚构地址"), false);
    assert.equal(previewBody.preview[0].phoneMasked.includes("****"), true);

    const firstCommit = await commit(
      request(
        "/api/admin/import/commit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: previewBody.token }),
        },
        cookie,
      ),
    );
    const firstSummary = await firstCommit.json();
    assert.equal(firstCommit.status, 200);
    assert.equal(firstSummary.inserted, 3);
    assert.equal(firstSummary.unchanged, 0);

    const againPreview = await postFile(cookie, "sample.csv", buildSampleCsv());
    const againBody = await againPreview.json();
    const againCommit = await commit(
      request(
        "/api/admin/import/commit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: againBody.token }),
        },
        cookie,
      ),
    );
    const againSummary = await againCommit.json();
    assert.equal(againSummary.inserted, 0);
    assert.equal(againSummary.updated, 0);
    assert.equal(againSummary.unchanged, 3);
    assert.equal(againSummary.shipmentCount, 3);

    const spent = await commit(
      request(
        "/api/admin/import/commit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: againBody.token }),
        },
        cookie,
      ),
    );
    assert.equal(spent.status, 400);
  });

  it("returns only magazine, date, method, and tracking number", async () => {
    const cookie = await signIn();
    const uploaded = await postFile(cookie, "sample.csv", buildSampleCsv());
    const body = await uploaded.json();
    await commit(
      request(
        "/api/admin/import/commit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: body.token }),
        },
        cookie,
      ),
    );

    const found = await lookup(
      request("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+86 138 0000 1111" }),
      }),
    );
    assert.equal(found.status, 200);
    assert.equal(found.headers.get("cache-control"), "no-store");
    const payload = await found.json();
    assert.deepEqual(Object.keys(payload).sort(), ["shipments", "truncated"]);
    assert.equal(payload.shipments.length, 2);
    assert.deepEqual(
      payload.shipments.map((item: { date: string }) => item.date),
      ["2026-03-02", "2026-01-18"],
    );
    assert.deepEqual(
      payload.shipments.map((item: { shippingMethod: string }) => item.shippingMethod),
      ["韵达快递", "中通快递"],
    );
    assert.equal(JSON.stringify(payload).includes("http"), false);
    assert.deepEqual(Object.keys(payload.shipments[0]).sort(), [
      "date",
      "magazineName",
      "shippingMethod",
      "trackingNumber",
    ]);
    const text = JSON.stringify(payload);
    assert.equal(text.includes("13800001111"), false);
    assert.equal(text.includes("DEMO-ORDER"), false);
    assert.equal(text.includes("虚构"), false);
    assert.equal(text.includes("《刊林》2026年春季号（示例）"), true);

    const other = await lookup(
      request("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "13900002222" }),
      }),
    );
    const otherBody = await other.json();
    assert.equal(otherBody.shipments.length, 1);
    assert.equal(otherBody.shipments[0].trackingNumber, "DEMO-JD-000003");
    assert.equal(otherBody.shipments[0].shippingMethod, "京东物流");
    assert.equal(JSON.stringify(otherBody).includes("http"), false);

    getDb().exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const dbPath = process.env.DATABASE_PATH ?? "";
    const storedText = [dbPath, `${dbPath}-wal`]
      .filter((file) => existsSync(file))
      .map((file) => readFileSync(file).toString("utf8"))
      .join("\n");
    assert.equal(storedText.includes("虚构地址"), false);
    assert.equal(storedText.includes("虚构姓名"), false);
    assert.equal(storedText.includes("DEMO-ORDER-0001"), true);
  });

  it("distinguishes empty, invalid, and unknown full numbers", async () => {
    const empty = await lookup(
      request("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "13700004444" }),
      }),
    );
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { shipments: [], truncated: false });

    const invalid = await lookup(
      request("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "1380000111" }),
      }),
    );
    assert.equal(invalid.status, 400);
    const invalidBody = await invalid.json();
    assert.equal("shipments" in invalidBody, false);
    assert.equal(JSON.stringify(invalidBody).includes("1380000111"), false);

    const injected = await lookup(
      request("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "13800001111' OR '1'='1" }),
      }),
    );
    assert.equal(injected.status, 400);
  });

  it("updates a tracking number for the same order instead of duplicating it", async () => {
    const cookie = await signIn();
    const original = Buffer.from(
      "姓名,收货地址,邮寄方式,单号,日期,电话,,杂志名称,订单号\n甲,址,顺丰,DEMO-SF-000001,2026-03-02,13800001111,,《刊林》（示例）,DEMO-ORDER-0001\n",
      "utf8",
    );
    const changed = Buffer.from(
      "姓名,收货地址,邮寄方式,单号,日期,电话,,杂志名称,订单号\n甲,址,顺丰,DEMO-SF-CHANGED,2026-03-05,138-0000-1111,,《刊林》（示例）,DEMO-ORDER-0001\n",
      "utf8",
    );
    for (const file of [original, changed]) {
      const uploaded = await postFile(cookie, "one.csv", file);
      const body = await uploaded.json();
      const saved = await commit(
        request(
          "/api/admin/import/commit",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: body.token }),
          },
          cookie,
        ),
      );
      assert.equal(saved.status, 200);
    }
    const found = await lookup(
      request("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "13800001111" }),
      }),
    );
    const payload = await found.json();
    assert.equal(payload.shipments.length, 1);
    assert.equal(payload.shipments[0].trackingNumber, "DEMO-SF-CHANGED");
    assert.equal(payload.shipments[0].date, "2026-03-05");
  });

  it("serves a header-only template and a marked sample", async () => {
    const cookie = await signIn();
    const blank = await template(request("/api/admin/template?kind=template&format=csv", {}, cookie));
    const blankText = await blank.text();
    assert.match(blankText, /姓名,收货地址,邮寄方式,单号,日期,电话,,杂志名称,订单号/);
    assert.equal(blankText.includes("13800001111"), false);
    const sample = await template(request("/api/admin/template?kind=sample&format=csv", {}, cookie));
    const sampleText = await sample.text();
    assert.match(sampleText, /示例/);
    assert.match(sampleText, /虚构姓名/);
  });
});

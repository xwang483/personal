import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { normalizePhone as serverNormalizePhone } from "../src/lib/phone.ts";

const require = createRequire(path.join(process.cwd(), "package.json"));
const root = path.join(process.cwd(), "miniprogram");
const phone = require("./miniprogram/utils/phone.js");
const apiBase = require("./miniprogram/utils/api-base.js");
const lookup = require("./miniprogram/utils/lookup.js");
const carriers = require("./miniprogram/utils/carriers.js");
const clipboard = require("./miniprogram/utils/clipboard.js");
const present = require("./miniprogram/utils/present.js");
const config = require("./miniprogram/config.js");

const FICTIONAL_PHONE = "13800001111";
const TRACKING = "DEMO-YD-000001";

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function walkJs(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walkJs(full));
    else if (name.endsWith(".js") || name.endsWith(".json") || name.endsWith(".wxml")) files.push(full);
  }
  return files;
}

function sampleRow(extra: Record<string, string> = {}) {
  return {
    magazineName: "《刊林》2026年春季号（示例）",
    date: "2026-03-02",
    shippingMethod: "韵达快递",
    trackingNumber: TRACKING,
    ...extra,
  };
}

function requestSpy(response: { statusCode: number; data?: unknown }, calls: unknown[]) {
  return (options: unknown) => {
    calls.push(options);
    return Promise.resolve(response);
  };
}

describe("miniprogram phone lookup", () => {
  it("matches the server for the same text inputs", () => {
    const samples = [
      "13800001111",
      "138 0000 1111",
      "138-0000-1111",
      "+86 138 0000 1111",
      "+8613800001111",
      "008613800001111",
      "86 13800001111",
      "13800001111.0",
      "'13800001111",
      "１３８００００１１１１",
      "138.0000.1111",
      "",
      "1380000111",
      "138000011112",
      "12345678901",
      "13800001111' OR '1'='1",
      "1.38e10",
    ];
    for (const sample of samples) {
      assert.deepEqual(phone.normalizePhone(sample), serverNormalizePhone(sample));
    }
  });

  it("asks the server with only the phone and drops private fields", async () => {
    const calls: Array<{ url: string; method: string; data: Record<string, string>; header: Record<string, string> }> = [];
    const result = await lookup.performLookup({
      config: { apiBase: "https://lookup.example.com", allowDemoTunnel: false },
      phone: "138 0000 1111",
      request: requestSpy(
        {
          statusCode: 200,
          data: {
            phone: FICTIONAL_PHONE,
            name: "虚构姓名",
            address: "虚构地址",
            shipments: [
              sampleRow({
                phone: FICTIONAL_PHONE,
                name: "虚构姓名",
                address: "虚构地址",
                orderNumber: "DEMO-ORDER-0001",
              }),
            ],
            truncated: false,
          },
        },
        calls,
      ),
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://lookup.example.com/api/lookup");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].data, { phone: FICTIONAL_PHONE });
    assert.deepEqual(Object.keys(calls[0].data), ["phone"]);
    assert.equal(calls[0].header["content-type"], "application/json");
    assert.equal(result.status, "results");
    assert.deepEqual(Object.keys(result.shipments[0]).sort(), lookup.PUBLIC_FIELDS.slice().sort());
    const encoded = JSON.stringify(result);
    assert.equal(encoded.includes(FICTIONAL_PHONE), false);
    assert.equal(encoded.includes("虚构姓名"), false);
    assert.equal(encoded.includes("虚构地址"), false);
    assert.equal(encoded.includes("DEMO-ORDER-0001"), false);
    assert.equal(encoded.includes(TRACKING), true);
  });

  it("does not call the network for an invalid or partial number", async () => {
    const calls: unknown[] = [];
    const result = await lookup.performLookup({
      config: { apiBase: "https://lookup.example.com" },
      phone: "1380000111",
      request: requestSpy({ statusCode: 200, data: { shipments: [] } }, calls),
    });
    assert.equal(result.status, "invalid");
    assert.equal(calls.length, 0);
  });

  it("reports an empty result without inventing shipment movement", async () => {
    const result = await lookup.performLookup({
      config: { apiBase: "https://lookup.example.com" },
      phone: FICTIONAL_PHONE,
      request: requestSpy({ statusCode: 200, data: { shipments: [], truncated: false } }, []),
    });
    assert.equal(result.status, "empty");
    assert.deepEqual(result.shipments, []);
    assert.equal(JSON.stringify(result).includes("运输中"), false);
  });

  it("keeps rate-limit and server failures separate from a successful copy", async () => {
    const limited = await lookup.performLookup({
      config: { apiBase: "https://lookup.example.com" },
      phone: FICTIONAL_PHONE,
      request: requestSpy({ statusCode: 429, data: { error: "查询过于频繁，请稍后再试。" } }, []),
    });
    assert.equal(limited.status, "limited");
    assert.match(limited.message, /频繁/);

    const failed = await lookup.performLookup({
      config: { apiBase: "https://lookup.example.com" },
      phone: FICTIONAL_PHONE,
      request: () => Promise.reject(new Error("offline")),
    });
    assert.equal(failed.status, "error");
    assert.equal(JSON.stringify(failed).includes(FICTIONAL_PHONE), false);
  });

  it("refuses a missing, insecure, or temporary demo endpoint", async () => {
    const calls: unknown[] = [];
    const missing = await lookup.performLookup({
      config: config.runtimeConfig,
      phone: FICTIONAL_PHONE,
      request: requestSpy({ statusCode: 200, data: { shipments: [] } }, calls),
    });
    assert.equal(config.runtimeConfig.apiBase, "");
    assert.equal(config.runtimeConfig.allowDemoTunnel, false);
    assert.equal(missing.status, "config");
    assert.equal(calls.length, 0);

    for (const candidate of [
      "http://lookup.example.com",
      "https://user:pass@lookup.example.com",
      "https://127.0.0.1",
      "https://lookup.example.com:443",
      "https://lookup.example.com/api",
      "https://random.trycloudflare.com",
    ]) {
      const resolved = apiBase.resolveApiBase({ apiBase: candidate, allowDemoTunnel: false });
      assert.equal(resolved.ok, false, candidate);
    }
  });

  it("allows a trycloudflare demo only when the demo flag is explicit", async () => {
    const blocked = apiBase.resolveApiBase({
      apiBase: "https://random.trycloudflare.com",
      allowDemoTunnel: false,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "demo-tunnel");

    const result = await lookup.performLookup({
      config: { apiBase: "https://random.trycloudflare.com", allowDemoTunnel: true },
      phone: FICTIONAL_PHONE,
      request: requestSpy({ statusCode: 200, data: { shipments: [sampleRow()] } }, []),
    });
    assert.equal(result.status, "results");
    assert.match(result.demoWarning, /trycloudflare/);
  });
});

describe("miniprogram copy and carrier jump", () => {
  it("copies only the tracking number and does not navigate afterwards", async () => {
    const copied: string[] = [];
    const result = await clipboard.copyTrackingNumber({
      trackingNumber: TRACKING,
      setClipboardData(options: { data: string; success: () => void; complete: () => void }) {
        copied.push(options.data);
        options.success();
        options.complete();
      },
    });
    const view = clipboard.handleCopyResult(result);
    assert.equal(result.ok, true);
    assert.deepEqual(copied, [TRACKING]);
    assert.equal(view.copyState, "copied");
    assert.equal(view.navigate, null);
    assert.match(view.message, /不会自动打开/);

    const page = read("pages/index/index.js");
    const copyBlock = page.slice(page.indexOf("onCopy("), page.indexOf("onJump("));
    assert.equal(copyBlock.includes("navigateToMiniProgram"), false);
    assert.equal(copyBlock.includes("requestCarrierJump"), false);
    assert.equal(page.split("wx.setClipboardData").length - 1, 1);
    assert.equal(page.split("wx.navigateToMiniProgram").length - 1, 1);
  });

  it("reports clipboard failure without starting a jump", async () => {
    const result = await clipboard.copyTrackingNumber({
      trackingNumber: TRACKING,
      setClipboardData(options: { fail: (err: { errMsg: string }) => void; complete: () => void }) {
        options.fail({ errMsg: "setClipboardData:fail privacy" });
        options.complete();
      },
    });
    const view = clipboard.handleCopyResult(result);
    assert.equal(result.ok, false);
    assert.equal(view.copyState, "failed");
    assert.equal(view.navigate, null);
    assert.match(view.message, /没有发起跳转/);
  });

  it("opens only the documented Yunda homepage and never sends phone or tracking params", async () => {
    const plan = carriers.buildCarrierJump("韵达快递");
    const calls: Array<{ appId: string; path: string; extraData: Record<string, string> }> = [];
    const copied: string[] = [];
    const result = await carriers.requestCarrierJump({
      plan: { ...plan, extraData: { phone: FICTIONAL_PHONE, mailNo: TRACKING } },
      userTap: true,
      phone: FICTIONAL_PHONE,
      trackingNumber: TRACKING,
      setClipboardData(options: { data: string; success: () => void; complete: () => void }) {
        copied.push(options.data);
        options.success();
        options.complete();
      },
      navigateToMiniProgram(options: {
        appId: string;
        path: string;
        extraData: Record<string, string>;
        success: () => void;
      }) {
        calls.push({ appId: options.appId, path: options.path, extraData: options.extraData });
        options.success();
      },
    });

    assert.match(plan.notice, /粘贴/);
    assert.equal(plan.passesTracking, false);
    assert.equal(plan.deviceVerified, false);
    assert.equal(result.status, "opened");
    assert.equal(result.copied, true);
    assert.deepEqual(copied, [TRACKING]);
    assert.match(result.message, /开发者工具不能真正完成跳转/);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      appId: "wxdeb5309aa3e93fd1",
      path: "",
      extraData: {},
    });
    const encoded = JSON.stringify(calls[0]);
    assert.equal(encoded.includes(FICTIONAL_PHONE), false);
    assert.equal(encoded.includes(TRACKING), false);
    assert.equal(encoded.includes("mailNo"), false);
  });

  it("does not call jump when the user cancels, the call fails, or the path was not verified", async () => {
    const plan = carriers.buildCarrierJump(" YUNDA ");
    const cancelled = await carriers.requestCarrierJump({
      plan,
      userTap: true,
      navigateToMiniProgram(options: { fail: (err: { errMsg: string }) => void }) {
        options.fail({ errMsg: "navigateToMiniProgram:fail cancel" });
      },
    });
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.called, true);
    assert.match(cancelled.message, /已取消跳转/);

    const failed = await carriers.requestCarrierJump({
      plan,
      userTap: true,
      navigateToMiniProgram(options: { fail: (err: { errMsg: string }) => void }) {
        options.fail({ errMsg: "navigateToMiniProgram:fail devtools cannot open another mini program" });
      },
    });
    assert.equal(failed.status, "failed");
    assert.match(failed.message, /开发者工具不能代替真机/);

    let called = false;
    const tampered = await carriers.requestCarrierJump({
      plan: { ...plan, path: "pages/query?mailNo=" + TRACKING },
      userTap: true,
      navigateToMiniProgram() {
        called = true;
      },
    });
    assert.equal(tampered.status, "rejected");
    assert.equal(tampered.called, false);
    assert.equal(called, false);

    const untapped = await carriers.requestCarrierJump({
      plan,
      userTap: false,
      navigateToMiniProgram() {
        called = true;
      },
    });
    assert.equal(untapped.status, "rejected");
    assert.equal(called, false);
  });

  it("jumps to the verified ZTO and EMS homepages and copies the number first", async () => {
    const expected = [
      ["中通快递", "wx7ddec43d9d27276a"],
      ["邮政快递包裹", "wx63e410bc2c6a792e"],
      ["EMS", "wx63e410bc2c6a792e"],
    ] as const;
    for (const [method, appId] of expected) {
      const plan = carriers.buildCarrierJump(method);
      const calls: Array<{ appId: string; path: string; extraData: Record<string, never> }> = [];
      const copied: string[] = [];
      const result = await carriers.requestCarrierJump({
        plan,
        userTap: true,
        trackingNumber: TRACKING,
        setClipboardData(options: { data: string; success: () => void; complete: () => void }) {
          copied.push(options.data);
          options.success();
          options.complete();
        },
        navigateToMiniProgram(options: {
          appId: string;
          path: string;
          extraData: Record<string, never>;
          success: () => void;
        }) {
          calls.push({ appId: options.appId, path: options.path, extraData: options.extraData });
          options.success();
        },
      });
      assert.equal(plan.enabled, true, method);
      assert.equal(plan.appId, appId);
      assert.equal(plan.passesTracking, false);
      assert.equal(result.status, "opened");
      assert.deepEqual(copied, [TRACKING]);
      assert.deepEqual(calls, [{ appId, path: "", extraData: {} }]);
      assert.equal(JSON.stringify(calls[0]).includes(TRACKING), false);
    }

    const unknown = carriers.buildCarrierJump("京东物流");
    let called = false;
    const blocked = await carriers.requestCarrierJump({
      plan: unknown,
      userTap: true,
      trackingNumber: TRACKING,
      navigateToMiniProgram() {
        called = true;
      },
    });
    assert.equal(unknown.enabled, false);
    assert.equal(blocked.status, "unconfigured");
    assert.equal(called, false);

    const card = present.presentShipment(sampleRow({ shippingMethod: "中通" }));
    assert.equal(card.showJump, true);
    assert.equal(card.jump.appId, "wx7ddec43d9d27276a");
    const yundaCard = present.presentShipment(sampleRow());
    assert.equal(yundaCard.showJump, true);
    assert.equal(yundaCard.sample, true);
    assert.equal(yundaCard.dateText, "2026年3月2日");
  });
});

describe("miniprogram source boundaries", () => {
  it("has the files a WeChat project needs", () => {
    for (const file of ["app.js", "app.json", "app.wxss", "sitemap.json", "project.config.json"]) {
      assert.equal(statSync(path.join(root, file)).isFile(), true, file);
    }
    const app = JSON.parse(read("app.json"));
    assert.ok(Array.isArray(app.pages) && app.pages.length > 0);
    for (const page of app.pages) {
      for (const ext of [".js", ".json", ".wxml", ".wxss"]) {
        assert.equal(statSync(path.join(root, `${page}${ext}`)).isFile(), true, `${page}${ext}`);
      }
    }
    JSON.parse(read("sitemap.json"));
    JSON.parse(read("project.config.json"));
  });

  it("does not declare an obsolete jump list, a carrier secret, or unread clipboard access", () => {
    const app = JSON.parse(read("app.json"));
    const project = JSON.parse(read("project.config.json"));
    assert.equal(Object.hasOwn(app, "navigateToMiniProgramAppIdList"), false);
    assert.equal(project.appid, "touristappid");
    assert.match(project.description, /touristappid/);
    assert.equal(app.__usePrivacyCheck__, true);

    const source = walkJs(root)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    assert.equal(source.includes("wx.getClipboardData"), false);
    assert.equal(source.includes("getPhoneNumber"), false);
    assert.equal(source.includes("navigateToMiniProgramAppIdList"), false);
    assert.equal(source.includes("wx48b603bcabbd1c20"), false);
    assert.equal(source.includes("wxdeb5309aa3e93fd1"), true);
    assert.equal(source.includes("wx7ddec43d9d27276a"), true);
    assert.equal(source.includes("wx63e410bc2c6a792e"), true);
    assert.equal(source.includes("TODO_APPID"), false);
  });
});

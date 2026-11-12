import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  YUNDA_QUERY_URL,
  ZTO_QUERY_URL,
  carrierDestination,
  isAllowlistedCarrierUrl,
} from "../src/lib/carriers.ts";

describe("carrier query links", () => {
  const yundaAliases = ["韵达", "韵达快递", "韵达速递", "YUNDA", "yunda", " 韵达快递 "];
  const ztoAliases = ["中通", "中通快递", "中通速递", "ZTO", "zto", "中 通"];

  for (const alias of yundaAliases) {
    it(`maps ${alias} to the Yunda query form`, () => {
      const destination = carrierDestination(alias);
      assert.ok(destination);
      assert.equal(destination.href, YUNDA_QUERY_URL);
      assert.equal(destination.carrierId, "yunda");
      assert.equal(destination.deepLink, false);
      assert.equal(destination.href.includes("?"), false);
    });
  }

  for (const alias of ztoAliases) {
    it(`maps ${alias} to the ZTO query form`, () => {
      const destination = carrierDestination(alias);
      assert.ok(destination);
      assert.equal(destination.href, ZTO_QUERY_URL);
      assert.equal(destination.carrierId, "zto");
      assert.equal(destination.deepLink, false);
    });
  }

  it("does not invent a link for an unrecognized or lookalike method", () => {
    for (const method of ["顺丰速运", "邮政快递包裹", "京东物流", "韵达国际", "中通冷链", "极兔", ""]) {
      assert.equal(carrierDestination(method), null);
    }
    assert.equal(carrierDestination("韵达快递 https://evil.example/phish"), null);
    assert.equal(carrierDestination("https://web.yundaex.com/Home"), null);
  });

  it("never places a tracking number or other site in the destination", () => {
    const destination = carrierDestination("韵达快递");
    assert.ok(destination);
    const tracking = "DEMO-YD-000001?next=https://evil.example";
    assert.equal(destination.href.includes(tracking), false);
    assert.equal(destination.href.includes("evil.example"), false);
    assert.equal(destination.href, "https://web.yundaex.com/Home");
    assert.equal(isAllowlistedCarrierUrl(destination.href), true);
    assert.equal(isAllowlistedCarrierUrl("https://evil.example"), false);
    assert.equal(isAllowlistedCarrierUrl("javascript:alert(1)"), false);
    assert.equal(isAllowlistedCarrierUrl(`${YUNDA_QUERY_URL}?mailNo=${encodeURIComponent(tracking)}`), false);
    assert.equal(isAllowlistedCarrierUrl(`${ZTO_QUERY_URL}?billCode=1`), false);
  });
});

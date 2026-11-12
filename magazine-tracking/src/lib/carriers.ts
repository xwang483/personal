/**
 * Official query pages verified on 2026-11-12.
 * Neither site documents a tracking-number query parameter:
 * - https://web.yundaex.com/Home is 韵达's page with a 运单号查询 form.
 *   https://www.yundaex.com/cn/trackResult?mailNo= returns 404.
 * - https://www.zto.com/check is 中通's 运单查询 form.
 * The hrefs below are fixed. Shipping methods never become URLs.
 */

export const YUNDA_QUERY_URL = "https://web.yundaex.com/Home";
export const ZTO_QUERY_URL = "https://www.zto.com/check";

export type CarrierDestination = {
  carrierId: "yunda" | "zto";
  carrierName: "韵达快递" | "中通快递";
  href: typeof YUNDA_QUERY_URL | typeof ZTO_QUERY_URL;
  /** True only when the official site itself accepts the tracking number in the URL. */
  deepLink: false;
};

const YUNDA: CarrierDestination = {
  carrierId: "yunda",
  carrierName: "韵达快递",
  href: YUNDA_QUERY_URL,
  deepLink: false,
};

const ZTO: CarrierDestination = {
  carrierId: "zto",
  carrierName: "中通快递",
  href: ZTO_QUERY_URL,
  deepLink: false,
};

const YUNDA_ALIASES = ["韵达", "韵达快递", "韵达速递", "yunda", "yundaex"];
const ZTO_ALIASES = ["中通", "中通快递", "中通速递", "zto"];

function normalizeMethod(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[\s\u00A0\u3000]+/g, "");
}

const ALIASES = new Map<string, CarrierDestination>();
for (const alias of YUNDA_ALIASES) ALIASES.set(normalizeMethod(alias), YUNDA);
for (const alias of ZTO_ALIASES) ALIASES.set(normalizeMethod(alias), ZTO);

export function carrierDestination(method: string): CarrierDestination | null {
  if (typeof method !== "string") return null;
  return ALIASES.get(normalizeMethod(method)) ?? null;
}

export function isAllowlistedCarrierUrl(url: string): boolean {
  return url === YUNDA_QUERY_URL || url === ZTO_QUERY_URL;
}

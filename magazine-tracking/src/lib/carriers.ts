/**
 * Official pages checked on 2026-11-13. None of these URLs take a tracking
 * number, so the hrefs stay fixed and shipping methods never become URLs.
 *
 * - https://web.yundaex.com/Home is 韵达's page with a 运单号查询 form.
 *   https://www.yundaex.com/cn/trackResult?mailNo= returns 404.
 * - https://www.zto.com/check is 中通's 运单查询 form.
 * - https://www.ems.com.cn/ is the China Post EMS site named by the Beijing
 *   government service page as the official logistics site:
 *   https://banshi.beijing.gov.cn/pubtask/logistics.html
 *   (“快递物流官网地址：http://www.ems.com.cn”). No bill-number query parameter
 *   was verified, so the link is the site origin only.
 */

export const YUNDA_QUERY_URL = "https://web.yundaex.com/Home";
export const ZTO_QUERY_URL = "https://www.zto.com/check";
export const EMS_QUERY_URL = "https://www.ems.com.cn/";

export type CarrierDestination = {
  carrierId: "yunda" | "zto" | "ems";
  carrierName: "韵达快递" | "中通快递" | "中国邮政EMS";
  href: typeof YUNDA_QUERY_URL | typeof ZTO_QUERY_URL | typeof EMS_QUERY_URL;
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

const EMS: CarrierDestination = {
  carrierId: "ems",
  carrierName: "中国邮政EMS",
  href: EMS_QUERY_URL,
  deepLink: false,
};

const YUNDA_ALIASES = ["韵达", "韵达快递", "韵达速递", "yunda", "yundaex"];
const ZTO_ALIASES = ["中通", "中通快递", "中通速递", "zto"];
const EMS_ALIASES = [
  "ems",
  "中国邮政",
  "中国邮政ems",
  "邮政ems",
  "邮政快递",
  "邮政快递包裹",
  "邮政包裹",
  "中国邮政速递",
  "邮政速递",
  "ems快递",
  "中国邮政快递",
  "平邮",
  "挂号信",
  "邮政",
];

function normalizeMethod(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[\s\u00A0\u3000]+/g, "");
}

const ALIASES = new Map<string, CarrierDestination>();
for (const alias of YUNDA_ALIASES) ALIASES.set(normalizeMethod(alias), YUNDA);
for (const alias of ZTO_ALIASES) ALIASES.set(normalizeMethod(alias), ZTO);
for (const alias of EMS_ALIASES) ALIASES.set(normalizeMethod(alias), EMS);

export function carrierDestination(method: string): CarrierDestination | null {
  if (typeof method !== "string") return null;
  return ALIASES.get(normalizeMethod(method)) ?? null;
}

export function isAllowlistedCarrierUrl(url: string): boolean {
  return url === YUNDA_QUERY_URL || url === ZTO_QUERY_URL || url === EMS_QUERY_URL;
}

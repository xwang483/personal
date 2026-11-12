export const REQUIRED_HEADERS = [
  "姓名",
  "收货地址",
  "邮寄方式",
  "单号",
  "日期",
  "电话",
  "杂志名称",
  "订单号",
] as const;

export type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DATA_ROWS = 10_000;
export const MAX_SHEET_ROWS = 20_000;
export const MAX_COLUMNS = 40;
export const MAX_ERRORS_SHOWN = 80;
export const MAX_PREVIEW_ROWS = 8;
export const MAX_LOOKUP_RESULTS = 100;
export const PREVIEW_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export const FIELD_LIMITS = {
  magazineName: 80,
  shippingMethod: 40,
  trackingNumber: 64,
  orderNumber: 64,
} as const;

export const SESSION_COOKIE = "mag_session";

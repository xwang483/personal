export type PhoneFailure = "empty" | "invalid" | "precision";

export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; code: PhoneFailure };

const SCIENTIFIC = /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/;

/**
 * Exact full-number normalization for Chinese mobile numbers.
 * Spaces, separators, a leading +86 / 86 / 0086, and Excel ".0" suffixes
 * collapse to 11 digits. Partial numbers stay invalid — they are never searched.
 */
export function normalizePhone(input: unknown): PhoneResult {
  if (input == null) return { ok: false, code: "empty" };

  if (typeof input === "number") {
    if (!Number.isFinite(input)) return { ok: false, code: "invalid" };
    if (!Number.isSafeInteger(input)) return { ok: false, code: "precision" };
    return normalizePhone(String(input));
  }

  if (typeof input !== "string") return { ok: false, code: "invalid" };

  let raw = input.normalize("NFKC").trim();
  if (!raw) return { ok: false, code: "empty" };
  raw = raw.replace(/^[''\u2018\u2019]+/, "");
  raw = raw.replace(/[\s\u00A0\u3000]+/g, "");
  if (!raw) return { ok: false, code: "empty" };

  if (SCIENTIFIC.test(raw)) return { ok: false, code: "precision" };
  if (/^\d+\.0+$/.test(raw)) raw = raw.replace(/\.0+$/, "");

  raw = raw.replace(/[()（）._\-/\\~～]/g, "");
  raw = raw.replace(/^\+/, "");

  if (raw.startsWith("0086")) raw = raw.slice(4);
  else if (raw.startsWith("86") && raw.length === 13) raw = raw.slice(2);

  if (!raw) return { ok: false, code: "empty" };
  if (!/^1[3-9]\d{9}$/.test(raw)) return { ok: false, code: "invalid" };
  return { ok: true, phone: raw };
}

export function publicPhoneMessage(code: PhoneFailure): string {
  if (code === "empty") return "请输入完整的11位手机号。";
  if (code === "precision") {
    return "这个号码无法安全识别。请直接输入完整的11位手机号，不要使用科学计数法。";
  }
  return "请输入完整的11位手机号。可以包含空格或 +86，但不能只填一部分。";
}

export function importPhoneMessage(code: PhoneFailure): string {
  if (code === "empty") return "电话为空。";
  if (code === "precision") {
    return "电话在表格里被存成数字或科学计数法，可能已经发生不可逆的精度损失。请把「电话」列设为文本，重新填入完整号码后再导入。";
  }
  return "电话不是完整的11位手机号。可以包含空格或 +86，但不能只填一部分。";
}

export function maskPhone(phone: string): string {
  if (!/^1[3-9]\d{9}$/.test(phone)) return "***********";
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

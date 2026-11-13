const SCIENTIFIC = /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/;

function fold(input) {
  if (typeof input.normalize === "function") return input.normalize("NFKC");
  return input.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function normalizePhone(input) {
  if (input == null) return { ok: false, code: "empty" };
  if (typeof input !== "string") return { ok: false, code: "invalid" };

  let raw = fold(input).trim();
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

function phoneMessage(code) {
  if (code === "empty") return "请输入完整的11位手机号。";
  if (code === "precision") {
    return "这个号码无法安全识别。请直接输入完整的11位手机号，不要使用科学计数法。";
  }
  return "请输入完整的11位手机号。可以包含空格或 +86，但不能只填一部分。";
}

module.exports = {
  normalizePhone,
  phoneMessage,
};

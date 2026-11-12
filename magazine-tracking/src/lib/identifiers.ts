export type IdentifierRead = {
  empty: boolean;
  text: string;
  precisionLoss: boolean;
};

const SCIENTIFIC = /[eE][+\-]?\d+$/;

/**
 * Preserve tracking numbers and order ids as text.
 * Numeric Excel cells are only trusted inside Number.MAX_SAFE_INTEGER.
 * Longer ids must be stored as text; otherwise Excel has already rounded them.
 */
export function readIdentifier(value: unknown, formatted?: string): IdentifierRead {
  const display = (formatted ?? "").trim();

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { empty: false, text: "", precisionLoss: true };
    if (!Number.isSafeInteger(value)) {
      return { empty: false, text: display || String(value), precisionLoss: true };
    }
    return { empty: false, text: String(value), precisionLoss: false };
  }

  if (typeof value === "string") {
    let text = value.replace(/^\uFEFF/, "").normalize("NFKC").trim();
    text = text.replace(/^[''\u2018\u2019]+/, "");
    if (!text) return { empty: true, text: "", precisionLoss: false };
    const compact = text.replace(/[\s\u00A0\u3000]/g, "");
    if (SCIENTIFIC.test(compact) && /^[+-]?\d+(?:\.\d+)?[eE][+\-]?\d+$/.test(compact)) {
      return { empty: false, text, precisionLoss: true };
    }
    if (/^\d+\.0+$/.test(compact)) {
      return { empty: false, text: compact.replace(/\.0+$/, ""), precisionLoss: false };
    }
    return { empty: false, text, precisionLoss: false };
  }

  if (value == null) return { empty: true, text: "", precisionLoss: false };
  if (value instanceof Date) return { empty: false, text: "", precisionLoss: true };

  return { empty: false, text: "", precisionLoss: true };
}

export function hasControlChar(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

export const PRECISION_ID_MESSAGE =
  "该列在 Excel 中被存成数字，且已超出可精确表示的整数范围，原值可能已经不可逆地丢失。请把这一列设为文本，重新填入完整内容后再导入。此行不会写入。";

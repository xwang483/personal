import { randomBytes } from "node:crypto";
import { MAX_LOOKUP_RESULTS, PREVIEW_TTL_MS } from "@/lib/constants";
import { getDb, transaction } from "@/lib/db";
import { identityKey } from "@/lib/identity";
import type { PublicShipment, ValidRow } from "@/lib/types";

export type CommitSummary = {
  inserted: number;
  updated: number;
  unchanged: number;
  shipmentCount: number;
};

function asNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return Number(value ?? 0);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function isValidRow(value: unknown): value is ValidRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ValidRow>;
  return (
    typeof row.row === "number" &&
    typeof row.phone === "string" &&
    /^1[3-9]\d{9}$/.test(row.phone) &&
    typeof row.magazineName === "string" &&
    row.magazineName.length > 0 &&
    row.magazineName.length <= 80 &&
    typeof row.shipDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.shipDate) &&
    typeof row.shippingMethod === "string" &&
    row.shippingMethod.length > 0 &&
    row.shippingMethod.length <= 40 &&
    typeof row.trackingNumber === "string" &&
    row.trackingNumber.length > 0 &&
    row.trackingNumber.length <= 64 &&
    typeof row.orderNumber === "string" &&
    row.orderNumber.length <= 64
  );
}

export function shipmentCount(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS c FROM shipments").get();
  return asNumber(row?.c);
}

export function lastImportAt(): string | null {
  const row = getDb()
    .prepare("SELECT created_at FROM import_log ORDER BY id DESC LIMIT 1")
    .get();
  if (!row) return null;
  const created = asString(row.created_at);
  return created || null;
}

export function findByPhone(phone: string): { shipments: PublicShipment[]; truncated: boolean } {
  const db = getDb();
  const countRow = db.prepare("SELECT COUNT(*) AS c FROM shipments WHERE phone = ?").get(phone);
  const total = asNumber(countRow?.c);
  const rows = db
    .prepare(
      `SELECT magazine_name, ship_date, shipping_method, tracking_number
       FROM shipments
       WHERE phone = ?
       ORDER BY ship_date DESC, magazine_name ASC, tracking_number ASC
       LIMIT ?`,
    )
    .all(phone, MAX_LOOKUP_RESULTS);

  const shipments: PublicShipment[] = rows.map((row) => ({
    magazineName: asString(row.magazine_name),
    date: asString(row.ship_date),
    shippingMethod: asString(row.shipping_method),
    trackingNumber: asString(row.tracking_number),
  }));

  return { shipments, truncated: total > shipments.length };
}

export function savePreview(rows: ValidRow[], fileExt: "csv" | "xlsx"): string {
  const token = cryptoRandom();
  const expiresAt = Date.now() + PREVIEW_TTL_MS;
  const db = getDb();
  db.prepare("DELETE FROM import_previews WHERE expires_at < ?").run(Date.now());
  db.prepare(
    "INSERT INTO import_previews (token, expires_at, file_ext, payload) VALUES (?, ?, ?, ?)",
  ).run(token, expiresAt, fileExt, JSON.stringify(rows));
  return token;
}

function cryptoRandom(): string {
  return randomBytes(32).toString("base64url");
}

export function commitPreview(token: string): CommitSummary | null {
  return transaction(() => {
    const db = getDb();
    const stored = db
      .prepare("SELECT payload, expires_at, file_ext FROM import_previews WHERE token = ?")
      .get(token);
    if (!stored) return null;
    db.prepare("DELETE FROM import_previews WHERE token = ?").run(token);
    if (asNumber(stored.expires_at) < Date.now()) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(asString(stored.payload));
    } catch {
      return null;
    }
    if (!Array.isArray(parsed) || !parsed.every(isValidRow)) return null;

    const now = new Date().toISOString();
    const selectExisting = db.prepare(
      "SELECT ship_date, shipping_method, tracking_number FROM shipments WHERE identity_key = ?",
    );
    const insert = db.prepare(
      `INSERT INTO shipments (
        identity_key, phone, magazine_name, ship_date, shipping_method,
        tracking_number, order_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const update = db.prepare(
      `UPDATE shipments
       SET tracking_number = ?, ship_date = ?, shipping_method = ?, updated_at = ?
       WHERE identity_key = ?`,
    );

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of parsed) {
      const key = identityKey(row);
      const existing = selectExisting.get(key);
      if (!existing) {
        insert.run(
          key,
          row.phone,
          row.magazineName,
          row.shipDate,
          row.shippingMethod,
          row.trackingNumber,
          row.orderNumber,
          now,
          now,
        );
        inserted += 1;
        continue;
      }
      const same =
        asString(existing.ship_date) === row.shipDate &&
        asString(existing.shipping_method) === row.shippingMethod &&
        asString(existing.tracking_number) === row.trackingNumber;
      if (same) {
        unchanged += 1;
        continue;
      }
      update.run(row.trackingNumber, row.shipDate, row.shippingMethod, now, key);
      updated += 1;
    }

    const fileExt = asString(stored.file_ext) === "xlsx" ? "xlsx" : "csv";
    db.prepare(
      `INSERT INTO import_log (created_at, inserted_count, updated_count, unchanged_count, file_ext)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(now, inserted, updated, unchanged, fileExt);

    return { inserted, updated, unchanged, shipmentCount: shipmentCount() };
  });
}

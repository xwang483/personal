import { createHash } from "node:crypto";
import type { ValidRow } from "@/lib/types";

/**
 * A repeat import of the same magazine order replaces the existing row,
 * including a corrected phone. The phone is not part of the key, so the old
 * number stops matching. Without an order number, the tracking number is the
 * stable id for that magazine.
 */
export function identityKey(
  row: Pick<ValidRow, "magazineName" | "trackingNumber" | "orderNumber">,
): string {
  const basis = row.orderNumber
    ? `order\u001f${row.magazineName}\u001f${row.orderNumber}`
    : `track\u001f${row.magazineName}\u001f${row.trackingNumber}`;
  return createHash("sha256").update(basis).digest("hex");
}

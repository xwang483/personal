import { createHash } from "node:crypto";
import type { ValidRow } from "@/lib/types";

/**
 * Repeat imports of the same shipment update the existing row.
 * An order number, when present, is the stable id so a corrected tracking
 * number does not leave a duplicate. Without an order number, the tracking
 * number itself distinguishes shipments.
 */
export function identityKey(
  row: Pick<ValidRow, "phone" | "magazineName" | "trackingNumber" | "orderNumber">,
): string {
  const basis = row.orderNumber
    ? `order\u001f${row.phone}\u001f${row.magazineName}\u001f${row.orderNumber}`
    : `track\u001f${row.phone}\u001f${row.magazineName}\u001f${row.trackingNumber}`;
  return createHash("sha256").update(basis).digest("hex");
}

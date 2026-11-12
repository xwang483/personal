import { requireAdmin, json } from "@/lib/http";
import { lastImportAt, shipmentCount } from "@/lib/shipments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req, false);
  if (denied) return denied;
  try {
    return json({ shipmentCount: shipmentCount(), lastImportAt: lastImportAt() });
  } catch (error) {
    console.error("stats failed", error instanceof Error ? error.name : "error");
    return json({ error: "暂时无法读取导入概况。" }, 500);
  }
}

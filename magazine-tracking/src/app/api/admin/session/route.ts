import { isAdminConfigured, isAuthenticated } from "@/lib/auth";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return json({
    configured: isAdminConfigured(),
    authenticated: isAuthenticated(req.headers.get("cookie")),
  });
}

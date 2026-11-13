import { NextResponse } from "next/server";
import { readerCookieOptions } from "@/lib/reader-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ ...readerCookieOptions(0), value: "" });
  return response;
}

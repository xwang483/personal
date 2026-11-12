import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminImport } from "@/components/admin-import";
import { verifySessionToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) redirect("/admin/login");

  return (
    <main className="sheet-page">
      <section className="sheet sheet-admin">
        <div className="rules" aria-hidden="true">
          <span />
          <span />
        </div>
        <AdminImport />
      </section>
    </main>
  );
}

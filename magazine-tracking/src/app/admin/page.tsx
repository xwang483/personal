import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminImport } from "@/components/admin-import";
import { SiteShell } from "@/components/site-shell";
import { verifySessionToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) redirect("/admin/login");

  return (
    <SiteShell current="admin">
      <section className="box">
        <h1 className="box-title">导入邮寄表</h1>
        <div className="box-body">
          <AdminImport />
        </div>
      </section>
    </SiteShell>
  );
}

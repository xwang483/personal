import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SiteShell } from "@/components/site-shell";
import { isAdminConfigured, verifySessionToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const jar = await cookies();
  if (verifySessionToken(jar.get(SESSION_COOKIE)?.value)) redirect("/admin");

  return (
    <SiteShell current="login">
      <section className="box login-box">
        <h1 className="box-title">登录后导入</h1>
        <div className="box-body">
          <p className="lede">账号来自服务器环境变量。页面不会显示密码，也不会把密码写进代码。</p>
          <LoginForm configured={isAdminConfigured()} />
          <p className="site-foot">
            <Link className="text-link" href="/">
              返回读者查询
            </Link>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isAdminConfigured, verifySessionToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const jar = await cookies();
  if (verifySessionToken(jar.get(SESSION_COOKIE)?.value)) redirect("/admin");

  return (
    <main className="sheet-page">
      <section className="sheet">
        <div className="rules" aria-hidden="true">
          <span />
          <span />
        </div>
        <Link className="wordmark" href="/">
          刊邮
        </Link>
        <p className="kicker">
          <span>管理人员</span>
          <i />
          <span>登录</span>
        </p>
        <h1>登录后导入</h1>
        <p className="lede">账号来自服务器环境变量。页面不会显示密码，也不会把密码写进代码。</p>
        <LoginForm configured={isAdminConfigured()} />
        <p className="site-foot">
          <Link className="quiet-link" href="/">
            返回读者查询
          </Link>
        </p>
      </section>
    </main>
  );
}

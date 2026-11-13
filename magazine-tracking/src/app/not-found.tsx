import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function NotFound() {
  return (
    <SiteShell current="lookup">
      <section className="box">
        <h1 className="box-title">没有这一页</h1>
        <div className="box-body">
          <p className="lede">查询邮寄单号请回到首页，管理人员请从「导入邮寄表」登录。</p>
          <p className="actions">
            <Link className="text-link" href="/">
              返回查询
            </Link>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}

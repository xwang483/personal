import Link from "next/link";

export default function NotFound() {
  return (
    <main className="sheet-page">
      <section className="sheet">
        <div className="rules" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="wordmark">刊邮</p>
        <h1>没有这一页</h1>
        <p className="lede">查询邮寄单号请回到首页，管理人员请从首页底部的入口登录。</p>
        <p className="site-foot">
          <Link className="quiet-link" href="/">
            返回查询
          </Link>
        </p>
      </section>
    </main>
  );
}

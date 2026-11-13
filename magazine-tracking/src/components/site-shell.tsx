import Link from "next/link";

type Current = "lookup" | "admin" | "login";

export function SiteShell({
  current,
  children,
}: {
  current: Current;
  children: React.ReactNode;
}) {
  return (
    <div className="store">
      <div className="topbar">
        <div className="wrap topbar-inner">
          <span>杂志邮寄服务</span>
          <span className="topbar-links">
            <Link href="/">单号查询</Link>
            <span aria-hidden="true">|</span>
            <Link href="/admin">管理人员</Link>
          </span>
        </div>
      </div>
      <header className="mast">
        <div className="wrap mast-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">刊邮</span>
            <span className="brand-text">
              <strong>杂志邮寄单号查询</strong>
              <em>按手机号查看已录入的快递单号</em>
            </span>
          </Link>
          <nav className="util" aria-label="快捷入口">
            <Link href="/">查询单号</Link>
            <Link href="/admin">管理人员入口</Link>
          </nav>
        </div>
      </header>
      <nav className="goldnav" aria-label="栏目">
        <div className="wrap goldnav-inner">
          <Link href="/" className={current === "lookup" ? "on" : undefined}>
            单号查询
          </Link>
          <Link href="/admin" className={current === "lookup" ? undefined : "on"}>
            导入邮寄表
          </Link>
        </div>
      </nav>
      <div className="goldbar">
        <div className="wrap goldbar-inner">
          <span>填写收件时登记的完整手机号。结果只有杂志、日期、邮寄方式和单号。</span>
        </div>
      </div>
      <main className="wrap main">{children}</main>
      <footer className="foot">
        <div className="wrap foot-help">
          <div>
            <p className="foot-title">查询范围</p>
            <p>只按完整手机号精确匹配。不显示姓名、地址和手机号，也不拉取物流轨迹或预计送达时间。</p>
          </div>
          <div>
            <p className="foot-title">关于版式</p>
            <p>配色和栏位参照公开的杂志商城页面。本站不是那家商城，不使用它的标志、刊名商标或客服电话。</p>
          </div>
        </div>
        <div className="wrap foot-copy">
          <p>刊邮 · 杂志邮寄单号查询。标注「示例」的记录都是虚构数据。</p>
        </div>
      </footer>
    </div>
  );
}

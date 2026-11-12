import Link from "next/link";
import { ReaderLookup } from "@/components/reader-lookup";

export default function HomePage() {
  return (
    <main className="sheet-page">
      <article className="sheet">
        <div className="rules" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="wordmark">刊邮</p>
        <p className="kicker">
          <span>读者服务</span>
          <i />
          <span>只查单号</span>
        </p>
        <h1>杂志邮寄单号查询</h1>
        <p className="lede">
          填写收件时登记的完整手机号，查看已录入的杂志名称、寄出日期、邮寄方式和快递单号。不用姓名，也不用订单号。
        </p>
        <ReaderLookup />
        <footer className="site-foot">
          <p className="fine">
            只按完整号码精确匹配。结果里没有姓名、地址和手机号，也不会出现别人的记录。韵达和中通可以打开官方查询页，单号需要自己粘贴，页面不会自动填入。这里不拉取物流轨迹，也没有预计送达时间。
          </p>
          <p className="fine">标注「示例」的记录都是虚构数据，用来演示查询，不代表真实邮寄。</p>
          <Link className="quiet-link" href="/admin">
            管理人员入口
          </Link>
        </footer>
      </article>
    </main>
  );
}

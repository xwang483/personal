import { ReaderLookup } from "@/components/reader-lookup";
import { SiteShell } from "@/components/site-shell";

export default function HomePage() {
  return (
    <SiteShell current="lookup">
      <div className="columns">
        <aside className="side">
          <section className="box">
            <h2 className="box-title">查询说明</h2>
            <div className="box-body">
              <ul className="side-list">
                <li>填写完整手机号</li>
                <li>空格和 +86 可以留着</li>
                <li>只匹配已导入的记录</li>
                <li>不会出现别人的单号</li>
              </ul>
            </div>
          </section>
          <section className="box">
            <h2 className="box-title">物流跳转</h2>
            <div className="box-body">
              <p>韵达、中通和中国邮政 EMS 可以打开官网。页面不会自动填入单号，请先复制再粘贴。</p>
            </div>
          </section>
        </aside>
        <section className="box">
          <h1 className="box-title">杂志邮寄单号查询</h1>
          <div className="box-body">
            <p className="lede">
              填写收件时登记的完整手机号，查看已录入的杂志名称、寄出日期、邮寄方式和快递单号。不用姓名，也不用订单号。
            </p>
            <ReaderLookup />
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

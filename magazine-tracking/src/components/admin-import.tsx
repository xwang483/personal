"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatChineseDate } from "@/lib/dates";

type PreviewError = { row: number; field: string; message: string };
type PreviewCard = {
  row: number;
  magazineName: string;
  date: string;
  shippingMethod: string;
  trackingNumber: string;
  phoneMasked: string;
};

type Preview = {
  token: string | null;
  fileType: "csv" | "xlsx";
  encoding: "utf-8" | "gb18030" | null;
  totalDataRows: number;
  blankRows: number;
  validCount: number;
  duplicateRows: number;
  ignoredBlankColumns: number;
  ignoredColumns: string[];
  errorCount: number;
  errors: PreviewError[];
  errorsTruncated: boolean;
  preview: PreviewCard[];
  previewTruncated: boolean;
  canCommit: boolean;
};

type Summary = {
  inserted: number;
  updated: number;
  unchanged: number;
  shipmentCount: number;
};

type AdminShipment = {
  id: number;
  phoneMasked: string;
  magazineName: string;
  date: string;
  shippingMethod: string;
  trackingNumber: string;
};

const downloads = [
  { href: "/api/admin/template?kind=template&format=csv", label: "空白模板 CSV" },
  { href: "/api/admin/template?kind=template&format=xlsx", label: "空白模板 Excel" },
  { href: "/api/admin/template?kind=sample&format=csv", label: "虚构示例 CSV" },
  { href: "/api/admin/template?kind=sample&format=xlsx", label: "虚构示例 Excel" },
];

export function AdminImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<"idle" | "working" | "ready" | "done" | "error">("idle");
  const [fileLabel, setFileLabel] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stats, setStats] = useState<{ shipmentCount: number; lastImportAt: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<AdminShipment[]>([]);
  const [deleteMessage, setDeleteMessage] = useState("");

  async function loadStats() {
    const response = await fetch("/api/admin/stats", { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) return;
    setStats((await response.json()) as { shipmentCount: number; lastImportAt: string | null });
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (response.ok) setStats(await response.json());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  async function previewFile(file: File) {
    setPhase("working");
    setMessage("");
    setSummary(null);
    setPreview(null);
    setFileLabel(file.name);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/admin/import/preview", { method: "POST", body: form });
      const body = (await response.json()) as Preview & { error?: string };
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        setPhase("error");
        setMessage(body.error || "文件没有通过校验。");
        return;
      }
      setPreview(body);
      setPhase("ready");
    } catch {
      setPhase("error");
      setMessage("上传没有完成，请重试。");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function commit() {
    if (!preview?.token) return;
    setPhase("working");
    setMessage("");
    try {
      const response = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: preview.token }),
      });
      const body = (await response.json()) as Summary & { error?: string };
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        setPhase("error");
        setMessage(body.error || "导入没有完成。");
        return;
      }
      setSummary(body);
      setPreview(null);
      setPhase("done");
      await loadStats();
    } catch {
      setPhase("error");
      setMessage("导入没有完成，请重新上传后再确认。");
    }
  }

  async function searchShipments(event?: React.FormEvent) {
    event?.preventDefault();
    setDeleteMessage("");
    const response = await fetch(`/api/admin/shipments?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) return;
    const body = (await response.json()) as { shipments?: AdminShipment[] };
    setFound(body.shipments ?? []);
  }

  async function removeShipment(id: number) {
    const response = await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) {
      setDeleteMessage("没有删掉这条记录。");
      return;
    }
    setFound((current) => current.filter((item) => item.id !== id));
    setDeleteMessage("已删除。");
    await loadStats();
  }

  return (
    <>
      <div className="admin-bar">
        <p className="lede">
          上传 .xlsx 或 CSV。表头需与模板一致，空白间隔列会忽略。姓名和收货地址只用来认出表格，不会写入数据库，也不会出现在读者查询里。
        </p>
        <Button type="button" variant="outline" className="h-10 shrink-0" onClick={logout}>
          退出
        </Button>
      </div>
      <p className="stat-line">
        {stats
          ? `已收录 ${stats.shipmentCount} 条记录${stats.lastImportAt ? ` · 最近导入 ${stats.lastImportAt.slice(0, 16).replace("T", " ")}` : ""}`
          : "正在读取收录概况"}
      </p>

      <div className="download-row">
        {downloads.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </div>

      <label
        className={over ? "dropzone over" : "dropzone"}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void previewFile(file);
        }}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void previewFile(file);
          }}
        />
        <span>
          <strong>{phase === "working" ? "正在校验文件" : "选择或拖入 Excel / CSV"}</strong>
          <span className="fine mt-1 block">最大 5MB。上传后先预览，确认后才会写入。</span>
          {fileLabel ? <span className="fine mt-2 block">{fileLabel}</span> : null}
        </span>
      </label>
      {phase === "working" ? <div className="loading-line" /> : null}

      {phase === "error" ? (
        <div className="panel panel-bad" role="alert">
          <h2>没有导入</h2>
          <p>{message}</p>
        </div>
      ) : null}

      {phase === "ready" && preview ? (
        <section className="panel" aria-live="polite">
          <h2>请确认后再导入</h2>
          <p>
            {preview.fileType === "csv"
              ? `CSV · ${preview.encoding === "gb18030" ? "GB18030" : "UTF-8"}`
              : "Excel"}
            。共 {preview.totalDataRows} 行数据，可导入 {preview.validCount} 行。
            {preview.ignoredBlankColumns > 0 ? ` 已忽略 ${preview.ignoredBlankColumns} 个空白间隔列。` : ""}
          </p>
          <div className="count-row">
            <span>可导入 {preview.validCount}</span>
            <span>错误 {preview.errorCount}</span>
            <span>文件内重复 {preview.duplicateRows}</span>
            <span>空行 {preview.blankRows}</span>
          </div>
          {preview.ignoredColumns.length > 0 ? (
            <p className="fine">已忽略无法识别的列：{preview.ignoredColumns.join("、")}</p>
          ) : null}
          {preview.errors.length > 0 ? (
            <ul className="error-list">
              {preview.errors.map((error, index) => (
                <li key={`${error.row}-${error.field}-${index}`}>
                  <strong>
                    第 {error.row} 行 · {error.field}
                  </strong>
                  <p>{error.message}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {preview.errorsTruncated ? <p className="fine">其余错误未全部列出。</p> : null}
          {preview.preview.length > 0 ? (
            <ul className="result-list">
              {preview.preview.map((row) => (
                <li key={`${row.row}-${row.trackingNumber}`} className="result-card">
                  <p className="fine">第 {row.row} 行 · 号码核对 {row.phoneMasked}</p>
                  <h3>{row.magazineName}</h3>
                  <dl className="meta">
                    <dt>寄出日期</dt>
                    <dd>{formatChineseDate(row.date)}</dd>
                    <dt>邮寄方式</dt>
                    <dd>{row.shippingMethod}</dd>
                    <dt>快递单号</dt>
                    <dd className="tracking-no">{row.trackingNumber}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          ) : null}
          {preview.previewTruncated ? <p className="fine">只预览前几条通过校验的记录。</p> : null}
          <p className="fine mt-3">
            有错误的行不会导入。确认后只写入校验通过的记录。同一订单或同一单号再次导入时会更新，不会重复添加。
          </p>
          <div className="actions">
            <Button type="button" className="h-12 w-full text-base" disabled={!preview.canCommit} onClick={commit}>
              {preview.canCommit ? `确认导入 ${preview.validCount} 条` : "没有可以导入的记录"}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "done" && summary ? (
        <section className="panel" aria-live="polite">
          <h2>导入完成</h2>
          <div className="count-row">
            <span>新增 {summary.inserted}</span>
            <span>更新 {summary.updated}</span>
            <span>未变化 {summary.unchanged}</span>
          </div>
          <p>库内现有 {summary.shipmentCount} 条记录。再次导入相同文件不会重复添加。</p>
        </section>
      ) : null}

      <form className="lookup-form" onSubmit={searchShipments}>
        <Label htmlFor="shipment-query" className="field-label">
          删除一条记录
        </Label>
        <Input
          id="shipment-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="单号、订单号或完整手机号"
          className="store-input h-11 bg-white px-3 text-base"
        />
        <div className="actions">
          <Button type="submit" variant="outline" className="store-btn h-11">
            查找
          </Button>
        </div>
      </form>
      {deleteMessage ? <p className="field-hint mt-2">{deleteMessage}</p> : null}
      {found.length > 0 ? (
        <ul className="result-list">
          {found.map((item) => (
            <li key={item.id} className="result-card">
              <h3>{item.magazineName}</h3>
              <p className="fine">
                {item.date} · {item.shippingMethod} · {item.phoneMasked}
              </p>
              <p className="tracking-no">{item.trackingNumber}</p>
              <div className="actions">
                <Button type="button" variant="outline" className="store-btn h-11" onClick={() => removeShipment(item.id)}>
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="site-foot">
        <p className="fine">
          电话、单号、订单号请在 Excel 里设为文本。超过 15 位的数字会被 Excel 改掉，这种行会在校验时拒绝，并说明精度损失无法恢复。
        </p>
        <p className="fine">虚构示例文件里的姓名、地址和单号都不是真实邮寄。导入后，查询结果只会带上杂志名称中的「示例」。</p>
      </footer>
    </>
  );
}

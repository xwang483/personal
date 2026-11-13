"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { carrierDestination, isAllowlistedCarrierUrl } from "@/lib/carriers";
import { formatChineseDate } from "@/lib/dates";
import type { PublicShipment } from "@/lib/types";

type Status = "idle" | "loading" | "results" | "empty" | "invalid" | "error" | "limited";
type CopyState = "copied" | "failed";

function copyTextSync(value: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

async function copyText(value: string): Promise<boolean> {
  if (copyTextSync(value)) return true;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Permission can be denied; the caller shows a manual-copy hint.
  }
  return false;
}

export function ReaderLookup() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [shipments, setShipments] = useState<PublicShipment[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<Record<number, CopyState>>({});

  async function lookup(event?: React.FormEvent) {
    event?.preventDefault();
    setCopied(null);
    setCopyState({});
    if (!phone.trim()) {
      setStatus("invalid");
      setMessage("请输入完整的11位手机号。");
      setShipments([]);
      return;
    }

    setStatus("loading");
    setMessage("");
    setShipments([]);
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
        cache: "no-store",
      });
      const body = (await response.json()) as {
        error?: string;
        shipments?: PublicShipment[];
        truncated?: boolean;
      };
      if (response.status === 400) {
        setStatus("invalid");
        setMessage(body.error || "请输入完整的11位手机号。");
        return;
      }
      if (response.status === 429) {
        setStatus("limited");
        setMessage(body.error || "查询过于频繁，请稍后再试。");
        return;
      }
      if (!response.ok || !Array.isArray(body.shipments)) {
        setStatus("error");
        setMessage(body.error || "查询暂时不可用，请稍后再试。");
        return;
      }
      setTruncated(Boolean(body.truncated));
      setShipments(body.shipments);
      setStatus(body.shipments.length === 0 ? "empty" : "results");
    } catch {
      setStatus("error");
      setMessage("查询没有完成。请检查网络后重试。");
    }
  }

  async function onCopy(value: string, index: number) {
    const copiedOk = await copyText(value);
    setCopyState((current) => ({ ...current, [index]: copiedOk ? "copied" : "failed" }));
    setCopied(copiedOk ? index : null);
  }

  function onOpenCarrier(href: string, trackingNumber: string, index: number) {
    if (!isAllowlistedCarrierUrl(href)) return;
    const copiedOk = copyTextSync(trackingNumber);
    setCopyState((current) => ({ ...current, [index]: copiedOk ? "copied" : "failed" }));
    setCopied(copiedOk ? index : null);
  }

  return (
    <>
      <form className="lookup-form" onSubmit={lookup} noValidate>
        <Label htmlFor="phone" className="field-label">
          手机号
        </Label>
        <Input
          id="phone"
          name="phone"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            if (status === "invalid") setStatus("idle");
          }}
          inputMode="tel"
          autoComplete="tel"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          placeholder="请输入完整手机号"
          aria-invalid={status === "invalid"}
          aria-describedby={status === "invalid" ? "phone-error" : "phone-hint"}
          className="store-input h-11 bg-white px-3 text-base md:text-base"
        />
        <p id="phone-hint" className="field-hint mt-2">
          需要全部数字。空格和 +86 可以留着，系统会按完整号码精确匹配。
        </p>
        {status === "invalid" ? (
          <p id="phone-error" className="field-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="actions">
          <Button
            type="submit"
            disabled={status === "loading"}
            className="store-btn h-11 w-full text-base"
          >
            {status === "loading" ? "正在查询" : "查询单号"}
          </Button>
        </div>
      </form>

      <div aria-live="polite">
        {status === "loading" ? <div className="loading-line" /> : null}

        {status === "empty" ? (
          <div className="panel">
            <h2>没有找到邮寄记录</h2>
            <p>这个手机号下面还没有导入的杂志单号。若刊物刚寄出，可能尚未录入。</p>
          </div>
        ) : null}

        {status === "error" || status === "limited" ? (
          <div className="panel panel-bad">
            <h2>{status === "limited" ? "查询过于频繁" : "查询没有完成"}</h2>
            <p>{message}</p>
            {status === "error" ? (
              <div className="actions">
                <Button type="button" variant="outline" className="store-btn h-11" onClick={() => lookup()}>
                  再试一次
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {status === "results" ? (
          <>
            <div className="result-head">
              <h2 className="serif text-lg">找到 {shipments.length} 条邮寄记录</h2>
              <p className="fine">按寄出日期从新到旧</p>
            </div>
            <ul className="result-list">
              {shipments.map((shipment, index) => {
                const sample = shipment.magazineName.includes("示例");
                const carrier = carrierDestination(shipment.shippingMethod);
                const state = copyState[index];
                return (
                  <li key={`${shipment.trackingNumber}-${shipment.date}-${index}`} className="result-card">
                    {sample ? <span className="stamp">虚构示例</span> : null}
                    <h3>{shipment.magazineName}</h3>
                    <dl className="meta">
                      <dt>寄出日期</dt>
                      <dd>{formatChineseDate(shipment.date)}</dd>
                      <dt>邮寄方式</dt>
                      <dd>{shipment.shippingMethod}</dd>
                    </dl>
                    <div className="tracking-row">
                      <p className="fine">快递单号</p>
                      <p className="tracking-no">{shipment.trackingNumber}</p>
                      <div className="tracking-actions">
                        <Button
                          type="button"
                          variant="outline"
                          className="store-btn h-11 px-3"
                          onClick={() => onCopy(shipment.trackingNumber, index)}
                        >
                          {copied === index ? <Check /> : <Copy />}
                          {copied === index ? "已复制" : "复制"}
                        </Button>
                        {carrier ? (
                          <Button asChild className="store-btn h-11 px-3">
                            <a
                              href={carrier.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => onOpenCarrier(carrier.href, shipment.trackingNumber, index)}
                            >
                              查询物流
                            </a>
                          </Button>
                        ) : null}
                      </div>
                      {carrier ? (
                        <p className="fine mt-2">
                          打开{carrier.carrierName}官方页面。单号不会自动填入，请粘贴后再查。
                          {state === "failed" ? " 没能复制单号，请在打开的页面手动输入。" : null}
                          {state === "copied" ? " 单号已复制。" : null}
                        </p>
                      ) : (
                        <p className="fine mt-2">
                          暂不能跳转到这家快递的官方查询页。请复制单号后自行查询。
                          {state === "failed" ? " 没能复制，请长按单号手动复制。" : null}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {truncated ? <p className="fine mt-3">只显示最近 100 条。</p> : null}
          </>
        ) : null}
      </div>
    </>
  );
}

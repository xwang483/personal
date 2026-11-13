"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error || "用户名或密码不正确。");
        setPending(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("登录没有完成，请重试。");
      setPending(false);
    }
  }

  return (
    <form className="lookup-form" onSubmit={onSubmit}>
      {!configured ? (
        <div className="panel panel-bad">
          <h2>登录尚未配置</h2>
          <p>
            请在服务器环境变量中设置 ADMIN_USERNAME、ADMIN_PASSWORD 和 ADMIN_SESSION_SECRET，然后重启应用。页面不会显示或生成密码。
          </p>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4">
        <div>
          <Label htmlFor="username" className="field-label">
            用户名
          </Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={!configured || pending}
            className="h-12 bg-white px-3 text-base md:text-base"
          />
        </div>
        <div>
          <Label htmlFor="password" className="field-label">
            密码
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!configured || pending}
            className="h-12 bg-white px-3 text-base md:text-base"
          />
        </div>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions">
        <Button type="submit" disabled={!configured || pending} className="h-12 w-full text-base">
          {pending ? "正在登录" : "登录"}
        </Button>
      </div>
    </form>
  );
}

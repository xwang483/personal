function resolveApiBase(config) {
  const raw = String((config && config.apiBase) || "").trim();
  if (!raw) {
    return {
      ok: false,
      code: "missing",
      message:
        "尚未填写 HTTPS 接口地址。请在 miniprogram/config.js 写入已备案域名，并在小程序后台把它配成 request 合法域名。",
    };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, code: "invalid", message: "接口地址无法识别。" };
  }

  if (url.username || url.password) {
    return { ok: false, code: "credentials", message: "接口地址里不能带账号或密码。" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, code: "https", message: "接口必须是 HTTPS。正式版不能使用 http。" };
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) {
    return { ok: false, code: "localhost", message: "不能使用 localhost 或本机域名。" };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.includes(":")) {
    return { ok: false, code: "ip", message: "request 合法域名不能是 IP 地址。" };
  }
  const explicitPort = /^https?:\/\/[^/\s?#]+:\d+(?:[/?#]|$)/.test(raw);
  if (explicitPort || url.port) {
    return { ok: false, code: "port", message: "正式接口不要写端口，默认 443 也不要写进地址。" };
  }
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) {
    return { ok: false, code: "path", message: "这里只填域名根地址。查询路径固定是 /api/lookup。" };
  }

  const demo = url.hostname === "trycloudflare.com" || url.hostname.endsWith(".trycloudflare.com");
  if (demo && !config.allowDemoTunnel) {
    return {
      ok: false,
      code: "demo-tunnel",
      message:
        "trycloudflare 临时域名只能在开发者工具里做演示，不能当作正式接口，也不能配置为 request 合法域名。上传前请改成已备案的 HTTPS 域名，并保持 allowDemoTunnel 为 false。",
    };
  }

  return {
    ok: true,
    origin: url.origin,
    demo,
    warning: demo ? "当前是 trycloudflare 临时演示地址，不能用于正式版或审核版。" : "",
  };
}

module.exports = {
  resolveApiBase,
};

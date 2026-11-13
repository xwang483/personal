/**
 * Starts the magazine-tracking site and drives the reader lookup:
 * load the page, reject a partial number, then enter the sample phone and
 * read back the fictional tracking numbers.
 *
 * Usage (from magazine-tracking/): node scripts/verify-site.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.VERIFY_PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const dbDir = mkdtempSync(path.join(tmpdir(), "magazine-verify-"));
const chromePort = port + 100;

const FEATURES = [
  "GET / 先发短信验证码，通过后才查询",
  "POST /api/lookup 只认已验证会话，忽略请求体里的手机号",
  "错误验证码被拒绝；通过后只能看到自己的单号",
  "韵达、中通、中国邮政 EMS 只打开固定官网地址，点击查询物流会复制单号",
  "390px 下同样能完成验证并看到邮政链接",
  "POST /admin 登录后导入表格；小程序在 miniprogram/，本脚本不启动微信开发者工具",
];

function log(line) {
  console.log(line);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // The dev server is still booting.
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${url}`);
}

function startServer() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      ADMIN_USERNAME: "verify-admin",
      ADMIN_PASSWORD: "verify-password-please",
      ADMIN_SESSION_SECRET: "verify-session-secret-at-least-32",
      DATABASE_PATH: path.join(dbDir, "shipments.sqlite"),
      TRUST_PROXY: "0",
      SMS_PROVIDER: "console",
      NODE_ENV: "development",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  child.output = () => output;
  return child;
}

async function importSample() {
  const headers = { origin, "content-type": "application/json" };
  const login = await fetch(`${origin}/api/admin/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username: "verify-admin", password: "verify-password-please" }),
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = (login.headers.getSetCookie?.() || []).map((item) => item.split(";")[0]).join("; ");
  const sample = await fetch(`${origin}/api/admin/template?kind=sample&format=csv`, {
    headers: { cookie, origin },
  });
  if (!sample.ok) throw new Error(`sample ${sample.status}`);
  const form = new FormData();
  form.append("file", new Blob([await sample.arrayBuffer()], { type: "text/csv" }), "sample.csv");
  const preview = await fetch(`${origin}/api/admin/import/preview`, {
    method: "POST",
    headers: { cookie, origin },
    body: form,
  });
  const previewBody = await preview.json();
  if (!preview.ok || !previewBody.token) throw new Error(`preview ${preview.status}`);
  const commit = await fetch(`${origin}/api/admin/import/commit`, {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify({ token: previewBody.token }),
  });
  if (!commit.ok) throw new Error(`commit ${commit.status}`);
}

function startChrome() {
  return spawn(
    process.env.CHROME || "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      `--remote-debugging-port=${chromePort}`,
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
}

async function connectChrome() {
  let version;
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${chromePort}/json/version`);
      if (response.ok) {
        version = await response.json();
        break;
      }
    } catch {
      // DevTools is still opening.
    }
    await sleep(150);
  }
  if (!version) throw new Error("Chrome DevTools did not start");

  const browser = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browser.addEventListener("open", resolve);
    browser.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  browser.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });
  function send(method, params = {}, sessionId) {
    const msgId = ++id;
    const payload = { id: msgId, method, params };
    if (sessionId) payload.sessionId = sessionId;
    browser.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Browser.grantPermissions", {
    origin,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  }).catch(() => undefined);
  return {
    browser,
    async viewport(width, height) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: width < 500 },
        sessionId,
      );
    },
    async goto(url) {
      await send("Page.navigate", { url }, sessionId);
      await sleep(800);
    },
    async eval(expression) {
      const result = await send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || "page exception");
      }
      return result.result?.value;
    },
  };
}

function latestCode(output, phone) {
  const matches = [...output.matchAll(new RegExp(`sms dev phone=${phone} code=(\\d{6})`, "g"))];
  return matches.at(-1)?.[1] ?? "";
}

async function waitForCode(server, phone) {
  for (let i = 0; i < 20; i += 1) {
    const code = latestCode(server.output(), phone);
    if (code) return code;
    await sleep(200);
  }
  throw new Error(`sms code for ${phone} was not logged`);
}

async function drive(page, server) {
  await page.viewport(1280, 900);
  await page.goto(origin + "/");
  const title = await page.eval("document.body.innerText");
  if (!String(title).includes("杂志邮寄单号查询")) throw new Error("lookup page did not render");
  log("PASS load page");

  const invalid = await page.eval(`(() => {
    const input = document.querySelector('#phone');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '1380000111');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
    return new Promise((resolve) => setTimeout(() => resolve(document.body.innerText), 700));
  })()`);
  if (!String(invalid).includes("请输入完整的11位手机号")) throw new Error("partial number was not rejected");
  if (String(invalid).includes("DEMO-YD-000001")) throw new Error("partial number returned a tracking result");
  log("PASS reject partial phone");

  await page.eval(`(() => {
    const input = document.querySelector('#phone');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '138 0000 1111');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
    return true;
  })()`);
  const code = await waitForCode(server, "13800001111");
  log("PASS dev provider logged a code");

  const wrong = await page.eval(`(() => new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const input = document.querySelector('#code');
      if (!input) {
        if (Date.now() - started > 4000) resolve('missing code field');
        else setTimeout(tick, 100);
        return;
      }
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '000000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.form.requestSubmit();
      setTimeout(() => resolve(document.body.innerText), 800);
    };
    tick();
  }))()`);
  if (!String(wrong).includes("验证码不正确")) throw new Error("wrong code was accepted");
  if (String(wrong).includes("DEMO-YD-000001")) throw new Error("wrong code showed shipments");
  log("PASS wrong code rejected");

  const result = await page.eval(`((code) => {
    const input = document.querySelector('#code');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
    return new Promise((resolve) => setTimeout(() => {
      const links = [...document.querySelectorAll('a[target="_blank"]')].map((node) => node.href);
      resolve(JSON.stringify({ text: document.body.innerText, links }));
    }, 1200));
  })(${JSON.stringify(code)})`);
  const parsed = JSON.parse(result);
  for (const tracking of ["DEMO-YD-000001", "DEMO-ZT-000002"]) {
    if (!parsed.text.includes(tracking)) throw new Error(`missing tracking number ${tracking}`);
  }
  if (parsed.text.includes("DEMO-JD-000003") || parsed.text.includes("DEMO-EMS-000004")) {
    throw new Error("verified phone saw another subscriber's shipment");
  }
  const allowed = ["https://web.yundaex.com/Home", "https://www.zto.com/check"];
  if (parsed.links.length < 2) throw new Error("carrier links missing");
  for (const href of parsed.links) {
    if (!allowed.includes(href)) throw new Error(`unexpected carrier link ${href}`);
    if (href.includes("DEMO-")) throw new Error("tracking number was appended to a carrier link");
  }
  log("PASS right code shows only own shipments");

  const copied = await page.eval(`(() => {
    const link = document.querySelector('a[href="https://web.yundaex.com/Home"]');
    link.click();
    return new Promise((resolve) => setTimeout(async () => {
      let clip = "";
      try { clip = await navigator.clipboard.readText(); } catch (error) { clip = ""; }
      resolve(JSON.stringify({ clip, text: document.body.innerText }));
    }, 300));
  })()`);
  const copyParsed = JSON.parse(copied);
  if (copyParsed.clip !== "DEMO-YD-000001") throw new Error(`clipboard was ${JSON.stringify(copyParsed.clip)}`);
  if (!copyParsed.text.includes("单号已复制")) throw new Error("copy confirmation missing");
  log("PASS clicked 查询物流 and copied the tracking number");

  const idor = await page.eval(`(() => fetch('/api/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13900002222' }),
  }).then((response) => response.json()))()`);
  if (JSON.stringify(idor).includes("DEMO-JD") || JSON.stringify(idor).includes("DEMO-EMS")) {
    throw new Error("session for one phone returned another phone's shipments");
  }
  if (!JSON.stringify(idor).includes("DEMO-YD-000001")) throw new Error("own shipments disappeared");
  log("PASS request body phone cannot read another subscriber");

  await page.viewport(390, 844);
  await page.goto(origin + "/");
  await page.eval(`(() => {
    const button = [...document.querySelectorAll('button')].find((node) => node.textContent.includes('退出验证'));
    if (button) button.click();
    return true;
  })()`);
  await sleep(300);
  await page.eval(`(() => {
    const input = document.querySelector('#phone');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '13900002222');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
    return true;
  })()`);
  const emsCode = await waitForCode(server, "13900002222");
  const ems = await page.eval(`((code) => {
    const input = document.querySelector('#code');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
    return new Promise((resolve) => setTimeout(() => {
      const links = [...document.querySelectorAll('a[target="_blank"]')].map((node) => node.href);
      resolve(JSON.stringify({ text: document.body.innerText, links, width: window.innerWidth }));
    }, 1200));
  })(${JSON.stringify(emsCode)})`);
  const emsParsed = JSON.parse(ems);
  if (emsParsed.width > 420) throw new Error(`expected a 390px viewport, got ${emsParsed.width}`);
  if (!emsParsed.text.includes("DEMO-EMS-000004")) throw new Error("EMS sample missing at 390px");
  if (!emsParsed.links.includes("https://www.ems.com.cn/")) throw new Error("EMS link missing");
  if (emsParsed.text.includes("DEMO-YD-000001")) throw new Error("390px session saw the other phone");
  log("PASS 390px login shows the EMS shipment and link");
}

async function main() {
  log("feature map");
  for (const feature of FEATURES) log(`- ${feature}`);
  const server = startServer();
  const chrome = startChrome();
  let failed = false;
  try {
    await waitFor(origin + "/");
    log(`PASS server ${origin}`);
    await importSample();
    log("PASS import fictional sample");
    const page = await connectChrome();
    try {
      await drive(page, server);
    } finally {
      page.browser.close();
    }
    log("PASS verify-site");
  } catch (error) {
    failed = true;
    log(`FAIL ${error instanceof Error ? error.message : error}`);
    log(server.output().slice(-2000));
  } finally {
    if (server.pid) {
      try { process.kill(-server.pid, "SIGKILL"); } catch { server.kill("SIGKILL"); }
    }
    chrome.kill("SIGKILL");
    process.exit(failed ? 1 : 0);
  }
}

main();

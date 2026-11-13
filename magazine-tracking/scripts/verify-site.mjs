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
  "GET / 读者查询页：手机号输入、查询单号、结果卡片",
  "POST /api/lookup 按完整手机号返回杂志、日期、邮寄方式、快递单号",
  "不完整号码留在页面上并提示，不把单号写进快递公司链接",
  "韵达、中通、中国邮政 EMS 只打开固定官网地址",
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
      const response = await fetch(url);
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
    env: {
      ...process.env,
      ADMIN_USERNAME: "verify-admin",
      ADMIN_PASSWORD: "verify-password-please",
      ADMIN_SESSION_SECRET: "verify-session-secret-at-least-32",
      DATABASE_PATH: path.join(dbDir, "shipments.sqlite"),
      TRUST_PROXY: "0",
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
  return {
    browser,
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

async function drive(page) {
  await page.goto(origin + "/");
  const title = await page.eval("document.body.innerText");
  if (!String(title).includes("杂志邮寄单号查询")) {
    throw new Error("lookup page did not render");
  }
  log("PASS load page");

  const invalid = await page.eval(`(() => {
    const input = document.querySelector('#phone');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '1380000111');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
    return new Promise((resolve) => setTimeout(() => resolve(document.body.innerText), 700));
  })()`);
  if (!String(invalid).includes("请输入完整的11位手机号")) {
    throw new Error("partial number was not rejected");
  }
  if (String(invalid).includes("DEMO-YD-000001")) {
    throw new Error("partial number returned a tracking result");
  }
  log("PASS reject partial phone");

  const result = await page.eval(`(() => {
    const input = document.querySelector('#phone');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '138 0000 1111');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.requestSubmit();
    return new Promise((resolve) => setTimeout(() => {
      const links = [...document.querySelectorAll('a[target="_blank"]')].map((node) => node.href);
      resolve(JSON.stringify({ text: document.body.innerText, links }));
    }, 1200));
  })()`);
  const parsed = JSON.parse(result);
  for (const tracking of ["DEMO-YD-000001", "DEMO-ZT-000002"]) {
    if (!parsed.text.includes(tracking)) throw new Error(`missing tracking number ${tracking}`);
  }
  if (parsed.text.includes("虚构姓名") || parsed.text.includes("13800001111")) {
    throw new Error("lookup leaked a name or the phone number");
  }
  const allowed = ["https://web.yundaex.com/Home", "https://www.zto.com/check"];
  if (parsed.links.length < 2) throw new Error("carrier links missing");
  for (const href of parsed.links) {
    if (!allowed.includes(href)) throw new Error(`unexpected carrier link ${href}`);
    if (href.includes("DEMO-")) throw new Error("tracking number was appended to a carrier link");
  }
  log("PASS enter phone and see tracking numbers");
  log(`PASS carrier links ${parsed.links.join(" ")}`);
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
      await drive(page);
    } finally {
      page.browser.close();
    }
    log("PASS verify-site");
  } catch (error) {
    failed = true;
    log(`FAIL ${error instanceof Error ? error.message : error}`);
    log(server.output().slice(-2000));
  } finally {
    server.kill("SIGKILL");
    chrome.kill("SIGKILL");
    process.exit(failed ? 1 : 0);
  }
}

main();

import { normalizePhone } from "@/lib/phone";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export async function exchangeWechatPhone(loginCode: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const appId = process.env.WECHAT_APP_ID ?? "";
  const secret = process.env.WECHAT_APP_SECRET ?? "";
  if (!appId || !secret || !loginCode || loginCode.length > 256) return null;

  const accessToken = await wechatAccessToken(appId, secret, fetchImpl);
  if (!accessToken) return null;
  const response = await fetchImpl(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: loginCode }),
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    errcode?: number;
    phone_info?: { purePhoneNumber?: string; phoneNumber?: string };
  } | null;
  if (!response.ok || !payload || payload.errcode) return null;
  const raw = payload.phone_info?.purePhoneNumber || payload.phone_info?.phoneNumber || "";
  const normalized = normalizePhone(raw);
  return normalized.ok ? normalized.phone : null;
}

async function wechatAccessToken(appId: string, secret: string, fetchImpl: typeof fetch): Promise<string | null> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  const response = await fetchImpl(url);
  const payload = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !payload?.access_token) return null;
  tokenCache = {
    token: payload.access_token,
    expiresAt: now + Math.max(60, Number(payload.expires_in || 7200)) * 1000,
  };
  return tokenCache.token;
}

export function resetWechatTokenCache() {
  tokenCache = null;
}

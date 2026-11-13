import { createHmac, randomUUID } from "node:crypto";

/**
 * Aliyun SMS is one SendSms call: sign name + a template whose variable is
 * `code`. That matches a 6-digit login code without an SDK. Tencent Cloud SMS
 * is the same shape; Aliyun is the provider implemented here.
 */

export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER || "console";
  if (provider === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("console sms provider is disabled in production");
    }
    console.info(`sms dev phone=${phone} code=${code}`);
    return;
  }
  if (provider === "aliyun") {
    await sendAliyun(phone, code);
    return;
  }
  throw new Error("unknown sms provider");
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}

async function sendAliyun(phone: string, code: string): Promise<void> {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET ?? "";
  const signName = process.env.ALIYUN_SMS_SIGN_NAME ?? "";
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE ?? "";
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error("aliyun sms is not configured");
  }

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phone,
    RegionId: "cn-hangzhou",
    SignName: signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  const stringToSign = `POST&${percentEncode("/")}&${percentEncode(canonical)}`;
  const signature = createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
  const body = `${canonical}&Signature=${percentEncode(signature)}`;
  const response = await fetch("https://dysmsapi.aliyuncs.com/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as { Code?: string; Message?: string } | null;
  if (!response.ok || payload?.Code !== "OK") {
    throw new Error(payload?.Code || "aliyun sms failed");
  }
}

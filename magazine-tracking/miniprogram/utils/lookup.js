const { resolveApiBase } = require("./api-base");
const { phoneMessage } = require("./phone");

const PUBLIC_FIELDS = ["magazineName", "date", "shippingMethod", "trackingNumber"];

function hidePhone(message, phone) {
  if (typeof message !== "string" || !message) return "";
  if (phone && message.indexOf(phone) !== -1) return "请输入完整的11位手机号。";
  return message.slice(0, 200);
}

function sanitizeShipment(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const shipment = {};
  for (let i = 0; i < PUBLIC_FIELDS.length; i += 1) {
    const key = PUBLIC_FIELDS[i];
    const value = row[key];
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!text || text.length > 80) return null;
    shipment[key] = text;
  }
  return shipment;
}

function buildLookupRequest(origin, token) {
  return {
    url: origin + "/api/lookup",
    method: "POST",
    header: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
    },
    data: {},
    timeout: 15000,
  };
}

function interpretLookup(statusCode, body, phone) {
  if (statusCode === 429) {
    const message =
      body && typeof body.error === "string" ? hidePhone(body.error, phone) : "查询过于频繁，请稍后再试。";
    return {
      status: "limited",
      message: message || "查询过于频繁，请稍后再试。",
      shipments: [],
      truncated: false,
    };
  }
  if (statusCode === 400) {
    const message = body && typeof body.error === "string" ? hidePhone(body.error, phone) : phoneMessage("invalid");
    return {
      status: "invalid",
      message: message || phoneMessage("invalid"),
      shipments: [],
      truncated: false,
    };
  }
  if (statusCode !== 200 || !body || typeof body !== "object" || !Array.isArray(body.shipments)) {
    const message =
      body && typeof body.error === "string" ? hidePhone(body.error, phone) : "查询暂时不可用，请稍后再试。";
    return {
      status: "error",
      message: message || "查询暂时不可用，请稍后再试。",
      shipments: [],
      truncated: false,
    };
  }

  const shipments = [];
  for (let i = 0; i < body.shipments.length; i += 1) {
    const clean = sanitizeShipment(body.shipments[i]);
    if (clean) shipments.push(clean);
  }
  return {
    status: shipments.length === 0 ? "empty" : "results",
    message: shipments.length === 0 ? "这个手机号下面还没有导入的杂志单号。若刊物刚寄出，可能尚未录入。" : "",
    shipments,
    truncated: body.truncated === true && shipments.length > 0,
  };
}

function performLookup(options) {
  const config = options.config;
  const request = options.request;
  const token = typeof options.token === "string" ? options.token : "";
  if (!token) {
    return Promise.resolve({
      status: "auth",
      message: "请先验证手机号。查询不会使用你填在请求里的号码。",
      shipments: [],
      truncated: false,
      demoWarning: "",
    });
  }

  const base = resolveApiBase(config || {});
  if (!base.ok) {
    return Promise.resolve({
      status: "config",
      message: base.message,
      shipments: [],
      truncated: false,
      demoWarning: "",
    });
  }
  if (typeof request !== "function") {
    return Promise.resolve({
      status: "error",
      message: "查询没有完成。请检查网络、合法域名和 HTTPS 证书。",
      shipments: [],
      truncated: false,
      demoWarning: "",
    });
  }

  const payload = buildLookupRequest(base.origin, token);
  return Promise.resolve()
    .then(() => request(payload))
    .then((response) => {
      const statusCode = response && typeof response.statusCode === "number" ? response.statusCode : 0;
      const encoded = JSON.stringify(payload);
      if (encoded.indexOf("phone") !== -1) {
        return {
          status: "error",
          message: "查询没有发出。",
          shipments: [],
          truncated: false,
          demoWarning: "",
        };
      }
      const interpreted = interpretLookup(statusCode, response ? response.data : null, "");
      interpreted.demoWarning = base.warning || "";
      return interpreted;
    })
    .catch(() => ({
      status: "error",
      message: "查询没有完成。请检查网络、合法域名和 HTTPS 证书。",
      shipments: [],
      truncated: false,
      demoWarning: base.warning || "",
    }));
}

module.exports = {
  PUBLIC_FIELDS,
  sanitizeShipment,
  buildLookupRequest,
  interpretLookup,
  performLookup,
};

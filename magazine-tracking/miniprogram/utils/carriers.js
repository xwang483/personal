/**
 * Carrier mini programs checked on 2026-11-13. None publish a text path that
 * accepts a tracking number, so every jump uses an empty path and empty
 * extraData. The tracking number is copied to the clipboard first.
 *
 * 韵达快递 wxdeb5309aa3e93fd1
 *   韵达开放平台《微信小程序嵌入》明文写出该 AppID：
 *   https://yundaex.apifox.cn/doc-345776
 *   查件和运单详情路径在该页是图片，没有可引用的文本 path 或参数。
 *
 * 中通快递 wx7ddec43d9d27276a
 *   腾讯应用宝页面名称为「中通快递」，开发者为中通快递股份有限公司：
 *   https://sj.qq.com/appdetail/wx7ddec43d9d27276a
 *   与微信雷达公开片段 wx7ddec****d27276a 一致：
 *   https://appid.gqmg.com/mp/wA4Khesetr5u
 *   没有查到官方公布的带单号 path。
 *
 * 中国邮政 / EMS wx63e410bc2c6a792e
 *   腾讯应用宝页面名称为「EMS中国邮政速递物流」，开发者为中国邮政速递物流股份有限公司，
 *   简介为「EMS快递服务，寄件下单、查单、订单管理」：
 *   https://sj.qq.com/appdetail/wx63e410bc2c6a792e
 *   与微信雷达公开片段 wx63e41****c6a792e 一致：
 *   https://appid.gqmg.com/mp/uGT49ez_dztD
 *   没有查到官方公布的带单号 path。
 *
 * 本小程序自己的 AppID 不在这里。project.config.json 里的 touristappid 只是开发者工具占位。
 */

const YUNDA_APP_ID = "wxdeb5309aa3e93fd1";
const ZTO_APP_ID = "wx7ddec43d9d27276a";
const EMS_APP_ID = "wx63e410bc2c6a792e";

const CARRIERS = [
  {
    carrierId: "yunda",
    carrierName: "韵达快递",
    button: "韵达查询",
    appId: YUNDA_APP_ID,
    source: "https://yundaex.apifox.cn/doc-345776",
    aliases: ["韵达", "韵达快递", "韵达速递", "yunda", "yundaex"],
  },
  {
    carrierId: "zto",
    carrierName: "中通快递",
    button: "中通查询",
    appId: ZTO_APP_ID,
    source: "https://sj.qq.com/appdetail/wx7ddec43d9d27276a",
    aliases: ["中通", "中通快递", "中通速递", "zto"],
  },
  {
    carrierId: "ems",
    carrierName: "中国邮政EMS",
    button: "邮政EMS查询",
    appId: EMS_APP_ID,
    source: "https://sj.qq.com/appdetail/wx63e410bc2c6a792e",
    aliases: [
      "ems",
      "中国邮政",
      "中国邮政ems",
      "邮政ems",
      "邮政快递",
      "邮政快递包裹",
      "邮政包裹",
      "中国邮政速递",
      "邮政速递",
    ],
  },
];

const BY_ID = {};
const BY_ALIAS = {};

function normalizeMethod(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s\u00A0\u3000]+/g, "");
}

for (let i = 0; i < CARRIERS.length; i += 1) {
  const carrier = CARRIERS[i];
  BY_ID[carrier.carrierId] = carrier;
  for (let j = 0; j < carrier.aliases.length; j += 1) {
    BY_ALIAS[normalizeMethod(carrier.aliases[j])] = carrier;
  }
}

function enabledPlan(carrier) {
  return {
    enabled: true,
    carrierId: carrier.carrierId,
    carrierName: carrier.carrierName,
    button: carrier.button,
    appId: carrier.appId,
    path: "",
    extraData: {},
    homepageOnly: true,
    passesTracking: false,
    passesPhone: false,
    deviceVerified: false,
    source: carrier.source,
    notice: "对方没有公开可带单号的页面。打开前会先复制单号，请在首页粘贴查询。",
  };
}

function disabledPlan(notice) {
  return {
    enabled: false,
    carrierId: null,
    carrierName: "",
    homepageOnly: false,
    passesTracking: false,
    passesPhone: false,
    deviceVerified: false,
    notice,
  };
}

function matchCarrier(method) {
  const carrier = BY_ALIAS[normalizeMethod(method)];
  return carrier ? carrier.carrierId : null;
}

function buildCarrierJump(method) {
  const carrier = BY_ALIAS[normalizeMethod(method)];
  if (!carrier) {
    return disabledPlan("暂不能跳转到这家快递的官方小程序。请复制单号后自行查询。");
  }
  return enabledPlan(carrier);
}

function buildCarrierById(carrierId) {
  const carrier = BY_ID[carrierId];
  if (!carrier) return disabledPlan("没有可跳转的快递公司。");
  return enabledPlan(carrier);
}

function listCarriers() {
  return CARRIERS.map((carrier) => ({
    id: carrier.carrierId,
    name: carrier.carrierName,
    button: carrier.button,
    source: carrier.source,
  }));
}

function isKnownJump(plan) {
  if (!plan || plan.enabled !== true || plan.path !== "" || plan.homepageOnly !== true) return false;
  const carrier = BY_ID[plan.carrierId];
  return !!carrier && plan.appId === carrier.appId;
}

function requestCarrierJump(options) {
  const plan = options.plan;
  const userTap = options.userTap === true;
  const navigateToMiniProgram = options.navigateToMiniProgram;
  const setClipboardData = options.setClipboardData;
  const trackingNumber = typeof options.trackingNumber === "string" ? options.trackingNumber : "";

  if (!userTap) {
    return Promise.resolve({
      status: "rejected",
      called: false,
      copied: false,
      deviceVerified: false,
      message: "需要你点击按钮后才会尝试跳转。",
    });
  }
  if (!plan || plan.enabled !== true) {
    return Promise.resolve({
      status: "unconfigured",
      called: false,
      copied: false,
      deviceVerified: false,
      message: plan && plan.notice ? plan.notice : "没有可跳转的快递公司。",
    });
  }
  if (!isKnownJump(plan) || typeof navigateToMiniProgram !== "function") {
    return Promise.resolve({
      status: "rejected",
      called: false,
      copied: false,
      deviceVerified: false,
      message: "跳转配置未通过核对，已取消调用。",
    });
  }

  const payload = {
    appId: plan.appId,
    path: "",
    extraData: {},
    envVersion: "release",
  };

  function open(copied) {
    return new Promise((resolve) => {
      navigateToMiniProgram({
        appId: payload.appId,
        path: payload.path,
        extraData: payload.extraData,
        envVersion: payload.envVersion,
        success() {
          resolve({
            status: "opened",
            called: true,
            copied,
            calledWith: payload,
            deviceVerified: false,
            message: copied
              ? "单号已复制。已请求打开" + plan.carrierName + "小程序首页，请在打开后粘贴查询。开发者工具不能真正完成跳转。"
              : trackingNumber
                ? "没能复制单号。已请求打开" + plan.carrierName + "小程序首页，请手动输入。开发者工具不能代替真机。"
                : "当前没有可复制的单号。已请求打开" + plan.carrierName + "小程序首页。开发者工具不能真正完成跳转。",
          });
        },
        fail(err) {
          const errMsg = err && err.errMsg ? String(err.errMsg) : "";
          const cancelled = /cancel/i.test(errMsg);
          resolve({
            status: cancelled ? "cancelled" : "failed",
            called: true,
            copied,
            calledWith: payload,
            deviceVerified: false,
            errMsg,
            message: cancelled
              ? "已取消跳转。"
              : "没有打开" + plan.carrierName + "小程序。开发者工具不能代替真机跳转，请在手机微信里再试。",
          });
        },
      });
    });
  }

  if (!trackingNumber) return open(false);
  if (typeof setClipboardData !== "function") return open(false);

  return new Promise((resolve) => {
    let copied = false;
    setClipboardData({
      data: trackingNumber,
      success() {
        copied = true;
      },
      fail() {
        copied = false;
      },
      complete() {
        open(copied).then(resolve);
      },
    });
  });
}

module.exports = {
  YUNDA_APP_ID,
  ZTO_APP_ID,
  EMS_APP_ID,
  CARRIERS,
  matchCarrier,
  buildCarrierJump,
  buildCarrierById,
  listCarriers,
  requestCarrierJump,
};

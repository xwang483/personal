/**
 * 韵达 AppID 来自韵达开放平台《微信小程序嵌入》：
 * https://yundaex.apifox.cn/doc-345776
 * 该页把查件、寄件、运单详情路径做成图片，没有可引用的文本 path 或参数。
 * 材料按 2021 年文档使用。这里只打开首页（path 为空），不传单号或手机号。
 * 真机是否仍能打开，尚未验证。
 *
 * 中通联系页 https://www.zto.com/introduce/about/contact 只有小程序二维码，
 * 没有公布可核对的 AppID 和页面路径。不要填入来源不明的 AppID。
 *
 * 韵达旧文档还要求把跳转目标写进小程序全局配置。当前微信配置不再需要这项，不要照抄进 app.json。
 */

const YUNDA_APP_ID = "wxdeb5309aa3e93fd1";
const YUNDA_SOURCE = "https://yundaex.apifox.cn/doc-345776";
const HOME_NOTICE = "仅打开首页，需自行粘贴查询。";

const YUNDA_ALIASES = ["韵达", "韵达快递", "韵达速递", "yunda", "yundaex"];
const ZTO_ALIASES = ["中通", "中通快递", "中通速递", "zto"];

function normalizeMethod(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s\u00A0\u3000]+/g, "");
}

function matchCarrier(method) {
  const key = normalizeMethod(method);
  if (YUNDA_ALIASES.some((alias) => normalizeMethod(alias) === key)) return "yunda";
  if (ZTO_ALIASES.some((alias) => normalizeMethod(alias) === key)) return "zto";
  return null;
}

function buildCarrierJump(method) {
  const carrierId = matchCarrier(method);
  if (carrierId === "yunda") {
    return {
      enabled: true,
      carrierId: "yunda",
      carrierName: "韵达快递",
      appId: YUNDA_APP_ID,
      path: "",
      extraData: {},
      homepageOnly: true,
      passesTracking: false,
      passesPhone: false,
      deviceVerified: false,
      source: YUNDA_SOURCE,
      notice: HOME_NOTICE,
      detail:
        "标识来自韵达开放平台文档，按 2021 年材料使用。文档没有可引用的查件路径和参数，所以只打开首页。真机跳转尚未验证。开发者工具不能代替真机。",
    };
  }
  if (carrierId === "zto") {
    return {
      enabled: false,
      carrierId: "zto",
      carrierName: "中通快递",
      homepageOnly: false,
      passesTracking: false,
      passesPhone: false,
      deviceVerified: false,
      notice:
        "中通官网联系页只提供小程序二维码，没有公布可核对的 AppID 和页面路径。请复制单号后，在微信里搜索中通快递官方小程序并自行粘贴。这里不会发起跳转。",
    };
  }
  return {
    enabled: false,
    carrierId: null,
    carrierName: "",
    homepageOnly: false,
    passesTracking: false,
    passesPhone: false,
    deviceVerified: false,
    notice: "暂不能跳转到这家快递的官方小程序。请复制单号后自行查询。",
  };
}

function requestCarrierJump(options) {
  const plan = options.plan;
  const userTap = options.userTap === true;
  const navigateToMiniProgram = options.navigateToMiniProgram;
  if (!userTap) {
    return Promise.resolve({
      status: "rejected",
      called: false,
      deviceVerified: false,
      message: "需要你点击按钮后才会尝试跳转。",
    });
  }
  if (!plan || plan.enabled !== true) {
    return Promise.resolve({
      status: "unconfigured",
      called: false,
      deviceVerified: false,
      message: plan && plan.notice ? plan.notice : "没有可跳转的快递公司。",
    });
  }
  if (
    plan.carrierId !== "yunda" ||
    plan.appId !== YUNDA_APP_ID ||
    plan.path !== "" ||
    plan.homepageOnly !== true ||
    typeof navigateToMiniProgram !== "function"
  ) {
    return Promise.resolve({
      status: "rejected",
      called: false,
      deviceVerified: false,
      message: "跳转配置未通过核对，已取消调用。",
    });
  }

  const payload = {
    appId: YUNDA_APP_ID,
    path: "",
    extraData: {},
    envVersion: "release",
  };

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
          calledWith: payload,
          deviceVerified: false,
          message:
            "已请求打开韵达快递小程序首页。仅打开首页，需自行粘贴查询。开发者工具不能真正完成跳转；在真机上看到微信确认框并进入韵达首页之前，不能当作已经验证。",
        });
      },
      fail(err) {
        const errMsg = err && err.errMsg ? String(err.errMsg) : "";
        const cancelled = /cancel/i.test(errMsg);
        resolve({
          status: cancelled ? "cancelled" : "failed",
          called: true,
          calledWith: payload,
          deviceVerified: false,
          errMsg,
          message: cancelled
            ? "已取消跳转。复制成功不会自动打开快递公司小程序。"
            : "没有打开韵达小程序。开发者工具不能代替真机跳转。请在手机微信里再试，或自行搜索韵达快递官方小程序后粘贴单号。",
        });
      },
    });
  });
}

module.exports = {
  YUNDA_APP_ID,
  YUNDA_SOURCE,
  HOME_NOTICE,
  matchCarrier,
  buildCarrierJump,
  requestCarrierJump,
};

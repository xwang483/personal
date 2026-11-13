const { runtimeConfig } = require("../../config");
const { resolveApiBase } = require("../../utils/api-base");
const { normalizePhone, phoneMessage } = require("../../utils/phone");
const { copyTrackingNumber, handleCopyResult } = require("../../utils/clipboard");
const { buildCarrierById, listCarriers, requestCarrierJump } = require("../../utils/carriers");
const { performLookup } = require("../../utils/lookup");
const { presentShipment } = require("../../utils/present");

function useClipboard(options) {
  wx.setClipboardData(options);
}

function useJump(options) {
  wx.navigateToMiniProgram(options);
}

Page({
  data: {
    phone: "",
    code: "",
    token: "",
    status: "idle",
    message: "",
    shipments: [],
    truncated: false,
    demoWarning: "",
    showPrivacy: false,
    privacyReady: false,
    carriers: listCarriers(),
    carrierMessage: "",
  },

  onLoad() {
    wx.getPrivacySetting({
      success: (res) => {
        const needsConsent = !!(res && res.needAuthorization);
        this.setData({
          showPrivacy: needsConsent,
          privacyReady: !needsConsent,
        });
      },
      fail: () => {
        this.setData({ showPrivacy: false, privacyReady: true });
      },
    });
  },

  onPhoneInput(event) {
    const value = event && event.detail ? event.detail.value : "";
    const next = { phone: value };
    if (this.data.status === "invalid") {
      next.status = "idle";
      next.message = "";
    }
    this.setData(next);
  },

  onOpenContract() {
    wx.openPrivacyContract({
      fail: () => {
        wx.showToast({ title: "隐私指引还没在后台配置", icon: "none" });
      },
    });
  },

  onAgreePrivacy() {
    this.setData({ showPrivacy: false, privacyReady: true });
  },

  onCodeInput(event) {
    const value = event && event.detail ? event.detail.value : "";
    this.setData({ code: value });
  },

  saveToken(token) {
    wx.setStorageSync("readerToken", token);
    this.setData({ token });
  },

  onGetPhone(event) {
    const detail = event && event.detail ? event.detail : {};
    if (!detail.code) {
      this.setData({ message: "没有拿到微信手机号，请改用短信验证码。" });
      return;
    }
    const base = resolveApiBase(runtimeConfig);
    if (!base.ok) {
      this.setData({ status: "config", message: base.message });
      return;
    }
    wx.request({
      url: base.origin + "/api/auth/wechat",
      method: "POST",
      data: { code: detail.code },
      header: { "content-type": "application/json" },
      success: (res) => {
        const token = res.data && res.data.token;
        if (res.statusCode !== 200 || !token) {
          this.setData({ message: (res.data && res.data.error) || "微信手机号验证没有完成，请改用短信验证码。" });
          return;
        }
        this.saveToken(token);
        this.onLookup();
      },
      fail: () => this.setData({ message: "微信手机号验证没有完成，请改用短信验证码。" }),
    });
  },

  onSendCode() {
    const normalized = normalizePhone(this.data.phone);
    if (!normalized.ok) {
      this.setData({ status: "invalid", message: phoneMessage(normalized.code) });
      return;
    }
    const base = resolveApiBase(runtimeConfig);
    if (!base.ok) {
      this.setData({ status: "config", message: base.message });
      return;
    }
    wx.request({
      url: base.origin + "/api/auth/sms/send",
      method: "POST",
      data: { phone: normalized.phone },
      header: { "content-type": "application/json" },
      success: (res) => {
        if (res.statusCode !== 200) {
          this.setData({ status: "invalid", message: (res.data && res.data.error) || "验证码没有发出。" });
          return;
        }
        this.setData({ status: "code", message: "验证码已发出。请填写 6 位数字。" });
      },
      fail: () => this.setData({ status: "error", message: "验证码没有发出。" }),
    });
  },

  onVerifyCode() {
    const normalized = normalizePhone(this.data.phone);
    const base = resolveApiBase(runtimeConfig);
    if (!normalized.ok || !base.ok) return;
    wx.request({
      url: base.origin + "/api/auth/sms/verify",
      method: "POST",
      data: { phone: normalized.phone, code: this.data.code },
      header: { "content-type": "application/json" },
      success: (res) => {
        const token = res.data && res.data.token;
        if (res.statusCode !== 200 || !token) {
          this.setData({ status: "invalid", message: (res.data && res.data.error) || "验证码不正确或已过期。" });
          return;
        }
        this.saveToken(token);
        this.onLookup();
      },
      fail: () => this.setData({ status: "error", message: "验证没有完成。" }),
    });
  },

  onLookup() {
    if (!this.data.privacyReady) {
      this.setData({ showPrivacy: true });
      return;
    }
    const token = this.data.token || wx.getStorageSync("readerToken") || "";
    this.setData({
      token,
      status: "loading",
      message: "",
      shipments: [],
      truncated: false,
      demoWarning: "",
      carrierMessage: "",
    });
    performLookup({
      config: runtimeConfig,
      token,
      request: (options) =>
        new Promise((resolve, reject) => {
          wx.request({
            url: options.url,
            method: options.method,
            data: options.data,
            header: options.header,
            timeout: options.timeout,
            success: (res) => resolve({ statusCode: res.statusCode, data: res.data }),
            fail: (err) => reject(err),
          });
        }),
    }).then((result) => {
      const shipments = (result.shipments || []).map(presentShipment);
      this.setData({
        status: result.status,
        message: result.message || "",
        shipments,
        truncated: !!result.truncated,
        demoWarning: result.demoWarning || "",
      });
    });
  },

  jump(plan, trackingNumber, apply) {
    requestCarrierJump({
      plan,
      userTap: true,
      trackingNumber,
      setClipboardData: useClipboard,
      navigateToMiniProgram: useJump,
    }).then((result) => {
      apply(result);
    });
  },

  onCopy(event) {
    const index = Number(event.currentTarget.dataset.index);
    const shipment = this.data.shipments[index];
    if (!shipment) return;
    copyTrackingNumber({
      trackingNumber: shipment.trackingNumber,
      setClipboardData: useClipboard,
    }).then((result) => {
      const view = handleCopyResult(result);
      this.setData({
        [`shipments[${index}].copyState`]: view.copyState,
        [`shipments[${index}].copyMessage`]: view.message,
      });
    });
  },

  onJump(event) {
    const index = Number(event.currentTarget.dataset.index);
    const shipment = this.data.shipments[index];
    if (!shipment) return;
    this.jump(shipment.jump, shipment.trackingNumber, (result) => {
      this.setData({
        [`shipments[${index}].jumpState`]: result.status,
        [`shipments[${index}].jumpMessage`]: result.message,
      });
    });
  },

  onOpenCarrier(event) {
    const carrierId = event.currentTarget.dataset.id;
    const plan = buildCarrierById(carrierId);
    const match = (this.data.shipments || []).find((item) => item.jump && item.jump.carrierId === carrierId);
    this.jump(plan, match ? match.trackingNumber : "", (result) => {
      this.setData({ carrierMessage: result.message });
    });
  },
});

const { runtimeConfig } = require("../../config");
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

  onLookup() {
    if (!this.data.privacyReady) {
      this.setData({ showPrivacy: true });
      return;
    }
    this.setData({
      status: "loading",
      message: "",
      shipments: [],
      truncated: false,
      demoWarning: "",
      carrierMessage: "",
    });
    performLookup({
      config: runtimeConfig,
      phone: this.data.phone,
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

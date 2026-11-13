function copyTrackingNumber(options) {
  const trackingNumber = options.trackingNumber;
  const setClipboardData = options.setClipboardData;
  if (typeof trackingNumber !== "string" || !trackingNumber || trackingNumber.length > 64) {
    return Promise.resolve({ ok: false, reason: "empty" });
  }
  if (typeof setClipboardData !== "function") {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }

  return new Promise((resolve) => {
    let settled = false;
    function finish(result) {
      if (settled) return;
      settled = true;
      resolve(result);
    }
    setClipboardData({
      data: trackingNumber,
      success() {
        finish({ ok: true, data: trackingNumber });
      },
      fail(err) {
        finish({
          ok: false,
          reason: "fail",
          errMsg: err && err.errMsg ? String(err.errMsg) : "",
        });
      },
      complete() {
        finish({ ok: false, reason: "fail" });
      },
    });
  });
}

function handleCopyResult(result) {
  if (result && result.ok) {
    return {
      copyState: "copied",
      message: "单号已复制。这只是复制成功，不会自动打开快递公司小程序。",
      navigate: null,
    };
  }
  return {
    copyState: "failed",
    message: "没能写入剪贴板。请长按单号手动复制。没有发起跳转。",
    navigate: null,
  };
}

module.exports = {
  copyTrackingNumber,
  handleCopyResult,
};

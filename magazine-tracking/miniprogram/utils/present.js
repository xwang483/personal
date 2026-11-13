const { buildCarrierJump } = require("./carriers");

function formatChineseDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return match[1] + "年" + Number(match[2]) + "月" + Number(match[3]) + "日";
}

function presentShipment(shipment) {
  const jump = buildCarrierJump(shipment.shippingMethod);
  return {
    key: shipment.date + "|" + shipment.trackingNumber + "|" + shipment.magazineName,
    magazineName: shipment.magazineName,
    date: shipment.date,
    dateText: formatChineseDate(shipment.date),
    shippingMethod: shipment.shippingMethod,
    trackingNumber: shipment.trackingNumber,
    sample: shipment.magazineName.indexOf("示例") !== -1,
    showJump: jump.enabled === true,
    jump,
    copyState: "",
    copyMessage: "",
    jumpState: "",
    jumpMessage: "",
  };
}

module.exports = {
  formatChineseDate,
  presentShipment,
};

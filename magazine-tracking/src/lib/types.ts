export type PublicShipment = {
  magazineName: string;
  date: string;
  shippingMethod: string;
  trackingNumber: string;
};

export type ValidRow = {
  row: number;
  phone: string;
  magazineName: string;
  shipDate: string;
  shippingMethod: string;
  trackingNumber: string;
  orderNumber: string;
};

export type RowError = {
  row: number;
  field: string;
  message: string;
};

export type RawCell = {
  value: unknown;
  text?: string;
};

export type SheetRow = {
  rowNumber: number;
  cells: RawCell[];
};

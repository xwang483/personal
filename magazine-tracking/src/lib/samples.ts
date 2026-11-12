import ExcelJS from "exceljs";

export const SAMPLE_NOTICE = "本文件全部是虚构示例，不对应真实读者、地址、订单或快递单。";

type SampleRow = {
  name: string;
  address: string;
  method: string;
  tracking: string;
  date: string;
  phone: string;
  magazine: string;
  order: string;
};

const HEADERS = ["姓名", "收货地址", "邮寄方式", "单号", "日期", "电话", "", "杂志名称", "订单号"];

const SAMPLE_ROWS: SampleRow[] = [
  {
    name: "虚构姓名（不会被保存）",
    address: "虚构地址（不会被保存）",
    method: "韵达快递",
    tracking: "DEMO-YD-000001",
    date: "2026-03-02",
    phone: "138 0000 1111",
    magazine: "《刊林》2026年春季号（示例）",
    order: "DEMO-ORDER-0001",
  },
  {
    name: "虚构姓名（不会被保存）",
    address: "虚构地址（不会被保存）",
    method: "中通快递",
    tracking: "DEMO-ZT-000002",
    date: "2026-01-18",
    phone: "+86 13800001111",
    magazine: "《刊林》2025年冬季号（示例）",
    order: "DEMO-ORDER-0002",
  },
  {
    name: "虚构姓名（不会被保存）",
    address: "虚构地址（不会被保存）",
    method: "京东物流",
    tracking: "DEMO-JD-000003",
    date: "2026-02-09",
    phone: "13900002222",
    magazine: "《南窗》总第12期（示例）",
    order: "DEMO-ORDER-0003",
  },
];

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsv(rows: string[][]): Buffer {
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`${body}\r\n`, "utf8")]);
}

export function buildTemplateCsv(): Buffer {
  return toCsv([HEADERS]);
}

export function buildSampleCsv(): Buffer {
  return toCsv([
    HEADERS,
    ...SAMPLE_ROWS.map((row) => [
      row.name,
      row.address,
      row.method,
      row.tracking,
      row.date,
      row.phone,
      "",
      row.magazine,
      row.order,
    ]),
  ]);
}

function styleIdColumns(sheet: ExcelJS.Worksheet) {
  for (const column of [4, 6, 9]) {
    sheet.getColumn(column).numFmt = "@";
  }
}

function addNotes(workbook: ExcelJS.Workbook, lines: string[]) {
  const note = workbook.addWorksheet("填写说明");
  lines.forEach((line, index) => {
    note.getCell(index + 1, 1).value = line;
  });
  note.getColumn(1).width = 88;
}

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function buildTemplateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("邮寄数据");
  sheet.addRow(HEADERS);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  styleIdColumns(sheet);
  sheet.getRow(1).font = { bold: true };
  addNotes(workbook, [
    "第一行必须是表头，请不要改列名。",
    "姓名、收货地址、邮寄方式、单号、日期、电话、杂志名称、订单号都会被识别。",
    "表头之间的空白列会忽略，可以保留。",
    "电话、单号、订单号请设为文本。数字格式可能造成长单号精度丢失，这种行会被拒绝。",
    "姓名和收货地址不会写入数据库，也不会出现在读者查询结果里。",
    "日期示例：2026-03-02。",
    "电话需要是完整的11位手机号，可以写成 +86 138 0000 1111。",
    "重复导入同一条记录不会产生重复数据。",
    SAMPLE_NOTICE,
  ]);
  return workbookBuffer(workbook);
}

export async function buildSampleXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("邮寄数据");
  sheet.addRow(HEADERS);
  for (const row of SAMPLE_ROWS) {
    const added = sheet.addRow([
      row.name,
      row.address,
      row.method,
      row.tracking,
      row.date,
      row.phone,
      "",
      row.magazine,
      row.order,
    ]);
    added.getCell(4).numFmt = "@";
    added.getCell(6).numFmt = "@";
    added.getCell(9).numFmt = "@";
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  styleIdColumns(sheet);
  sheet.getRow(1).font = { bold: true };
  addNotes(workbook, [
    SAMPLE_NOTICE,
    "这些行只用于演示导入和查询。杂志名称里的「示例」会显示在查询结果中。",
    "姓名和收货地址不会被保存。",
    "13800001111 对应两本示例杂志，13900002222 对应一本。",
    "数据请放在第一个工作表。",
  ]);
  return workbookBuffer(workbook);
}

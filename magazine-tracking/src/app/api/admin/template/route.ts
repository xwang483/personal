import { requireAdmin, attachment, json } from "@/lib/http";
import { buildSampleCsv, buildSampleXlsx, buildTemplateCsv, buildTemplateXlsx } from "@/lib/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req, false);
  if (denied) return denied;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const format = url.searchParams.get("format");
  if ((kind !== "template" && kind !== "sample") || (format !== "csv" && format !== "xlsx")) {
    return json({ error: "无法下载这个文件。" }, 400);
  }

  try {
    if (kind === "template" && format === "csv") {
      return attachment("杂志邮寄导入模板.csv", buildTemplateCsv(), "text/csv; charset=utf-8");
    }
    if (kind === "sample" && format === "csv") {
      return attachment("杂志邮寄虚构示例.csv", buildSampleCsv(), "text/csv; charset=utf-8");
    }
    if (kind === "template" && format === "xlsx") {
      return attachment(
        "杂志邮寄导入模板.xlsx",
        await buildTemplateXlsx(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    }
    return attachment(
      "杂志邮寄虚构示例.xlsx",
      await buildSampleXlsx(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  } catch (error) {
    console.error("template failed", error instanceof Error ? error.name : "error");
    return json({ error: "文件暂时无法生成。" }, 500);
  }
}

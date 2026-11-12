import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "导入邮寄表 · 刊邮",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "部落冲突升级助手",
  description: "上传 CoC JSON，自动追踪升级进度，升级完成时本地通知提醒",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CoC 升级助手",
  },
  twitter: {
    card: "summary",
    title: "部落冲突升级助手",
    description: "上传 CoC JSON，自动追踪升级进度，升级完成时本地通知提醒",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6366f1" />
        {/* Favicon fallback */}
        <link rel="icon" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-screen gradient-bg antialiased">
        {children}
      </body>
    </html>
  );
}

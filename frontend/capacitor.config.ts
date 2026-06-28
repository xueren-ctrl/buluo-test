import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.xueren.buluo",
  appName: "部落冲突升级助手",
  webDir: "out",
  android: {
    // WebView 调试模式（生产可关闭，开发期便于排查 IndexedDB/localStorage 问题）
    webContentsDebuggingEnabled: true,
    // 允许混合内容（Capacitor 默认 https，但本地资源也走 https）
    allowMixedContent: false,
  },
  server: {
    // 使用 https scheme，确保 IndexedDB / localStorage 与 web 标准一致
    androidScheme: "https",
  },
};

export default config;

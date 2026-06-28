/** @type {import('next').NextConfig} */

// 读取 package.json 版本号，注入到客户端 bundle
// 让 update-checker.ts 能拿到 CURRENT_VERSION
const pkg = require("./package.json");
const path = require("path");

const nextConfig = {
  // 纯静态导出，便于 Capacitor 打包成 APK
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 注入版本号到 NEXT_PUBLIC_APP_VERSION
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version || "1.0.0",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // monorepo：让 ../shared/*.ts 里的裸导入（@capacitor/core 等）
  // 也能从 frontend/node_modules 解析
  webpack: (config) => {
    config.resolve.modules = config.resolve.modules || [];
    const feModules = path.resolve(__dirname, "node_modules");
    if (!config.resolve.modules.includes(feModules)) {
      config.resolve.modules.push(feModules);
    }
    return config;
  },
};

module.exports = nextConfig;

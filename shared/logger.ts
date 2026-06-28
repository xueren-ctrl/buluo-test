/**
 * 统一日志工具 — 解析流程排查用
 * ============================================
 * 用法：
 *  - 开发模式（npm run dev）自动输出全部日志
 *  - 生产模式默认仅输出 warn / error
 *  - 浏览器控制台执行 localStorage.setItem("coc-debug","true") 可全量开启
 *  - URL 加 ?debug=1 也可临时开启
 *  - 控制台过滤 "[CoC]" 可快速定位本模块日志
 */

const PREFIX = "[CoC]";

// Next.js 在编译时将 process.env.NODE_ENV 替换为字符串字面量
// 不使用可选链，否则 webpack 会尝试 polyfill process 模块
const IS_DEV = process.env.NODE_ENV === "development";

function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.search.includes("debug")) return true;
    if (localStorage.getItem("coc-debug") === "true") return true;
  } catch {
    // localStorage 不可用（隐私模式等）
  }
  return IS_DEV;
}

/** 常规流程日志（仅 debug 模式输出） */
export function log(msg: string, ...args: unknown[]): void {
  if (isDebugMode()) {
    console.log(`${PREFIX} ${msg}`, ...args);
  }
}

/** 警告日志（始终输出）— 数据异常但不致命 */
export function warn(msg: string, ...args: unknown[]): void {
  console.warn(`${PREFIX} ⚠ ${msg}`, ...args);
}

/** 错误日志（始终输出）— 解析失败等致命问题 */
export function error(msg: string, ...args: unknown[]): void {
  console.error(`${PREFIX} ✗ ${msg}`, ...args);
}

/** 分组日志（仅 debug 模式）— 将多行日志折叠为一组 */
export function group(title: string, fn: () => void): void {
  if (isDebugMode()) {
    console.group(`${PREFIX} ${title}`);
    fn();
    console.groupEnd();
  }
}

/** 格式化秒数为可读时长 */
export function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d${Math.floor((sec % 86400) / 3600)}h`;
}

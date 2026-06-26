/**
 * usePwaInstall — 检测安装状态 + 安装提示
 * 类似 Clash Ninja 的 "添加到主屏幕" 流程
 */
import { useState, useEffect, useCallback } from "react";

interface PwaInstallPrompt {
  event: BeforeInstallPromptEvent | null;
  canInstall: boolean;
  installed: boolean;
  showPrompt: () => Promise<void>;
  status: "ready" | "installed" | "deferred" | "unsupported" | "not-available";
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstall(): PwaInstallPrompt {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [hasCheckedSupport, setHasCheckedSupport] = useState(false);

  useEffect(() => {
    const supportsPwa = "serviceWorker" in navigator;
    setIsSupported(supportsPwa);
    setHasCheckedSupport(true);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => {
      setInstalled(
        mediaQuery.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true
      );
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    checkInstalled();
    mediaQuery.addEventListener("change", checkInstalled);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener("change", checkInstalled);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const showPrompt = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
    }

    setDeferredPrompt(null);
  }, [deferredPrompt]);

  let status: PwaInstallPrompt["status"] = "not-available";
  if (installed) status = "installed";
  else if (!hasCheckedSupport) status = "not-available";
  else if (!isSupported) status = "unsupported";
  else if (deferredPrompt) status = "deferred";
  else status = "ready";

  return {
    event: deferredPrompt,
    canInstall: !!deferredPrompt && !installed,
    installed,
    showPrompt,
    status,
  };
}

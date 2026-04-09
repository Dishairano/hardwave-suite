import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  cancelInstall,
  defaultInstallDir,
  fetchLatestVersion,
  InstallProgress,
  LatestVersion,
  launchInstalled,
  onProgress,
  quit,
  startInstall,
} from "./lib/api";
import { WindowChrome } from "./components/WindowChrome";
import { Splash } from "./screens/Splash";
import { Welcome } from "./screens/Welcome";
import { Location } from "./screens/Location";
import { Installing } from "./screens/Installing";
import { Done } from "./screens/Done";

type Screen = "splash" | "welcome" | "location" | "installing" | "done";

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [version, setVersion] = useState<LatestVersion | null>(null);
  const [installDir, setInstallDir] = useState<string>("");
  const [desktopShortcut, setDesktopShortcut] = useState(true);
  const [startMenuShortcut, setStartMenuShortcut] = useState(true);
  const [progress, setProgress] = useState<InstallProgress>({
    phase: "downloading",
    percent: 0,
    message: "Starting…",
  });
  const [error, setError] = useState<string | null>(null);
  const installedExe = useRef<string | null>(null);

  // Initial load: fetch default dir, latest version, then move to welcome after splash.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dir, v] = await Promise.all([
          defaultInstallDir(),
          fetchLatestVersion().catch(() => null),
        ]);
        if (cancelled) return;
        setInstallDir(dir);
        setVersion(v);
      } catch (e) {
        console.error(e);
      }
    })();
    const splashTimer = setTimeout(() => {
      if (!cancelled) setScreen("welcome");
    }, 1600);
    return () => {
      cancelled = true;
      clearTimeout(splashTimer);
    };
  }, []);

  // Subscribe to install progress events once
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onProgress((p) => {
      setProgress(p);
      if (p.phase === "done") {
        setScreen("done");
      }
    }).then((un) => {
      unlisten = un;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const beginInstall = async () => {
    setError(null);
    setProgress({
      phase: "downloading",
      percent: 0,
      message: "Starting…",
    });
    setScreen("installing");
    try {
      const exe = await startInstall({
        install_dir: installDir,
        create_desktop_shortcut: desktopShortcut,
        create_start_menu_shortcut: startMenuShortcut,
        launch_after: false,
      });
      installedExe.current = exe;
      setScreen("done");
    } catch (e) {
      setError(String(e));
    }
  };

  const launchSuite = async () => {
    if (installedExe.current) {
      try {
        await launchInstalled(installedExe.current);
      } catch (e) {
        console.error("Launch failed:", e);
      }
    }
    await quit();
  };

  const closeInstaller = async () => {
    await quit();
  };

  const cancelAndClose = async () => {
    await cancelInstall();
    await quit();
  };

  return (
    <div className="w-screen h-screen bg-hw-bg/95 rounded-xl overflow-hidden relative border border-white/[0.07] backdrop-blur-xl">
      {/* Backdrop glow */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-hw-accent/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-hw-accent/10 blur-3xl rounded-full pointer-events-none" />

      <WindowChrome />

      <div className="absolute inset-0 pt-9">
        <AnimatePresence mode="wait">
          {screen === "splash" && <Splash key="splash" />}
          {screen === "welcome" && (
            <Welcome
              key="welcome"
              version={version}
              onContinue={() => setScreen("location")}
            />
          )}
          {screen === "location" && (
            <Location
              key="location"
              installDir={installDir}
              setInstallDir={setInstallDir}
              desktopShortcut={desktopShortcut}
              setDesktopShortcut={setDesktopShortcut}
              startMenuShortcut={startMenuShortcut}
              setStartMenuShortcut={setStartMenuShortcut}
              onBack={() => setScreen("welcome")}
              onContinue={beginInstall}
            />
          )}
          {screen === "installing" && (
            <Installing
              key="installing"
              progress={progress}
              error={error}
              onRetry={beginInstall}
              onCancel={cancelAndClose}
            />
          )}
          {screen === "done" && (
            <Done key="done" onLaunch={launchSuite} onClose={closeInstaller} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

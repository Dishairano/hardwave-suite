import { motion } from "framer-motion";
import { useState } from "react";
import { FolderOpen, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  installDir: string;
  setInstallDir: (v: string) => void;
  desktopShortcut: boolean;
  setDesktopShortcut: (v: boolean) => void;
  startMenuShortcut: boolean;
  setStartMenuShortcut: (v: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Location({
  installDir,
  setInstallDir,
  desktopShortcut,
  setDesktopShortcut,
  startMenuShortcut,
  setStartMenuShortcut,
  onBack,
  onContinue,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    try {
      const picked = await open({
        directory: true,
        multiple: false,
        defaultPath: installDir,
        title: "Choose install location",
      });
      if (typeof picked === "string") {
        setInstallDir(picked);
        setError(null);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 flex flex-col px-10 pt-16 pb-8"
    >
      <div>
        <div className="text-[10px] tracking-[0.28em] text-white/40 uppercase font-medium">
          Step 2 of 3
        </div>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight">
          Where should we install it?
        </h1>
      </div>

      <div className="mt-6">
        <div className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-2">
          Install Location
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-xs font-mono text-white/80 truncate">
            {installDir || "…"}
          </div>
          <button
            onClick={pick}
            className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] px-4 py-2.5 rounded-lg text-xs font-medium transition"
          >
            <FolderOpen size={14} />
            Browse
          </button>
        </div>
        {error && (
          <div className="mt-2 text-[11px] text-red-400">{error}</div>
        )}
      </div>

      <div className="mt-6">
        <div className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-3">
          Shortcuts
        </div>
        <div className="space-y-2">
          <Toggle
            checked={desktopShortcut}
            onChange={setDesktopShortcut}
            label="Create a desktop shortcut"
          />
          <Toggle
            checked={startMenuShortcut}
            onChange={setStartMenuShortcut}
            label="Add to Start Menu"
          />
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/60 hover:text-white text-xs font-medium transition"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!installDir}
          className="hw-accent-gradient text-black font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-glow hover:brightness-110 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Install
          <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg px-3.5 py-2.5 text-left transition"
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition ${
          checked
            ? "bg-hw-accent border-hw-accent"
            : "border-white/30 bg-transparent"
        }`}
      >
        {checked && <Check size={11} className="text-black" strokeWidth={3} />}
      </div>
      <span className="text-xs text-white/85">{label}</span>
    </button>
  );
}

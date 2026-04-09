import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X } from "lucide-react";

export function WindowChrome() {
  const win = getCurrentWindow();
  return (
    <div
      className="absolute top-0 left-0 right-0 h-9 flex items-center justify-between px-4 z-50"
      data-tauri-drag-region
    >
      <div
        className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-medium pointer-events-none"
        data-tauri-drag-region
      >
        Hardwave Suite · Setup
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => win.minimize()}
          className="w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 rounded transition"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => win.close()}
          className="w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-red-500/70 rounded transition"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

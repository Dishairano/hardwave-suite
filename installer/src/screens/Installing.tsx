import { motion } from "framer-motion";
import { HwLogo } from "../components/HwLogo";
import type { InstallProgress } from "../lib/api";

interface Props {
  progress: InstallProgress;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  downloading: "Downloading",
  extracting: "Extracting",
  shortcuts: "Creating shortcuts",
  registering: "Finalising",
  done: "Complete",
};

export function Installing({ progress, error, onRetry, onCancel }: Props) {
  const pct = Math.max(0, Math.min(100, progress.percent));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 flex flex-col items-center justify-center px-10 pt-12 pb-8"
    >
      <motion.div
        animate={!error ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <HwLogo size={88} glow />
      </motion.div>

      <div className="mt-6 text-center">
        <div className="text-[10px] tracking-[0.28em] text-white/40 uppercase font-medium">
          {error ? "Install failed" : PHASE_LABEL[progress.phase] ?? "Installing"}
        </div>
        <div className="mt-1 text-lg font-semibold tracking-tight max-w-[480px] truncate">
          {error ? "Something went wrong" : progress.message || "Please wait…"}
        </div>
      </div>

      {/* Progress bar */}
      {!error && (
        <div className="mt-8 w-full max-w-md">
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full hw-accent-gradient"
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-white/40 uppercase tracking-wider">
            <span>{pct}%</span>
            <span>{progress.phase}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 w-full max-w-md">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-xs text-red-200 hw-scroll max-h-24 overflow-auto">
            {error}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={onCancel}
              className="text-white/60 hover:text-white text-xs font-medium px-4 py-2 transition"
            >
              Exit
            </button>
            <button
              onClick={onRetry}
              className="hw-accent-gradient text-black font-semibold px-5 py-2 rounded-lg text-xs shadow-glow hover:brightness-110 transition"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

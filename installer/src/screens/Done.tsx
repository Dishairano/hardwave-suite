import { motion } from "framer-motion";
import { Check, Rocket } from "lucide-react";
import { HwLogo } from "../components/HwLogo";

interface Props {
  onLaunch: () => void;
  onClose: () => void;
}

export function Done({ onLaunch, onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex flex-col items-center justify-center px-10 pt-12 pb-8"
    >
      <div className="relative">
        <HwLogo size={96} glow />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 240, damping: 18 }}
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-hw-bg flex items-center justify-center"
        >
          <Check size={14} strokeWidth={4} className="text-black" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="mt-6 text-center"
      >
        <div className="text-[10px] tracking-[0.28em] text-emerald-400 uppercase font-medium">
          Installation complete
        </div>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight">
          You're all set
        </h1>
        <div className="mt-1.5 text-xs text-white/55 max-w-sm">
          Hardwave Suite is ready to launch. Sign in once and all your plugins
          activate automatically.
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="mt-8 flex items-center gap-3"
      >
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-xs font-medium px-4 py-2 transition"
        >
          Close
        </button>
        <button
          onClick={onLaunch}
          className="hw-accent-gradient text-black font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-glow hover:brightness-110 active:scale-[0.98] transition"
        >
          <Rocket size={16} />
          Launch Hardwave Suite
        </button>
      </motion.div>
    </motion.div>
  );
}

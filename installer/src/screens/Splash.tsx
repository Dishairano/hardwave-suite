import { motion } from "framer-motion";
import { HwLogo } from "../components/HwLogo";

export function Splash() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <HwLogo size={112} glow />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="mt-6 text-center"
      >
        <div className="text-[11px] tracking-[0.32em] text-white/40 uppercase font-medium">
          Hardwave Studios
        </div>
        <div className="mt-2 text-3xl font-bold tracking-tight">
          Hardwave <span className="hw-accent-text">Suite</span>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-10 flex items-center gap-2 text-white/50 text-xs"
      >
        <div className="w-3 h-3 border-2 border-white/20 border-t-hw-accent rounded-full animate-spin" />
        Preparing setup…
      </motion.div>
    </motion.div>
  );
}

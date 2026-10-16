import { motion } from 'framer-motion'
import type { UninstallProgress, UninstallStep } from '../lib/api'

/** The words for each step the uninstaller reports. */
const STEP_LABELS: Record<UninstallStep, string> = {
  close_app: 'Close Hardwave Suite',
  remove_plugins: 'Remove the plug-ins',
  remove_install_folder: 'Remove the app',
  remove_shortcuts: 'Remove the shortcuts',
  remove_registry_keys: 'Remove the Windows entry',
}

interface Props {
  progress: UninstallProgress
}

/** Uninstall 2: the steps and a bar. No cancel: a half-removed app helps nobody. */
export function Removing({ progress }: Props) {
  const total = progress.steps.length
  const pct = total > 0 ? Math.round((Math.min(progress.done, total) / total) * 100) : 0
  const cls = (i: number) => (i < progress.done ? 'd' : i === progress.done ? 'n' : 'w')

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} className="screen">
      <div className="ib">
        <div className="cap">{`Removing · ${pct}%`}</div>
        <h1 className="t">Removing Hardwave Suite.</h1>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="ph">
          {progress.steps.map((step, i) => <div key={step} className={cls(i)}>{STEP_LABELS[step]}</div>)}
        </div>
      </div>
    </motion.div>
  )
}

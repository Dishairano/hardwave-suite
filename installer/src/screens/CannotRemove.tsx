import { motion } from 'framer-motion'
import type { UninstallFailure, UninstallStep } from '../lib/api'

const HEADLINES: Partial<Record<UninstallStep, string>> = {
  close_app: 'Hardwave Suite is still open.',
  remove_plugins: 'A plug-in is still in use.',
  remove_install_folder: 'Some files are still in use.',
}

interface Props {
  failure: UninstallFailure
  onClose: () => void
  onRetry: () => void
}

/** Uninstall 4: what stopped the uninstall, and Try again. */
export function CannotRemove({ failure, onClose, onRetry }: Props) {
  const headline = (failure.step && HEADLINES[failure.step]) || 'Something got in the way.'
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} className="screen">
      <div className="ib">
        <div className="cap bad">Cannot remove yet</div>
        <h1 className="t">{headline}</h1>
        <div className="errbox">{failure.reason}</div>
        <div className="ft">
          <button type="button" className="ibtn ghost" onClick={onClose}>Close</button>
          <button type="button" className="ibtn" onClick={onRetry}>Try again</button>
        </div>
      </div>
    </motion.div>
  )
}

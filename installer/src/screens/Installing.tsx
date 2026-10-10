import { motion } from 'framer-motion'
import type { InstallProgress } from '../lib/api'

interface Props {
  progress: InstallProgress
  version: string | null
  error: string | null
  onRetry: () => void
  onCancel: () => void
}

const ORDER: InstallProgress['phase'][] = ['downloading', 'extracting', 'shortcuts', 'registering', 'done']

/** Where the install is, as a bar and the steps, with the last line of what happened. */
export function Installing({ progress, version, error, onRetry, onCancel }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress.percent)))
  const at = ORDER.indexOf(progress.phase)
  const steps: Array<[string, number]> = [
    [version ? `Download Hardwave ${version}` : 'Download Hardwave', 0],
    ['Unpack', 1],
    ['Shortcuts', 2],
    ['Ready to sign in', 3],
  ]
  const cls = (i: number) => (error ? (i < at ? 'd' : 'w') : i < at ? 'd' : i === at ? 'n' : 'w')

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} className="screen">
      <div className="ib">
        <div className={`cap${error ? ' bad' : ''}`}>{error ? 'Install failed' : `Installing · ${pct}%`}</div>
        <h1 className="t">{error ? 'Something went wrong.' : pct < 90 ? 'Almost there.' : 'Finishing up.'}</h1>
        {!error && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
        <div className="ph">
          {steps.map(([label, i]) => <div key={label} className={cls(i)}>{label}</div>)}
        </div>
        {error
          ? <div className="errbox">{error}</div>
          : <div className="logrow">{progress.message || 'Starting…'}</div>}
        <div className="ft">
          <button type="button" className="ibtn ghost" onClick={onCancel}>{error ? 'Exit' : 'Cancel'}</button>
          {error && <button type="button" className="ibtn" onClick={onRetry}>Try again</button>}
        </div>
      </div>
    </motion.div>
  )
}

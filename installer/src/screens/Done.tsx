import { motion } from 'framer-motion'
import { HwWaveMark, Bars } from '../components/HwWaveMark'

interface Props {
  onLaunch: () => void
  onClose: () => void
}

export function Done({ onLaunch, onClose }: Props) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="screen">
      <div className="ib center">
        <HwWaveMark />
        <div className="cap ok">Installed</div>
        <h1 className="t big">Sign in next.</h1>
        <p className="sub">The free Analyser installs as soon as you do.</p>
        <div className="ft center" style={{ marginTop: 18 }}>
          <button type="button" className="ibtn ghost" onClick={onClose}>Close</button>
          <button type="button" className="ibtn" onClick={onLaunch}>Open Hardwave</button>
        </div>
      </div>
      <Bars faint />
    </motion.div>
  )
}

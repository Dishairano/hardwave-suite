import { motion } from 'framer-motion'
import { HwWaveMark, Bars } from '../components/HwWaveMark'

interface Props {
  removedPlugins: boolean
  onClose: () => void
}

/** Uninstall 3: done, and where to get it back. */
export function Removed({ removedPlugins, onClose }: Props) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="screen">
      <div className="ib center">
        <HwWaveMark />
        <div className="cap ok">Removed</div>
        <h1 className="t big">Hardwave Suite is gone.</h1>
        <p className="sub">
          Get it back any time at hardwavestudios.com.
          <br />
          {removedPlugins ? 'Sign in and the Suite installs your plug-ins again.' : 'Your plug-ins stay in your DAW.'}
        </p>
        <div className="ft center" style={{ marginTop: 18 }}>
          <button type="button" className="ibtn" onClick={onClose}>Close</button>
        </div>
      </div>
      <Bars faint />
    </motion.div>
  )
}

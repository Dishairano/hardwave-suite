import { motion } from 'framer-motion'
import { HwWaveMark, Bars } from '../components/HwWaveMark'

export function Splash() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="screen">
      <div className="ib center">
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <HwWaveMark />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
          <h1 className="t big">Hardwave</h1>
          <p className="sub">The studio for harder styles</p>
        </motion.div>
      </div>
      <Bars />
    </motion.div>
  )
}

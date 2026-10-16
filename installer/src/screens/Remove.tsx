import { motion } from 'framer-motion'

interface Props {
  /** Names of the plug-ins the Suite installed that are on this PC; null while loading. */
  plugins: string[] | null
  removePlugins: boolean
  setRemovePlugins: (v: boolean) => void
  onCancel: () => void
  onRemove: () => void
}

/** Uninstall 1: what stays and what goes. Nothing is removed before Remove. */
export function Remove({ plugins, removePlugins, setRemovePlugins, onCancel, onRemove }: Props) {
  const named = plugins && plugins.length > 0 ? plugins.join(' · ') : null
  const pluginsLine = named ? `The plug-ins it installed: ${named}` : 'The plug-ins it installed'

  const stays = [
    ...(removePlugins ? [] : [named ? `Your plug-ins: ${named}` : 'Your plug-ins in your DAW']),
    'Your Hardwave account',
    'Your projects and presets',
    'Your Suite settings, for a later install',
  ]
  const goes = [
    'The Hardwave Suite app',
    'Its desktop and Start menu shortcuts',
    'Its entry in the Windows apps list',
    ...(removePlugins ? [pluginsLine] : []),
  ]

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} className="screen">
      <div className="ib">
        <div className="cap">Uninstall</div>
        <h1 className="t">Remove Hardwave Suite?</h1>
        <p className="sub">Nothing is removed until you press Remove.</p>
        <div className="sg">
          <div className="stays">
            <h2>Stays</h2>
            <ul>{stays.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <div className="goes">
            <h2>Goes</h2>
            <ul>{goes.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        </div>
        <button type="button" className="opt two" onClick={() => setRemovePlugins(!removePlugins)} aria-pressed={removePlugins}>
          <i className={removePlugins ? 'on' : ''} />
          <span>
            Also remove the plug-ins the Suite installed
            <small>{plugins === null ? 'Looking for them…' : named ?? 'None of them are on this PC.'}</small>
          </span>
        </button>
        <div className="ft">
          <button type="button" className="ibtn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="ibtn" onClick={onRemove}>Remove</button>
        </div>
      </div>
    </motion.div>
  )
}

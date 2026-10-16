import * as api from '../lib/api'
import type { Library } from '../lib/library'

const SITE = 'https://hardwavestudios.com'
const DISCORD = 'https://discord.gg/hardwave'

function open(url: string) {
  api.openExternalUrl(url).catch(() => { if (api.isWebUrl(url)) window.open(url, '_blank') })
}

const GUIDES: Array<[string, string, string]> = [
  ['Plug-ins', 'Where the Suite puts your plug-ins, and what to do when your DAW cannot find them', '/learn/plug-ins/analyser'],
  ['Plug-ins', 'The plug-in window stays blank', '/support'],
  ['Suite', 'Managing updates for several plug-ins', '/support'],
]

const FAQ: Array<[string, string]> = [
  ['Can I use my plug-ins on two computers?', '/support'],
  ['Which DAWs are supported?', '/support'],
  ['How do I move a plug-in to another folder?', '/support'],
]

interface Props {
  lib: Library
  appVersion: string
}

export function HelpView({ lib, appVersion }: Props) {
  const os = navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'
  return (
    <div className="a2-main">
      <div className="phd">
        <div><h2 className="ph1">Help</h2><p>The answers we give most, and a direct line to us.</p></div>
        <button type="button" className="a2-btn red" onClick={() => open(`${SITE}/support`)}>Report a bug</button>
      </div>
      <div className="guides">
        {GUIDES.map(([cat, title, path]) => (
          <button type="button" key={title} onClick={() => open(SITE + path)}><small>{cat}</small><b>{title}</b></button>
        ))}
      </div>
      <div className="big2">
        <div className="a2-card"><div className="k">Talk to us</div><p>Discord is fastest. A bug report from the site includes the plug-in's editor log when you attach it, so we can see what happened.</p>
          <div className="row"><button type="button" className="a2-btn ghost sm" onClick={() => open(DISCORD)}>Open Discord</button><button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/support`)}>Support</button></div></div>
        <div className="a2-card"><div className="k">This PC</div>
          <div className="kv"><span>Hardwave</span><b>{appVersion || '…'}</b></div>
          <div className="kv"><span>System</span><b>{os}</b></div>
          <div className="kv"><span>Plug-ins installed</span><b>{lib.counts.installed}</b></div>
          <div className="kv"><span>Updates waiting</span><b>{lib.counts.updates}</b></div>
        </div>
      </div>
      <div className="files">
        {FAQ.map(([q, path]) => (
          <button type="button" key={q} onClick={() => open(SITE + path)}><i className="faq">FAQ</i><span>{q}</span><small /><em>→</em></button>
        ))}
      </div>
    </div>
  )
}

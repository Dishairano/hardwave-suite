import * as api from '../lib/api'
import workspacePic from '../assets/lines/workspace.jpg'
import dawPic from '../assets/lines/daw.jpg'
import logoWorkspace from '../assets/lines/logo-workspace.png'
import logoDaw from '../assets/lines/logo-daw.png'

const SITE = 'https://hardwavestudios.com'
const WORKSPACE = 'https://workspace.hardwavestudios.com'

function open(url: string) {
  api.openExternalUrl(url).catch(() => { if (api.isWebUrl(url)) window.open(url, '_blank') })
}

/**
 * The other Hardwave lines, each on one calm page: what it is, what it
 * gives, and the one button that opens it. Numbers appear only once the
 * app can read them; nothing here is made up.
 */

export function WorkspaceView() {
  return (
    <div className="a2-main">
      <div className="phd">
        <div><h2 className="ph1">Workspace</h2><p>Your projects and samples, backed up on every PC.</p></div>
        <button type="button" className="a2-btn purple" onClick={() => open(WORKSPACE)}>Open Workspace</button>
      </div>
      <div className="big2">
        <div className="hero2"><img src={workspacePic} alt="" style={{ objectPosition: 'top left' }} />
          <div className="in"><img className="lg" src={logoWorkspace} alt="Workspace" /><p>Your Workspace sits in Explorer like any folder. Files you have not opened stay online and take no space; one click frees the space again.</p></div>
        </div>
        <div className="a2-card">
          <div className="k">What it gives</div>
          <div className="kv"><span>Every save of a project</span><b>kept</b></div>
          <div className="kv"><span>Autosaves</span><b>folded into their project</b></div>
          <div className="kv"><span>Samples</span><b>searched by name, BPM, key</b></div>
          <div className="kv"><span>Share links</span><b>listen first, then download</b></div>
          <div className="kv"><span>Storage</span><b>2 GB free · 50 GB with Pro</b></div>
          <div className="row">
            <button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/download`)}>Get the Windows app</button>
            <button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/workspace`)}>How it works</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DawView() {
  return (
    <div className="a2-main">
      <div className="phd">
        <div><h2 className="ph1">DAW</h2><p>A free DAW for harder styles, with every Hardwave plug-in inside.</p></div>
        <button type="button" className="a2-btn red" onClick={() => open(`${SITE}/download`)}>Download for Windows</button>
      </div>
      <div className="big2">
        <div className="hero2" style={{ minHeight: 300 }}><img src={dawPic} alt="" />
          <div className="in"><img className="lg" src={logoDaw} alt="DAW" /><p>Playlist, channel rack, piano roll and mixer, the way you know them. Opens FL Studio projects. Free, no time limit.</p></div>
        </div>
        <div className="a2-card">
          <div className="k">What is inside</div>
          <div className="kv"><span>Playlist, channel rack, piano roll, mixer</span><b>✓</b></div>
          <div className="kv"><span>Every Hardwave plug-in, free</span><b>✓</b></div>
          <div className="kv"><span>Opens FL Studio projects</span><b>✓</b></div>
          <div className="kv"><span>Audio to MIDI, spectral repair</span><b>✓</b></div>
          <div className="kv"><span>Rooms: work on one project together</span><b>Pro</b></div>
          <div className="kv"><span>Stems from a finished track</span><b>Pro</b></div>
        </div>
      </div>
      <div className="big2">
        <div className="a2-card"><div className="k">Release notes</div><h3>Every version says what changed</h3><p>The DAW updates itself and shows the notes, the same way plug-in updates do here.</p><div className="row"><button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/changelog`)}>Changelog</button></div></div>
        <div className="a2-card"><div className="k">On your PC</div><div className="kv"><span>System</span><b>Windows 10 and 11</b></div><div className="kv"><span>Plug-ins</span><b>VST3, CLAP and 32-bit</b></div><div className="kv"><span>Projects</span><b>saved to Workspace</b></div></div>
      </div>
    </div>
  )
}

const GUIDES: Array<[string, string, string]> = [
  ['Spectrum', 'Reading a spectrum analyser', '/learn/spectrum-analysis'],
  ['Mastering', 'LUFS targets for hard dance', '/learn/mastering'],
  ['Mixing', 'Kick and bass balance', '/learn/mixing'],
  ['Sound design', 'Hardstyle kick synthesis', '/learn/sound-design'],
  ['Effects', 'Introduction to FX chains', '/learn/effects'],
  ['Spectrum', 'Finding mud and resonance', '/learn/spectrum-analysis'],
  ['Mastering', 'Introduction to mastering', '/learn/mastering'],
  ['Production science', 'Loudness perception in music', '/learn/production-science'],
  ['Plug-ins', 'Hardwave Analyser, the complete guide', '/learn/plug-ins/analyser'],
]

export function AcademyView() {
  return (
    <div className="a2-main">
      <div className="phd">
        <div><h2 className="ph1">Academy</h2><p>Courses on harder-styles production. Until it opens, the guides are free.</p></div>
        <button type="button" className="a2-btn amber" onClick={() => open(`${SITE}/academy`)}>Join the waitlist</button>
      </div>
      <div className="guides">
        {GUIDES.map(([cat, title, path]) => (
          <button type="button" key={title} onClick={() => open(SITE + path)}><small>{cat}</small><b>{title}</b></button>
        ))}
      </div>
      <div className="big2">
        <div className="a2-card"><div className="k">When it opens</div><h3>Video courses by Hardwave Studios</h3><p>A course library on harder-styles production, recorded on the tools you use, with the project files included. Mentorship next to it, at the mentor's own fee.</p><div className="kv" style={{ marginTop: 10 }}><span>Planned price</span><b>EUR 19 a month, with everything in Pro</b></div></div>
        <div className="a2-card"><div className="k">Free now</div><h3>36 guides on the site</h3><p>Mastering, mixing, sound design, spectrum analysis and the science behind loudness.</p><div className="row"><button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/learn`)}>Open all guides</button></div></div>
      </div>
    </div>
  )
}

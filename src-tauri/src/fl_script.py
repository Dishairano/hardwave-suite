# name=Hardwave Collab
# url=https://hardwavestudios.com
# supportedDevices=Hardwave Collab

"""
Hardwave Collab — FL Studio MIDI Controller Script
Reads DAW state (mixer, transport, channels, step sequencer, plugin params,
cursor position) and posts diffs to the local Collab Bridge at
http://127.0.0.1:9900/fl-state.
Polls http://127.0.0.1:9900/fl-commands for remote changes to apply.
"""

import time
import json
import threading
import ctypes
import ctypes.wintypes
import midi
import mixer
import transport
import channels
import patterns
import plugins
import general
import ui
from urllib.request import Request, urlopen
from urllib.error import URLError

BRIDGE_URL = "http://127.0.0.1:9900"
POLL_INTERVAL_MS = 33   # ~30 Hz
COMMAND_POLL_MS = 50     # poll remote commands at ~20 Hz
MAX_STEP_SEQ_STEPS = 64  # max steps per channel in step sequencer
MAX_PLUGIN_PARAMS = 64   # max plugin params to track per channel


class HardwaveCollab:
    def __init__(self):
        self.last_state = None
        self.connected = False
        self.running = True
        self.command_thread = None
        # Throttle heavy reads — step seq + plugins every 3rd tick (~10 Hz)
        self.tick_count = 0

    # ── Cursor tracking via Windows API ──

    def get_cursor_info(self):
        """Get mouse cursor position and which FL window it's over."""
        point = ctypes.wintypes.POINT()
        ctypes.windll.user32.GetCursorPos(ctypes.byref(point))

        # Get window under cursor
        hwnd = ctypes.windll.user32.WindowFromPoint(point)

        # Convert to client coordinates of FL's main window
        fl_hwnd = ctypes.windll.user32.GetForegroundWindow()
        client_point = ctypes.wintypes.POINT(point.x, point.y)
        ctypes.windll.user32.ScreenToClient(fl_hwnd, ctypes.byref(client_point))

        return {
            "screen_x": point.x,
            "screen_y": point.y,
            "client_x": client_point.x,
            "client_y": client_point.y,
            "window": self._get_active_window(),
        }

    # ── State readers ──

    def get_mixer_state(self):
        """Read current mixer state."""
        tracks = []
        count = mixer.trackCount()
        for i in range(min(count, 125)):
            tracks.append({
                "index": i,
                "name": mixer.getTrackName(i),
                "volume": round(mixer.getTrackVolume(i), 4),
                "pan": round(mixer.getTrackPan(i), 4),
                "muted": mixer.isTrackMuted(i),
                "solo": mixer.isTrackSolo(i),
            })
        return tracks

    def get_transport_state(self):
        """Read current transport state."""
        return {
            "playing": transport.isPlaying(),
            "recording": transport.isRecording(),
            "bpm": round(mixer.getCurrentTempo() / 1000, 2),
            "position": transport.getSongPos(0),
            "song_length": transport.getSongLength(0),
        }

    def get_channel_state(self):
        """Read current channel rack state."""
        chans = []
        count = channels.channelCount()
        for i in range(count):
            chans.append({
                "index": i,
                "name": channels.getChannelName(i),
                "volume": round(channels.getChannelVolume(i), 4),
                "pan": round(channels.getChannelPan(i), 4),
                "muted": channels.isChannelMuted(i),
            })
        return chans

    def get_pattern_state(self):
        """Read pattern names and active pattern."""
        pats = []
        count = patterns.patternCount()
        for i in range(1, count + 1):
            pats.append({
                "index": i,
                "name": patterns.getPatternName(i),
            })
        return pats

    def get_step_sequencer_state(self):
        """Read step sequencer grid bits for all channels."""
        steps = {}
        count = channels.channelCount()
        for ch in range(count):
            bits = []
            for step in range(MAX_STEP_SEQ_STEPS):
                try:
                    bits.append(channels.getGridBit(ch, step))
                except Exception:
                    break
            steps[ch] = bits
        return steps

    def get_plugin_params_state(self):
        """Read plugin parameters for all channel instruments."""
        params = {}
        count = channels.channelCount()
        for ch in range(count):
            try:
                param_count = plugins.getParamCount(ch)
                if param_count <= 0:
                    continue
                ch_params = []
                for p in range(min(param_count, MAX_PLUGIN_PARAMS)):
                    ch_params.append({
                        "index": p,
                        "name": plugins.getParamName(p, ch),
                        "value": round(plugins.getParamValue(p, ch), 6),
                    })
                params[ch] = ch_params
            except Exception:
                continue
        return params

    def get_full_state(self):
        """Capture the full DAW state snapshot."""
        state = {
            "transport": self.get_transport_state(),
            "mixer": self.get_mixer_state(),
            "channels": self.get_channel_state(),
            "patterns": self.get_pattern_state(),
            "active_window": self._get_active_window(),
            "cursor": self.get_cursor_info(),
        }

        # Heavier reads at reduced frequency
        if self.tick_count % 3 == 0:
            state["step_seq"] = self.get_step_sequencer_state()
            state["plugin_params"] = self.get_plugin_params_state()

        return state

    def _get_active_window(self):
        """Detect which FL Studio window is focused."""
        if ui.getFocused(0):
            return "mixer"
        elif ui.getFocused(1):
            return "channel_rack"
        elif ui.getFocused(2):
            return "piano_roll"
        elif ui.getFocused(3):
            return "playlist"
        elif ui.getFocused(4):
            return "browser"
        return "unknown"

    # ── Diff engine ──

    def compute_diff(self, old_state, new_state):
        """Compute ops for changed values between two state snapshots."""
        ops = []

        # Transport changes
        for key in ("playing", "recording", "bpm", "position"):
            old_val = old_state["transport"].get(key)
            new_val = new_state["transport"].get(key)
            if old_val != new_val:
                ops.append({"op": "set", "path": f"transport.{key}", "value": new_val})

        # Mixer changes
        old_mixer = {t["index"]: t for t in old_state.get("mixer", [])}
        for track in new_state.get("mixer", []):
            idx = track["index"]
            old_track = old_mixer.get(idx, {})
            for key in ("volume", "pan", "muted", "solo", "name"):
                if track.get(key) != old_track.get(key):
                    ops.append({
                        "op": "set",
                        "path": f"mixer.tracks[{idx}].{key}",
                        "value": track[key],
                    })

        # Channel changes
        old_chans = {c["index"]: c for c in old_state.get("channels", [])}
        for ch in new_state.get("channels", []):
            idx = ch["index"]
            old_ch = old_chans.get(idx, {})
            for key in ("volume", "pan", "muted", "name"):
                if ch.get(key) != old_ch.get(key):
                    ops.append({
                        "op": "set",
                        "path": f"channels[{idx}].{key}",
                        "value": ch[key],
                    })

        # Step sequencer changes
        old_steps = old_state.get("step_seq", {})
        new_steps = new_state.get("step_seq", {})
        for ch_str, bits in new_steps.items():
            ch = int(ch_str) if isinstance(ch_str, str) else ch_str
            old_bits = old_steps.get(ch, old_steps.get(str(ch), []))
            for step, val in enumerate(bits):
                old_val = old_bits[step] if step < len(old_bits) else 0
                if val != old_val:
                    ops.append({
                        "op": "set",
                        "path": f"step_seq[{ch}][{step}]",
                        "value": val,
                    })

        # Plugin parameter changes
        old_params = old_state.get("plugin_params", {})
        new_params = new_state.get("plugin_params", {})
        for ch_str, params in new_params.items():
            ch = int(ch_str) if isinstance(ch_str, str) else ch_str
            old_ch_params = old_params.get(ch, old_params.get(str(ch), []))
            old_param_map = {p["index"]: p["value"] for p in old_ch_params}
            for param in params:
                p_idx = param["index"]
                if old_param_map.get(p_idx) != param["value"]:
                    ops.append({
                        "op": "set",
                        "path": f"plugin_params[{ch}][{p_idx}]",
                        "value": param["value"],
                    })

        return ops

    # ── Network ──

    def post_state(self, state, ops):
        """Send state diff to the Collab Bridge."""
        try:
            payload = json.dumps({
                "state": state,
                "ops": ops,
                "active_window": state.get("active_window", "unknown"),
                "cursor": state.get("cursor"),
            }).encode("utf-8")

            req = Request(
                f"{BRIDGE_URL}/fl-state",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urlopen(req, timeout=0.5)
            self.connected = True
        except URLError:
            self.connected = False
        except Exception:
            self.connected = False

    def poll_commands(self):
        """Poll the bridge for remote commands to apply."""
        while self.running:
            try:
                req = Request(f"{BRIDGE_URL}/fl-commands", method="GET")
                resp = urlopen(req, timeout=0.5)
                data = json.loads(resp.read().decode("utf-8"))
                commands = data.get("commands", [])
                for cmd in commands:
                    self.apply_command(cmd)
            except URLError:
                pass
            except Exception:
                pass
            time.sleep(COMMAND_POLL_MS / 1000.0)

    def apply_command(self, cmd):
        """Apply a remote state change to FL Studio."""
        op = cmd.get("op")
        path = cmd.get("path", "")
        value = cmd.get("value")

        try:
            if path.startswith("transport."):
                key = path.split(".", 1)[1]
                if key == "playing":
                    if value and not transport.isPlaying():
                        transport.start()
                    elif not value and transport.isPlaying():
                        transport.stop()
                elif key == "bpm":
                    mixer.setCurrentTempo(int(value * 1000))

            elif path.startswith("mixer.tracks["):
                idx_str = path.split("[")[1].split("]")[0]
                idx = int(idx_str)
                key = path.split(".")[-1]
                if key == "volume":
                    mixer.setTrackVolume(idx, value)
                elif key == "pan":
                    mixer.setTrackPan(idx, value)
                elif key == "muted":
                    if mixer.isTrackMuted(idx) != value:
                        mixer.muteTrack(idx)
                elif key == "solo":
                    if mixer.isTrackSolo(idx) != value:
                        mixer.soloTrack(idx)

            elif path.startswith("channels["):
                idx_str = path.split("[")[1].split("]")[0]
                idx = int(idx_str)
                key = path.split(".")[-1]
                if key == "volume":
                    channels.setChannelVolume(idx, value)
                elif key == "pan":
                    channels.setChannelPan(idx, value)
                elif key == "muted":
                    if channels.isChannelMuted(idx) != value:
                        channels.muteChannel(idx)

            elif path.startswith("step_seq["):
                # step_seq[channel][step]
                parts = path.replace("step_seq[", "").replace("]", " ").split("[")
                ch = int(parts[0].strip())
                step = int(parts[1].strip())
                current = channels.getGridBit(ch, step)
                if current != value:
                    channels.setGridBit(ch, step, value)

            elif path.startswith("plugin_params["):
                # plugin_params[channel][param_index]
                parts = path.replace("plugin_params[", "").replace("]", " ").split("[")
                ch = int(parts[0].strip())
                p_idx = int(parts[1].strip())
                plugins.setParamValue(value, p_idx, ch)

        except Exception:
            pass


# ── FL Studio callback API ──

_collab = HardwaveCollab()


def OnInit():
    """Called when the script is loaded."""
    _collab.running = True
    _collab.command_thread = threading.Thread(target=_collab.poll_commands, daemon=True)
    _collab.command_thread.start()
    print("Hardwave Collab: initialized (v2 — cursor, step seq, plugin params)")


def OnDeInit():
    """Called when the script is unloaded."""
    _collab.running = False
    print("Hardwave Collab: stopped")


def OnIdle():
    """Called ~30 times per second by FL Studio."""
    _collab.tick_count += 1
    new_state = _collab.get_full_state()

    if _collab.last_state is not None:
        ops = _collab.compute_diff(_collab.last_state, new_state)
        if ops:
            _collab.post_state(new_state, ops)
    else:
        # First run: send full state
        _collab.post_state(new_state, [])

    _collab.last_state = new_state


def OnRefresh(flags):
    """Called when FL Studio UI refreshes."""
    pass


def OnMidiMsg(event):
    """Not used — we don't process MIDI input."""
    pass

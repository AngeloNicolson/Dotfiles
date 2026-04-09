import { createState } from "ags"
import { createPoll } from "ags/time"
import { type Accessor } from "gnim"
import { execAsync } from "ags/process"
import { writeFile, readFile } from "ags/file"
import { s } from "../scale"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk"
import Gtk from "gi://Gtk"
import Wp from "gi://AstalWp"

// Voice-optimized EQ bands for mic processing
const VOICE_BANDS = [
  { label: "CUT", type: "bq_highpass", freq: 80, q: 0.7 },   // Rumble cut
  { label: "BODY", type: "bq_peaking", freq: 200, q: 1.0 },   // Warmth/body
  { label: "MUD", type: "bq_peaking", freq: 400, q: 1.0 },    // Mud/boxiness
  { label: "PRES", type: "bq_peaking", freq: 2500, q: 1.0 },  // Presence/clarity
  { label: "AIR", type: "bq_highshelf", freq: 8000, q: 0.7 },  // Air/sibilance
]

const NUM_BANDS = VOICE_BANDS.length

const VOICE_PRESETS: Record<string, { label: string, gains: number[] }> = {
  raw:       { label: "RAW",  gains: [0, 0, 0, 0, 0] },
  clean:     { label: "CLN",  gains: [6, 0, -3, 3, 2] },
  warm:      { label: "WRM",  gains: [6, 4, -2, 1, -1] },
  broadcast: { label: "CAST", gains: [8, 2, -4, 5, 3] },
}

const SEGMENTS = 20
const VOL_SEGMENTS = 16
const GAIN_MIN = -12
const GAIN_MAX = 12
const GAIN_RANGE = GAIN_MAX - GAIN_MIN

const VOICE_CONF = GLib.get_home_dir() + "/.config/pipewire/source-voice.conf"

const [gains, setGains] = createState<number[]>(new Array(NUM_BANDS).fill(0))
const [voiceAvailable, setVoiceAvailable] = createState(true)
const [activePreset, setActivePreset] = createState("raw")
const [noiseCancel, setNoiseCancel] = createState(false)
const [vadThreshold, setVadThreshold] = createState(50)

let reloadTimer: number | null = null
try {
  const saved = readFile(VOICE_CONF)
  if (saved) {
    const gainsMatch = saved.match(/# gains: (.+)/)
    if (gainsMatch) {
      const parsed = JSON.parse(gainsMatch[1])
      if (Array.isArray(parsed) && parsed.length === NUM_BANDS) {
        setGains(parsed)
        const presetMatch = Object.entries(VOICE_PRESETS).find(([_, p]) =>
          p.gains.every((g, i) => g === parsed[i])
        )
        if (presetMatch) setActivePreset(presetMatch[0])
        else setActivePreset("")
      }
    }
    const ncMatch = saved.match(/# nc: (\d+)/)
    if (ncMatch) {
      const vad = parseInt(ncMatch[1])
      setNoiseCancel(vad > 0)
      setVadThreshold(vad > 0 ? vad : 50)
    }
  }
} catch {}

function isChainActive(g: number[], nc: boolean): boolean {
  return nc || g.some((v) => v !== 0)
}

function buildConfFile(g: number[], nc: boolean, vad: number): string {
  const allNodes: string[] = []
  const allLinks: string[] = []

  // RNNoise node (LADSPA plugin) — first in chain if enabled
  if (nc) {
    allNodes.push(`                    { type = ladspa name = rnnoise plugin = "librnnoise_ladspa" label = noise_suppressor_mono control = { "VAD Threshold (%)" ${vad.toFixed(1)} } }`)
  }

  // Voice EQ bands
  VOICE_BANDS.forEach((band, i) => {
    if (band.type === "bq_highpass") {
      const freq = band.freq + (Math.max(0, g[i]) / GAIN_MAX) * 120
      allNodes.push(`                    { type = builtin name = voice_band_${i} label = ${band.type} control = { "Freq" = ${freq.toFixed(1)} "Q" = ${band.q} } }`)
    } else {
      allNodes.push(`                    { type = builtin name = voice_band_${i} label = ${band.type} control = { "Freq" = ${band.freq}.0 "Q" = ${band.q} "Gain" = ${g[i].toFixed(1)} } }`)
    }
  })

  // Links: rnnoise -> band_0 -> band_1 -> ... -> band_N
  if (nc) {
    allLinks.push(`                    { output = "rnnoise:Out" input = "voice_band_0:In" }`)
  }
  VOICE_BANDS.slice(0, -1).forEach((_, i) => {
    allLinks.push(`                    { output = "voice_band_${i}:Out" input = "voice_band_${i + 1}:In" }`)
  })

  return `# gains: ${JSON.stringify(g)}
# nc: ${nc ? vad : 0}
context.modules = [
    { name = libpipewire-module-filter-chain
        flags = [ nofail ]
        args = {
            node.description = "Voice Processor"
            media.name       = "Voice Processor"
            filter.graph = {
                nodes = [
${allNodes.join("\n")}
                ]
                links = [
${allLinks.join("\n")}
                ]
            }
            audio.channels = 1
            audio.position = [ MONO ]
            capture.props = {
                node.name = "effect_input.voice"
                media.class = Audio/Source/Virtual
                audio.channels = 1
                audio.position = [ MONO ]
            }
            playback.props = {
                node.name = "effect_output.voice"
                media.class = Audio/Sink
                audio.channels = 1
                audio.position = [ MONO ]
                node.passive = true
            }
        }
    }
]
`
}

function setVoiceAsDefault() {
  execAsync(["pw-metadata", "0", "default.audio.source", '{ "name": "effect_input.voice" }', "Spa:String:JSON"])
    .then(() => {
      print("VOICE: set as default source via pw-metadata")
      setVoiceAvailable(true)
    })
    .catch((e) => print(`VOICE: pw-metadata failed: ${e}`))
}

function clearVoiceDefault() {
  execAsync(["pw-metadata", "0", "default.audio.source", "", ""])
    .catch(() => {})
}

function updateGainsRuntime(g: number[]) {
  const params = VOICE_BANDS.map((band, i) => {
    if (band.type === "bq_highpass") {
      const freq = band.freq + (Math.max(0, g[i]) / GAIN_MAX) * 120
      return `"voice_band_${i}:Freq" ${freq.toFixed(1)}`
    }
    return `"voice_band_${i}:Gain" ${g[i].toFixed(1)}`
  }).join(" ")
  return execAsync(["bash", "-c",
    `ID=$(wpctl status | grep -oP '\\d+(?=\\. effect_input\\.voice)' | head -1) && [ -n "$ID" ] && pw-cli set-param $ID Props "{ params = [ ${params} ] }"`
  ])
}

// Voice chain runs its own pipewire process (separate from AudioEQ) using
// a dedicated config file loaded via `pipewire -c source-voice.conf`.
// This avoids disrupting audio playback when toggling voice processing.
function startVoiceProcess() {
  execAsync(["pkill", "-f", "pipewire -c source-voice.conf"]).catch(() => {})
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
    print("VOICE: starting voice filter chain...")
    try {
      GLib.spawn_command_line_async("pipewire -c source-voice.conf")
    } catch (e) { print(`VOICE: failed to start: ${e}`); setVoiceAvailable(false); return GLib.SOURCE_REMOVE }
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
      setVoiceAsDefault()
      return GLib.SOURCE_REMOVE
    })
    return GLib.SOURCE_REMOVE
  })
}

function stopVoiceProcess() {
  clearVoiceDefault()
  execAsync(["pkill", "-f", "pipewire -c source-voice.conf"]).catch(() => {})
}

function reloadVoiceChain() {
  if (reloadTimer) GLib.source_remove(reloadTimer)
  reloadTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
    reloadTimer = null
    const g = gains.get()
    const nc = noiseCancel.get()
    const vad = vadThreshold.get()

    if (!isChainActive(g, nc)) {
      stopVoiceProcess()
      execAsync(["rm", "-f", VOICE_CONF]).catch(() => {})
      print("VOICE: inactive, process stopped")
      return GLib.SOURCE_REMOVE
    }

    try { writeFile(VOICE_CONF, buildConfFile(g, nc, vad)) } catch { setVoiceAvailable(false); return GLib.SOURCE_REMOVE }

    updateGainsRuntime(g)
      .then(() => print("VOICE: updated gains at runtime"))
      .catch(() => {
        print("VOICE: runtime update failed, starting voice process")
        startVoiceProcess()
      })

    return GLib.SOURCE_REMOVE
  })
}

// Toggling noise cancel changes the node graph — must restart the voice process
function toggleNoiseCancel() {
  const nc = !noiseCancel.get()
  setNoiseCancel(nc)
  const g = gains.get()
  const vad = vadThreshold.get()

  if (!isChainActive(g, nc)) {
    stopVoiceProcess()
    execAsync(["rm", "-f", VOICE_CONF]).catch(() => {})
    return
  }

  try { writeFile(VOICE_CONF, buildConfFile(g, nc, vad)) } catch { return }
  startVoiceProcess()
}

function setVadLevel(val: number) {
  const clamped = Math.max(0, Math.min(99, Math.round(val)))
  setVadThreshold(clamped)
  if (!noiseCancel.get()) return
  // Try runtime update for VAD threshold
  execAsync(["bash", "-c",
    `ID=$(wpctl status | grep -oP '\\d+(?=\\. effect_input\\.voice)' | head -1) && [ -n "$ID" ] && pw-cli set-param $ID Props '{ params = [ "rnnoise:VAD Threshold (%)" ${clamped.toFixed(1)} ] }'`
  ])
    .then(() => print(`VOICE: VAD threshold -> ${clamped}%`))
    .catch(() => {})
  // Always persist
  const g = gains.get()
  try { writeFile(VOICE_CONF, buildConfFile(g, true, clamped)) } catch {}
}

function updatePresetDetection() {
  const g = gains.get()
  const match = Object.entries(VOICE_PRESETS).find(([_, p]) => p.gains.every((v, i) => v === g[i]))
  setActivePreset(match ? match[0] : "")
}

function setBandGain(band: number, gain: number) {
  const g = [...gains.get()]
  g[band] = Math.round(gain * 10) / 10
  setGains(g)
  updatePresetDetection()
  reloadVoiceChain()
}

function applyPreset(key: string) {
  const preset = VOICE_PRESETS[key]
  if (!preset) return
  setGains([...preset.gains])
  setActivePreset(key)
  reloadVoiceChain()
}

function gainToSegments(gain: number): number {
  return Math.round(((gain - GAIN_MIN) / GAIN_RANGE) * SEGMENTS)
}
function segmentToGain(seg: number): number {
  return GAIN_MIN + (seg / SEGMENTS) * GAIN_RANGE
}

function makeDraggable(eb: any, onDrag: (y: number, h: number) => void) {
  let dragging = false
  eb.add_events(
    Gdk.EventMask.BUTTON_PRESS_MASK |
    Gdk.EventMask.BUTTON_RELEASE_MASK |
    Gdk.EventMask.POINTER_MOTION_MASK |
    Gdk.EventMask.SCROLL_MASK
  )
  eb.connect("button-press-event", (_w: any, event: any) => {
    dragging = true
    eb.grab_add()
    const [, , y] = event.get_coords()
    onDrag(y, eb.get_allocated_height())
    return true
  })
  eb.connect("button-release-event", () => {
    dragging = false
    eb.grab_remove()
    return true
  })
  eb.connect("motion-notify-event", (_w: any, event: any) => {
    if (!dragging) return false
    const [, , y] = event.get_coords()
    onDrag(y, eb.get_allocated_height())
    return true
  })
}

function VoiceColumn({ bandIndex, label, onSet, disabled }: {
  bandIndex: number, label: string, onSet: (seg: number) => void, disabled?: Accessor<boolean>
}) {
  function calcSeg(y: number, h: number) {
    const seg = SEGMENTS - Math.floor((y / h) * SEGMENTS)
    return Math.max(0, Math.min(SEGMENTS, seg))
  }

  const eb = new Gtk.EventBox({ visible: true })
  makeDraggable(eb, (y, h) => onSet(calcSeg(y, h)))

  const segBox = (
    <box name="eq-segments" vertical>
      {Array(SEGMENTS).fill(0).map((_, i) => (
        <box name="eq-seg" hexpand
          class={gains.as((data: number[]) => {
            const gv = gainToSegments(data[bandIndex])
            const segIdx = SEGMENTS - 1 - i
            if (segIdx >= gv) return "unlit"
            if (segIdx === gv - 1) return "gain-mark"
            return "unlit"
          })}
        />
      ))}
    </box>
  )

  eb.add(segBox)

  return (
    <box name="eq-col" vertical hexpand class={disabled?.as((d) => d ? "disabled" : "") || ""}>
      {eb}
      <label name="eq-label" label={label} />
    </box>
  )
}

// Mic source management via AstalWp
const wp = Wp.get_default()!
const wpAudio = wp.audio

const [micVol, setMicVol] = createState(0)
const [micMuted, setMicMuted] = createState(false)
const [activeMicName, setActiveMicName] = createState("")

let selectedMicId = 0
let initialSyncDone = false

let micListBox: Gtk.Box | null = null
let micDropdownArrow: Gtk.Label | null = null
let micDropdownVisible = false

function isVoiceSrc(s: any): boolean {
  const name = s.name || ""
  const desc = s.description || ""
  return desc === "Voice Processor" || desc === "Noise Canceling source"
    || name === "effect_input.voice" || name === "effect_output.voice"
    || name === "effect_input.rnnoise" || name === "effect_output.rnnoise"
}

function isMonitor(s: any): boolean {
  const name = (s.name || "") as string
  return name.includes("monitor")
}

function getHwMics(): any[] {
  return (wpAudio.get_microphones() as any[]).filter((s: any) => !isVoiceSrc(s) && !isMonitor(s))
}

function micDesc(s: any): string {
  const raw = s.description || s.name || `Source ${s.id}`
  return raw.replace(/^.+\)\s*/, "") || raw
}

function rebuildMicList() {
  if (!micListBox) return
  micListBox.get_children().forEach((c: any) => c.destroy())
  const mics = getHwMics()
  for (const mic of mics) {
    const desc = micDesc(mic)
    const btn = (
      <button name="eq-output-btn" hexpand
        class={mic.id === selectedMicId ? "active" : ""}
        onClicked={() => {
          selectMic(mic.id)
          toggleMicDropdown()
        }}
      >
        <label label={desc} wrap={false} />
      </button>
    ) as Gtk.Widget
    micListBox.add(btn)
  }
  micListBox.show_all()
  const scroll = (micListBox as any)._scrollParent as Gtk.ScrolledWindow | null
  if (scroll) {
    const perItem = s(30)
    const height = Math.min(mics.length * perItem + s(10), s(180))
    scroll.set_min_content_height(height)
    scroll.visible = micDropdownVisible
  }
}

function toggleMicDropdown() {
  if (!micListBox) return
  micDropdownVisible = !micDropdownVisible
  if (micDropdownVisible) rebuildMicList()
  const scroll = (micListBox as any)._scrollParent
  if (scroll) scroll.visible = micDropdownVisible
  if (micDropdownArrow) micDropdownArrow.label = micDropdownVisible ? "" : ""
}

function syncFromMic(mic: any) {
  selectedMicId = mic.id
  setActiveMicName(micDesc(mic))
  execAsync(["wpctl", "get-volume", String(mic.id)])
    .then((out) => {
      const parts = out.trim().split(" ")
      setMicVol(parseFloat(parts[1]) || 0)
      setMicMuted(out.includes("[MUTED]"))
    })
    .catch(() => {
      setMicVol(mic.volume)
      setMicMuted(mic.mute)
    })
}

function selectMic(micId: number) {
  const mics = getHwMics()
  const mic = mics.find((s: any) => s.id === micId)
  if (!mic) return
  syncFromMic(mic)
  execAsync(["wpctl", "set-default", String(micId)]).catch(() => {})
  rebuildMicList()
}

GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
  const mics = getHwMics()
  const def = wpAudio.get_default_microphone()
  const initial = (def && def.id && !isVoiceSrc(def) && !isMonitor(def)) ? def : mics.find((s: any) => s.id)
  if (initial && initial.id) syncFromMic(initial)
  initialSyncDone = true
  rebuildMicList()
  return GLib.SOURCE_REMOVE
})

wpAudio.connect("microphone-added", (_audio: any, mic: any) => {
  if (isVoiceSrc(mic) || isMonitor(mic)) return
  rebuildMicList()
  if (initialSyncDone) selectMic(mic.id)
})
wpAudio.connect("microphone-removed", (_audio: any, mic: any) => {
  if (isVoiceSrc(mic) || isMonitor(mic)) return
  rebuildMicList()
  if (mic.id === selectedMicId) {
    const remaining = getHwMics()
    if (remaining.length > 0) selectMic(remaining[0].id)
  }
})

function setMicVolume(vol: number) {
  if (!selectedMicId) return
  const clamped = Math.max(0, Math.min(1, vol))
  setMicVol(clamped)
  execAsync(["wpctl", "set-volume", String(selectedMicId), String(clamped.toFixed(2))]).catch(() => {})
}

export function toggleMicMute() {
  if (!selectedMicId) return
  setMicMuted(!micMuted.get())
  execAsync(["wpctl", "set-mute", String(selectedMicId), "toggle"]).catch(() => {})
}

export { micMuted }

export default function VoiceControl() {
  createPoll(0, 2000, () => {
    if (!selectedMicId) return 0
    return execAsync(["wpctl", "get-volume", String(selectedMicId)])
      .then((out) => {
        const parts = out.trim().split(" ")
        setMicVol(parseFloat(parts[1]) || 0)
        setMicMuted(out.includes("[MUTED]"))
        return 0
      })
      .catch(() => 0)
  })

  const volSegments = micVol.as((v) => Math.round(v * VOL_SEGMENTS))

  const g = gains.get()
  if (g.some((v) => v !== 0)) reloadVoiceChain()

  return (
    <box name="eq-panel" vertical>
      <box name="control-header" class={micMuted.as((m) => m ? "muted" : "")}>
        <label name="control-label" label="VOICE" />
        {(() => {
          const eb = new Gtk.EventBox({ visible: true, hexpand: true })
          let dragging = false
          eb.add_events(
            Gdk.EventMask.BUTTON_PRESS_MASK |
            Gdk.EventMask.BUTTON_RELEASE_MASK |
            Gdk.EventMask.POINTER_MOTION_MASK |
            Gdk.EventMask.SCROLL_MASK
          )
          eb.connect("button-press-event", (_w: any, event: any) => {
            dragging = true
            eb.grab_add()
            const [, x] = event.get_coords()
            setMicVolume(x / eb.get_allocated_width())
            return true
          })
          eb.connect("button-release-event", () => {
            dragging = false
            eb.grab_remove()
            return true
          })
          eb.connect("motion-notify-event", (_w: any, event: any) => {
            if (!dragging) return false
            const [, x] = event.get_coords()
            setMicVolume(x / eb.get_allocated_width())
            return true
          })
          eb.connect("scroll-event", (_w: any, event: any) => {
            const [hasDir, dir] = event.get_scroll_direction()
            const cur = micVol.get()
            if (hasDir && dir === Gdk.ScrollDirection.UP) setMicVolume(cur + 0.05)
            else if (hasDir && dir === Gdk.ScrollDirection.DOWN) setMicVolume(cur - 0.05)
            else {
              const [, , dy] = event.get_scroll_deltas()
              if (dy < 0) setMicVolume(cur + 0.03)
              else if (dy > 0) setMicVolume(cur - 0.03)
            }
            return true
          })
          eb.add((<box name="eq-hbar-inline" hexpand>
            {Array(VOL_SEGMENTS).fill(0).map((_, i) => (
              <box name="eq-hseg" hexpand
                class={volSegments.as((v) => i < v ? "lit" : "unlit")}
              />
            ))}
          </box>) as Gtk.Widget)
          return eb
        })()}
        <label name="control-value" label={micVol.as((v) => `${Math.round(v * 100)}%`)} />
        <label name="control-muted-label" label={micMuted.as(m => m ? "MUTED" : "")} />
      </box>
      <button name="eq-output-selector" onClicked={() => toggleMicDropdown()}>
        <box>
          <label name="eq-output-icon" label="" />
          <label name="eq-output-name" label={activeMicName.as((n) => n || "No input")} />
          <box hexpand />
          <label name="eq-output-arrow" label="" $={(self: any) => { micDropdownArrow = self }} />
        </box>
      </button>
      {/* Noise cancellation row */}
      <box name="control-header">
        <button name="voice-nc-toggle"
          class={noiseCancel.as((nc) => nc ? "active" : "")}
          onClicked={() => toggleNoiseCancel()}
        >
          <label name="control-label" label="NC" />
        </button>
        {(() => {
          const eb = new Gtk.EventBox({ visible: true, hexpand: true })
          let dragging = false
          eb.add_events(
            Gdk.EventMask.BUTTON_PRESS_MASK |
            Gdk.EventMask.BUTTON_RELEASE_MASK |
            Gdk.EventMask.POINTER_MOTION_MASK |
            Gdk.EventMask.SCROLL_MASK
          )
          const VAD_SEGS = 16
          const vadSegs = vadThreshold.as((v) => Math.round((v / 99) * VAD_SEGS))
          eb.connect("button-press-event", (_w: any, event: any) => {
            dragging = true
            eb.grab_add()
            const [, x] = event.get_coords()
            setVadLevel((x / eb.get_allocated_width()) * 99)
            return true
          })
          eb.connect("button-release-event", () => {
            dragging = false
            eb.grab_remove()
            return true
          })
          eb.connect("motion-notify-event", (_w: any, event: any) => {
            if (!dragging) return false
            const [, x] = event.get_coords()
            setVadLevel((x / eb.get_allocated_width()) * 99)
            return true
          })
          eb.connect("scroll-event", (_w: any, event: any) => {
            const cur = vadThreshold.get()
            const [hasDir, dir] = event.get_scroll_direction()
            if (hasDir && dir === Gdk.ScrollDirection.UP) setVadLevel(cur + 5)
            else if (hasDir && dir === Gdk.ScrollDirection.DOWN) setVadLevel(cur - 5)
            else {
              const [, , dy] = event.get_scroll_deltas()
              if (dy < 0) setVadLevel(cur + 3)
              else if (dy > 0) setVadLevel(cur - 3)
            }
            return true
          })
          eb.add((<box name="eq-hbar-inline" hexpand
            class={noiseCancel.as((nc) => nc ? "" : "disabled")}
          >
            {Array(VAD_SEGS).fill(0).map((_, i) => (
              <box name="eq-hseg" hexpand
                class={vadSegs.as((v) => i < v ? "lit" : "unlit")}
              />
            ))}
          </box>) as Gtk.Widget)
          return eb
        })()}
        <label name="control-value" label={vadThreshold.as((v) => `${v}%`)} />
      </box>
      {(() => {
        const overlay = new Gtk.Overlay({ visible: true })
        const columns = (
          <box name="eq-columns" homogeneous>
            {VOICE_BANDS.map((band, i) => (
              <VoiceColumn
                bandIndex={i}
                label={band.label}
                onSet={(seg) => setBandGain(i, segmentToGain(seg))}
                disabled={voiceAvailable.as((a) => !a)}
              />
            ))}
          </box>
        ) as Gtk.Widget
        overlay.add(columns)

        const listBox = (<box name="eq-output-list" vertical homogeneous />) as Gtk.Box
        micListBox = listBox

        const scroll = new Gtk.ScrolledWindow({
          visible: false,
          hscrollbar_policy: Gtk.PolicyType.NEVER,
          vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
          valign: Gtk.Align.START,
          hexpand: true,
        })
        scroll.set_name("eq-output-scroll")
        scroll.add(listBox)
        overlay.add_overlay(scroll)

        ;(micListBox as any)._scrollParent = scroll

        return overlay
      })()}
      <box name="eq-presets">
        {Object.entries(VOICE_PRESETS).map(([key, preset]) => (
          <button name="eq-preset-btn" hexpand
            class={activePreset.as((a) => a === key ? "active" : "")}
            onClicked={() => applyPreset(key)}
          >
            <label name="eq-preset-label" label={preset.label} />
          </button>
        ))}
      </box>
    </box>
  )
}

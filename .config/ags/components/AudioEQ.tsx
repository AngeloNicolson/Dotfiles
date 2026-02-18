import { createState } from "ags"
import { createPoll } from "ags/time"
import { type Accessor } from "gnim"
import { execAsync } from "ags/process"
import { writeFile, readFile } from "ags/file"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk"
import Gtk from "gi://Gtk"

const EQ_BANDS = [
  { label: "100", type: "bq_lowshelf", freq: 100 },
  { label: "250", type: "bq_peaking", freq: 250 },
  { label: "1K", type: "bq_peaking", freq: 1000 },
  { label: "2K", type: "bq_peaking", freq: 2000 },
  { label: "5K", type: "bq_peaking", freq: 5000 },
  { label: "10K", type: "bq_highshelf", freq: 10000 },
]

const EQ_PRESETS: Record<string, { label: string, gains: number[] }> = {
  flat:   { label: "FLAT", gains: [0, 0, 0, 0, 0, 0] },
  bass:   { label: "BASS", gains: [6, 4, 0, 0, 0, 0] },
  vocal:  { label: "VOCL", gains: [-2, 0, 3, 4, 2, 0] },
  bright: { label: "BRIT", gains: [0, 0, 0, 2, 4, 6] },
}

const SEGMENTS = 20
const VOL_SEGMENTS = 16
const GAIN_MIN = -12
const GAIN_MAX = 12
const GAIN_RANGE = GAIN_MAX - GAIN_MIN

const CONF_DIR = GLib.get_home_dir() + "/.config/pipewire/filter-chain.conf.d"
const CONF_PATH = CONF_DIR + "/sink-eq6.conf"

const [gains, setGains] = createState<number[]>([0, 0, 0, 0, 0, 0])
const [eqAvailable, setEqAvailable] = createState(true)
const [activePreset, setActivePreset] = createState("flat")

let reloadTimer: number | null = null

// Load saved gains
try {
  const saved = readFile(CONF_PATH)
  if (saved) {
    const match = saved.match(/# gains: (.+)/)
    if (match) {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed) && parsed.length === 6) {
        setGains(parsed)
        const presetMatch = Object.entries(EQ_PRESETS).find(([_, p]) =>
          p.gains.every((g, i) => g === parsed[i])
        )
        if (presetMatch) setActivePreset(presetMatch[0])
        else setActivePreset("")
      }
    }
  }
} catch {}

function buildConfFile(g: number[]): string {
  const nodes = EQ_BANDS.map((band, i) =>
    `                    { type = builtin name = eq_band_${i} label = ${band.type} control = { "Freq" = ${band.freq}.0 "Q" = 1.0 "Gain" = ${g[i].toFixed(1)} } }`
  ).join("\n")
  const links = EQ_BANDS.slice(0, -1).map((_, i) =>
    `                    { output = "eq_band_${i}:Out" input = "eq_band_${i + 1}:In" }`
  ).join("\n")

  return `# gains: ${JSON.stringify(g)}
context.modules = [
    { name = libpipewire-module-filter-chain
        args = {
            node.description = "Equalizer Sink"
            media.name       = "Equalizer Sink"
            filter.graph = {
                nodes = [
${nodes}
                ]
                links = [
${links}
                ]
            }
            audio.channels = 2
            audio.position = [ FL FR ]
            capture.props = { node.name = "effect_input.eq6" media.class = Audio/Sink }
            playback.props = { node.name = "effect_output.eq6" node.passive = true }
        }
    }
]
`
}

function setEqAsDefault() {
  execAsync(["pw-metadata", "0", "default.audio.sink", '{ "name": "effect_input.eq6" }', "Spa:String:JSON"])
    .then(() => {
      print("EQ: set as default sink via pw-metadata")
      setEqAvailable(true)
      // Ensure EQ sink volume stays at 100% so it doesn't attenuate audio
      execAsync(["bash", "-c", "wpctl status | grep -oP '\\d+(?=\\. effect_input\\.eq6)' | head -1"])
        .then((id) => { if (id.trim()) execAsync(["wpctl", "set-volume", id.trim(), "1.0"]).catch(() => {}) })
        .catch(() => {})
    })
    .catch((e) => print(`EQ: pw-metadata failed: ${e}`))
}

function clearEqDefault() {
  execAsync(["pw-metadata", "0", "default.audio.sink", "", ""])
    .catch(() => {})
}

function reloadFilterChain() {
  if (reloadTimer) GLib.source_remove(reloadTimer)
  reloadTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
    reloadTimer = null
    const g = gains.get()
    try { writeFile(CONF_PATH, buildConfFile(g)) } catch { setEqAvailable(false); return GLib.SOURCE_REMOVE }
    // Kill old filter chain
    clearEqDefault()
    execAsync(["pkill", "-f", "pipewire -c filter-chain.conf"]).catch(() => {})
    if (g.every((v) => v === 0)) { print("EQ: flat, filter chain stopped"); return GLib.SOURCE_REMOVE }
    // Wait for old to die, then start new
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      print("EQ: starting filter chain...")
      try {
        GLib.spawn_command_line_async("pipewire -c filter-chain.conf")
      } catch (e) { print(`EQ: failed to start: ${e}`); setEqAvailable(false); return GLib.SOURCE_REMOVE }
      // Wait for sink to appear, then route audio through it
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
        setEqAsDefault()
        return GLib.SOURCE_REMOVE
      })
      return GLib.SOURCE_REMOVE
    })
    return GLib.SOURCE_REMOVE
  })
}

function updatePresetDetection() {
  const g = gains.get()
  const match = Object.entries(EQ_PRESETS).find(([_, p]) => p.gains.every((v, i) => v === g[i]))
  setActivePreset(match ? match[0] : "")
}

function setBandGain(band: number, gain: number) {
  const g = [...gains.get()]
  g[band] = Math.round(gain * 10) / 10
  setGains(g)
  updatePresetDetection()
  reloadFilterChain()
}

function applyPreset(key: string) {
  const preset = EQ_PRESETS[key]
  if (!preset) return
  setGains([...preset.gains])
  setActivePreset(key)
  reloadFilterChain()
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

function EQColumn({ value, label, onSet, disabled }: {
  value: Accessor<number>, label: string, onSet: (seg: number) => void, disabled?: Accessor<boolean>
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
          class={value.as((v) => {
            const segIdx = SEGMENTS - 1 - i
            if (v > 0 && segIdx === v - 1) return "peak"
            return segIdx < v ? "lit" : "unlit"
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

// Capture hardware sink ID at startup (before EQ changes default)
let hwSinkId = ""
execAsync(["bash", "-c", "wpctl status | grep -oP '\\d+(?=\\..+Headphones)' | head -1"])
  .then((id) => {
    hwSinkId = id.trim()
    if (hwSinkId) {
      execAsync(["wpctl", "get-volume", hwSinkId])
        .then((out) => {
          const parts = out.trim().split(" ")
          setLocalVol(parseFloat(parts[1]) || 0)
          setLocalMuted(out.includes("[MUTED]"))
        })
        .catch(() => {})
    }
  })
  .catch(() => {})

const [localVol, setLocalVol] = createState(0)
const [localMuted, setLocalMuted] = createState(false)

function setHwVolume(vol: number) {
  if (!hwSinkId) return
  const clamped = Math.max(0, Math.min(1, vol))
  setLocalVol(clamped)
  execAsync(["wpctl", "set-volume", hwSinkId, String(clamped.toFixed(2))]).catch(() => {})
}
function toggleHwMute() {
  if (!hwSinkId) return
  execAsync(["wpctl", "set-mute", hwSinkId, "toggle"]).catch(() => {})
}

export default function AudioEQ() {
  // Poll hardware sink volume, sync into local state for instant display
  createPoll(0, 1000, () => {
    if (!hwSinkId) return 0
    return execAsync(["wpctl", "get-volume", hwSinkId])
      .then((out) => {
        const parts = out.trim().split(" ")
        const vol = parseFloat(parts[1]) || 0
        const muted = out.includes("[MUTED]")
        setLocalVol(vol)
        setLocalMuted(muted)
        return 0
      })
      .catch(() => 0)
  })

  const volSegments = localVol.as((v) => Math.round(v * VOL_SEGMENTS))
  const bandSegments = gains.as((g) => g.map(gainToSegments))

  const g = gains.get()
  if (g.some((v) => v !== 0)) reloadFilterChain()

  return (
    <box name="eq-panel" vertical>
      <box name="control-header">
        <button name="control-icon-btn" onClicked={() => toggleHwMute()}>
          <label name="control-icon" label={localMuted.as((m) => m ? "" : "")} />
        </button>
        <label name="control-label" label="AUDIO" />
        <box hexpand />
        <label name="control-value" label={localVol.as((v) => `${Math.round(v * 100)}%`)} />
      </box>
      <box name="eq-columns" homogeneous>
        {EQ_BANDS.map((band, i) => (
          <EQColumn
            value={bandSegments.as((segs) => segs[i])}
            label={band.label}
            onSet={(seg) => setBandGain(i, segmentToGain(seg))}
            disabled={eqAvailable.as((a) => !a)}
          />
        ))}
      </box>
      {(() => {
        const hbarEb = new Gtk.EventBox({ visible: true })
        let dragging = false
        let lastY = 0
        hbarEb.add_events(
          Gdk.EventMask.BUTTON_PRESS_MASK |
          Gdk.EventMask.BUTTON_RELEASE_MASK |
          Gdk.EventMask.POINTER_MOTION_MASK |
          Gdk.EventMask.SCROLL_MASK
        )
        hbarEb.connect("button-press-event", (_w: any, event: any) => {
          dragging = true
          hbarEb.grab_add()
          const [, x, y] = event.get_coords()
          lastY = y
          const w = hbarEb.get_allocated_width()
          setHwVolume(x / w)
          return true
        })
        hbarEb.connect("button-release-event", () => {
          dragging = false
          hbarEb.grab_remove()
          return true
        })
        hbarEb.connect("motion-notify-event", (_w: any, event: any) => {
          if (!dragging) return false
          const [, x, y] = event.get_coords()
          const w = hbarEb.get_allocated_width()
          const h = hbarEb.get_allocated_height()
          const dy = lastY - y
          lastY = y
          if (Math.abs(dy) > 1) {
            const cur = localVol.get()
            setHwVolume(cur + dy / (h * 3))
          } else {
            setHwVolume(x / w)
          }
          return true
        })
        hbarEb.connect("scroll-event", (_w: any, event: any) => {
          const dir = event.get_scroll_direction()[1]
          const cur = localVol.get()
          if (dir === Gdk.ScrollDirection.UP) setHwVolume(cur + 0.05)
          else if (dir === Gdk.ScrollDirection.DOWN) setHwVolume(cur - 0.05)
          return true
        })
        const hbar = (
          <box name="eq-hbar">
            {Array(VOL_SEGMENTS).fill(0).map((_, i) => (
              <box name="eq-hseg" hexpand
                class={volSegments.as((v) => i < v ? "lit" : "unlit")}
              />
            ))}
          </box>
        )
        hbarEb.add(hbar)
        return hbarEb
      })()}
      <box name="eq-presets">
        {Object.entries(EQ_PRESETS).map(([key, preset]) => (
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

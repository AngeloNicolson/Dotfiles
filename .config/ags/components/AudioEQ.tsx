import { createState } from "ags"
import { createPoll } from "ags/time"
import { type Accessor } from "gnim"
import { execAsync, createSubprocess } from "ags/process"
import { writeFile, readFile } from "ags/file"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk"
import Gtk from "gi://Gtk"
import Wp from "gi://AstalWp"

const EQ_BANDS = [
  { label: "60", type: "bq_lowshelf", freq: 60 },
  { label: "100", type: "bq_peaking", freq: 100 },
  { label: "250", type: "bq_peaking", freq: 250 },
  { label: "1K", type: "bq_peaking", freq: 1000 },
  { label: "2K", type: "bq_peaking", freq: 2000 },
  { label: "5K", type: "bq_peaking", freq: 5000 },
  { label: "10K", type: "bq_highshelf", freq: 10000 },
]

const NUM_BANDS = EQ_BANDS.length

const EQ_PRESETS: Record<string, { label: string, gains: number[] }> = {
  flat:   { label: "FLAT", gains: [0, 0, 0, 0, 0, 0, 0] },
  bass:   { label: "BASS", gains: [8, 6, 4, 0, 0, 0, 0] },
  vocal:  { label: "VOCL", gains: [-2, -2, 0, 3, 4, 2, 0] },
  bright: { label: "BRIT", gains: [0, 0, 0, 0, 2, 4, 6] },
}

const SEGMENTS = 20
const VOL_SEGMENTS = 16
const GAIN_MIN = -12
const GAIN_MAX = 12
const GAIN_RANGE = GAIN_MAX - GAIN_MIN

const CONF_DIR = GLib.get_home_dir() + "/.config/pipewire/filter-chain.conf.d"
const CONF_PATH = CONF_DIR + "/sink-eq7.conf"

const [gains, setGains] = createState<number[]>(new Array(NUM_BANDS).fill(0))
const [eqAvailable, setEqAvailable] = createState(true)
const [activePreset, setActivePreset] = createState("flat")

let reloadTimer: number | null = null

// Cava visualizer — 6 bars matching EQ bands, raw ASCII output
const CAVA_CONF_PATH = "/tmp/ags-cava.conf"
const CAVA_BARS = NUM_BANDS % 2 === 0 ? NUM_BANDS : NUM_BANDS + 1
try {
  writeFile(CAVA_CONF_PATH, `[general]
bars = ${CAVA_BARS}
framerate = 24

[output]
method = raw
raw_target = /dev/stdout
data_format = ascii
ascii_max_range = ${SEGMENTS}
`)
} catch {}

const ZERO_LEVELS = new Array(NUM_BANDS).fill(0)
let cavaLevels: ReturnType<typeof createSubprocess<number[]>> | null = null
try {
  cavaLevels = createSubprocess(
    ZERO_LEVELS,
    ["cava", "-p", CAVA_CONF_PATH],
    (line) => {
      const vals = line.split(";").filter(s => s.length > 0).map(Number)
      return vals.length >= NUM_BANDS ? vals.slice(0, NUM_BANDS) : ZERO_LEVELS
    },
  )
} catch {
  cavaLevels = null
}

// Load saved gains
try {
  const saved = readFile(CONF_PATH)
  if (saved) {
    const match = saved.match(/# gains: (.+)/)
    if (match) {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed) && parsed.length === NUM_BANDS) {
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
            playback.props = {
                node.name = "effect_output.eq6"
                node.passive = true
${selectedSinkNodeName ? `                target.object = "${selectedSinkNodeName}"` : ""}
            }
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

function updateGainsRuntime(g: number[]) {
  const params = g.map((gain, i) => `"eq_band_${i}:Gain" ${gain.toFixed(1)}`).join(" ")
  return execAsync(["bash", "-c",
    `ID=$(wpctl status | grep -oP '\\d+(?=\\. effect_input\\.eq6)' | head -1) && [ -n "$ID" ] && pw-cli set-param $ID Props "{ params = [ ${params} ] }"`
  ])
}

function waitForEqNode(retries: number, delay: number): Promise<void> {
  return execAsync(["bash", "-c", "wpctl status | grep -q 'effect_input.eq6'"])
    .catch(() => {
      if (retries <= 0) return Promise.reject("EQ node never appeared")
      return new Promise((resolve) =>
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => { resolve(undefined); return GLib.SOURCE_REMOVE })
      ).then(() => waitForEqNode(retries - 1, delay))
    })
}

function startFilterChain(g: number[]) {
  clearEqDefault()
  execAsync(["pkill", "-f", "pipewire -c filter-chain.conf"]).catch(() => {})
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
    print("EQ: starting filter chain...")
    try {
      GLib.spawn_command_line_async("pipewire -c filter-chain.conf")
    } catch (e) { print(`EQ: failed to start: ${e}`); setEqAvailable(false); return GLib.SOURCE_REMOVE }
    // Poll until the node actually appears, then set as default
    waitForEqNode(10, 300)
      .then(() => setEqAsDefault())
      .catch((e) => { print(`EQ: gave up waiting for node: ${e}`); setEqAvailable(false) })
    return GLib.SOURCE_REMOVE
  })
}

function reloadFilterChain() {
  if (reloadTimer) GLib.source_remove(reloadTimer)
  reloadTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
    reloadTimer = null
    const g = gains.get()
    try { writeFile(CONF_PATH, buildConfFile(g)) } catch { setEqAvailable(false); return GLib.SOURCE_REMOVE }

    if (g.every((v) => v === 0)) {
      clearEqDefault()
      execAsync(["pkill", "-f", "pipewire -c filter-chain.conf"]).catch(() => {})
      print("EQ: flat, filter chain stopped")
      return GLib.SOURCE_REMOVE
    }

    // Try runtime update first (no audio interruption)
    updateGainsRuntime(g)
      .then(() => print("EQ: updated gains at runtime"))
      .catch(() => {
        // Filter chain not running — full restart needed
        print("EQ: runtime update failed, starting filter chain")
        startFilterChain(g)
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

function EQColumn({ bandIndex, label, onSet, disabled }: {
  bandIndex: number, label: string, onSet: (seg: number) => void, disabled?: Accessor<boolean>
}) {
  function calcSeg(y: number, h: number) {
    const seg = SEGMENTS - Math.floor((y / h) * SEGMENTS)
    return Math.max(0, Math.min(SEGMENTS, seg))
  }

  const eb = new Gtk.EventBox({ visible: true })
  makeDraggable(eb, (y, h) => onSet(calcSeg(y, h)))

  // Use cava audio levels if available, otherwise fall back to static gain display
  const driver = cavaLevels ?? gains

  // Peak hold state for this column
  let peakLevel = 0
  let peakHoldTimer = 0
  let peakUpdatedFrame = 0

  const segBox = (
    <box name="eq-segments" vertical>
      {Array(SEGMENTS).fill(0).map((_, i) => (
        <box name="eq-seg" hexpand
          class={driver.as((data: any) => {
            const gv = gainToSegments(gains.get()[bandIndex])
            const al = cavaLevels ? (data as number[])[bandIndex] : 0
            const segIdx = SEGMENTS - 1 - i

            // Scale audio to fit within gain ceiling (one below gain marker)
            const maxFill = Math.max(0, gv - 1)
            const audioFill = maxFill > 0 && al > 0
              ? Math.round((al / SEGMENTS) * maxFill)
              : 0

            // Update peak hold once per frame (use i===0 as trigger)
            const frame = Date.now()
            if (i === 0 && frame !== peakUpdatedFrame) {
              peakUpdatedFrame = frame
              if (audioFill >= peakLevel) {
                peakLevel = audioFill
                peakHoldTimer = 48  // hold ~2 seconds at 24fps
              } else if (peakHoldTimer > 0) {
                peakHoldTimer--
              } else {
                peakLevel = Math.max(1, Math.max(audioFill, peakLevel - 0.6))
              }
            }
            const peakSeg = Math.max(Math.round(peakLevel), audioFill)

            if (segIdx >= gv) return "unlit"
            // Peak hold — red, overrides gain marker
            if (peakSeg > 0 && segIdx === peakSeg - 1) return "peak"
            // Gain setting — white marker
            if (segIdx === gv - 1) return "gain-mark"
            // Audio fill — bounces with music
            if (segIdx < audioFill) {
              const ratio = segIdx / (gv || 1)
              if (ratio < 0.25) return "lit-hi"
              if (ratio < 0.5) return "lit-mid"
              if (ratio < 0.75) return "lit-lo"
              return "lit-dim"
            }
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

// Use AstalWp to manage audio sinks
const wp = Wp.get_default()!
const wpAudio = wp.audio

const [localVol, setLocalVol] = createState(0)
const [localMuted, setLocalMuted] = createState(false)
const [activeSinkName, setActiveSinkName] = createState("")

// Track selected hw sink by ID and node.name (not the EQ sink)
let selectedSinkId = 0
let selectedSinkNodeName = ""
// Known sink IDs — used to detect newly plugged devices
let knownSinkIds = new Set<number>()
let initialSyncDone = false

function isEqSink(s: any): boolean {
  return s.description === "Equalizer Sink" || s.name === "effect_input.eq6" || s.name === "effect_output.eq6"
}

function getHwSpeakers(): any[] {
  return (wpAudio.get_speakers() as any[]).filter((s: any) => !isEqSink(s))
}

function sinkDesc(s: any): string {
  const raw = s.description || s.name || `Sink ${s.id}`
  // Strip common device prefix — e.g. "800 Series ACE (Audio Context Engine) Headphones" → "Headphones"
  return raw.replace(/^.+\)\s*/, "") || raw
}

// Inline dropdown for output device selection
let outputListBox: Gtk.Box | null = null
let dropdownArrow: Gtk.Label | null = null
let dropdownVisible = false

function rebuildOutputList() {
  if (!outputListBox) return
  outputListBox.get_children().forEach((c: any) => c.destroy())
  const speakers = getHwSpeakers()
  for (const sink of speakers) {
    const desc = sinkDesc(sink)
    const btn = (
      <button name="eq-output-btn" hexpand
        class={sink.id === selectedSinkId ? "active" : ""}
        onClicked={() => {
          selectSink(sink.id)
          toggleDropdown()
        }}
      >
        <label label={desc} wrap={false} />
      </button>
    ) as Gtk.Widget
    outputListBox.add(btn)
  }
  outputListBox.show_all()
}

let dropdownRevealer: Gtk.Revealer | null = null

function toggleDropdown() {
  if (!outputListBox) return
  dropdownVisible = !dropdownVisible
  if (dropdownVisible) rebuildOutputList()
  if (dropdownRevealer) dropdownRevealer.reveal_child = dropdownVisible
  if (dropdownArrow) dropdownArrow.label = dropdownVisible ? "" : ""
}

function syncFromSink(sink: any) {
  selectedSinkId = sink.id
  setActiveSinkName(sinkDesc(sink))
  // Resolve node.name for filter chain targeting
  execAsync(["bash", "-c", `wpctl inspect ${sink.id} | grep -oP '(?<=node\\.name = ").*(?=")'`])
    .then((name) => { selectedSinkNodeName = name.trim() })
    .catch(() => { selectedSinkNodeName = "" })
  // Query wpctl for accurate volume/mute (AstalWp properties can be stale at startup)
  execAsync(["wpctl", "get-volume", String(sink.id)])
    .then((out) => {
      const parts = out.trim().split(" ")
      setLocalVol(parseFloat(parts[1]) || 0)
      setLocalMuted(out.includes("[MUTED]"))
    })
    .catch(() => {
      setLocalVol(sink.volume)
      setLocalMuted(sink.mute)
    })
}

function selectSink(sinkId: number) {
  const speakers = getHwSpeakers()
  const sink = speakers.find((s: any) => s.id === sinkId)
  if (!sink) return
  syncFromSink(sink)
  // Resolve node.name first, then set default and restart filter chain
  execAsync(["bash", "-c", `wpctl inspect ${sinkId} | grep -oP '(?<=node\\.name = ").*(?=")'`])
    .then((name) => {
      selectedSinkNodeName = name.trim()
      execAsync(["wpctl", "set-default", String(sinkId)]).catch(() => {})
      if (gains.get().some((v) => v !== 0)) {
        // Rewrite config with new target and restart
        try { writeFile(CONF_PATH, buildConfFile(gains.get())) } catch {}
        startFilterChain(gains.get())
      }
    })
    .catch(() => {
      execAsync(["wpctl", "set-default", String(sinkId)]).catch(() => {})
    })
  rebuildOutputList()
}

// Initial sync — delayed to let WirePlumber finish enumerating
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
  const speakers = getHwSpeakers()
  knownSinkIds = new Set(speakers.map((s: any) => s.id))
  const def = wpAudio.get_default_speaker()
  const initial = (def && def.id && !isEqSink(def)) ? def : speakers.find((s: any) => s.id)
  if (initial && initial.id) {
    syncFromSink(initial)
  }
  initialSyncDone = true
  rebuildOutputList()
  return GLib.SOURCE_REMOVE
})

// Auto-switch on hot-plug only (not during initial enumeration)
wpAudio.connect("speaker-added", (_audio: any, speaker: any) => {
  if (isEqSink(speaker)) return
  knownSinkIds.add(speaker.id)
  rebuildOutputList()
  if (initialSyncDone) selectSink(speaker.id)
})
wpAudio.connect("speaker-removed", (_audio: any, speaker: any) => {
  if (isEqSink(speaker)) return
  knownSinkIds.delete(speaker.id)
  rebuildOutputList()
  // Fall back if our selected sink was removed
  if (speaker.id === selectedSinkId) {
    const remaining = getHwSpeakers()
    if (remaining.length > 0) selectSink(remaining[0].id)
  }
})

function setHwVolume(vol: number) {
  if (!selectedSinkId) return
  const clamped = Math.max(0, Math.min(1, vol))
  setLocalVol(clamped)
  execAsync(["wpctl", "set-volume", String(selectedSinkId), String(clamped.toFixed(2))]).catch(() => {})
}
export function toggleHwMute() {
  if (!selectedSinkId) return
  setLocalMuted(!localMuted.get())
  execAsync(["wpctl", "set-mute", String(selectedSinkId), "toggle"]).catch(() => {})
}

export { localMuted }

export default function AudioEQ() {
  // Poll hardware sink volume, sync into local state for instant display
  createPoll(0, 2000, () => {
    if (!selectedSinkId) return 0
    return execAsync(["wpctl", "get-volume", String(selectedSinkId)])
      .then((out) => {
        const parts = out.trim().split(" ")
        setLocalVol(parseFloat(parts[1]) || 0)
        setLocalMuted(out.includes("[MUTED]"))
        return 0
      })
      .catch(() => 0)
  })

  const volSegments = localVol.as((v) => Math.round(v * VOL_SEGMENTS))

  const g = gains.get()
  if (g.some((v) => v !== 0)) reloadFilterChain()

  // Health check: kill orphaned filter-chains that aren't routing audio
  createPoll(0, 15000, () => {
    if (gains.get().every((v) => v === 0)) return 0
    return execAsync(["bash", "-c", "pw-cli ls Node 2>/dev/null | grep -c 'effect_input.eq6'"])
      .then((count) => {
        const n = parseInt(count.trim()) || 0
        if (n > 1) {
          print(`EQ: detected ${n} filter-chain nodes, cleaning up`)
          execAsync(["pkill", "-f", "pipewire -c filter-chain.conf"]).catch(() => {})
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { startFilterChain(gains.get()); return GLib.SOURCE_REMOVE })
        }
        return 0
      })
      .catch(() => 0)
  })

  return (
    <box name="eq-panel" vertical>
      <box name="control-header" class={localMuted.as((m) => m ? "muted" : "")}>
        <label name="control-label" label="AUDIO" />
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
            setHwVolume(x / eb.get_allocated_width())
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
            setHwVolume(x / eb.get_allocated_width())
            return true
          })
          eb.connect("scroll-event", (_w: any, event: any) => {
            const [hasDir, dir] = event.get_scroll_direction()
            const cur = localVol.get()
            if (hasDir && dir === Gdk.ScrollDirection.UP) setHwVolume(cur + 0.05)
            else if (hasDir && dir === Gdk.ScrollDirection.DOWN) setHwVolume(cur - 0.05)
            else {
              const [, , dy] = event.get_scroll_deltas()
              if (dy < 0) setHwVolume(cur + 0.03)
              else if (dy > 0) setHwVolume(cur - 0.03)
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
        <label name="control-value" label={localVol.as((v) => `${Math.round(v * 100)}%`)} />
        <label name="control-muted-label" label={localMuted.as(m => m ? "MUTED" : "")} />
      </box>
      <button name="eq-output-selector" onClicked={() => toggleDropdown()}>
        <box>
          <label name="eq-output-icon" label="" />
          <label name="eq-output-name" label={activeSinkName.as((n) => n || "No output")} />
          <box hexpand />
          <label name="eq-output-arrow" label="" $={(self: any) => { dropdownArrow = self }} />
        </box>
      </button>
      {(() => {
        const overlay = new Gtk.Overlay({ visible: true })

        const columns = (
          <box name="eq-columns" homogeneous>
            {EQ_BANDS.map((band, i) => (
              <EQColumn
                bandIndex={i}
                label={band.label}
                onSet={(seg) => setBandGain(i, segmentToGain(seg))}
                disabled={eqAvailable.as((a) => !a)}
              />
            ))}
          </box>
        ) as Gtk.Widget
        overlay.add(columns)

        const listBox = (<box name="eq-output-list" vertical />) as Gtk.Box
        outputListBox = listBox

        const scroll = new Gtk.ScrolledWindow({
          visible: true,
          hscrollbar_policy: Gtk.PolicyType.NEVER,
          vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
          valign: Gtk.Align.START,
          halign: Gtk.Align.FILL,
          hexpand: true,
          propagate_natural_height: true,
        })
        scroll.set_name("eq-output-scroll")
        scroll.set_max_content_height(300)
        scroll.add(listBox)

        const revealer = new Gtk.Revealer({
          visible: true,
          reveal_child: false,
          transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
          transition_duration: 150,
          valign: Gtk.Align.START,
          hexpand: true,
        })
        revealer.add(scroll)
        dropdownRevealer = revealer
        overlay.add_overlay(revealer)

        return overlay
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

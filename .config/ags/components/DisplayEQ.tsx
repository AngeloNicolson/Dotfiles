import { createState } from "ags"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { writeFile, readFile } from "ags/file"
import { type Accessor } from "gnim"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk"
import Gtk from "gi://Gtk"

const SEGMENTS = 20
const BRI_SEGMENTS = 16
const TEMP_MIN = 2500
const TEMP_MAX = 6500
const TEMP_RANGE = TEMP_MAX - TEMP_MIN
const GAMMA_MIN = 0.5
const GAMMA_MAX = 1.5
const GAMMA_RANGE = GAMMA_MAX - GAMMA_MIN
const RGB_MIN = 0.5
const RGB_MAX = 1.0
const RGB_RANGE = RGB_MAX - RGB_MIN

const CONF_PATH = GLib.get_home_dir() + "/.config/ags/display-eq.json"
const SHADER_PATH = GLib.get_home_dir() + "/.config/hypr/shaders/rgb-tint.glsl"

const COLOR_PROFILES: Record<string, { label: string, temp: number, gamma: number, rgb: [number, number, number] }> = {
  default: { label: "DEF",  temp: 6500, gamma: 1.0, rgb: [1.0, 1.0, 1.0] },
  warm:    { label: "WARM", temp: 4500, gamma: 1.0, rgb: [1.0, 1.0, 1.0] },
  night:   { label: "NITE", temp: 3500, gamma: 0.9, rgb: [1.0, 0.9, 0.8] },
  vivid:   { label: "VIVD", temp: 6500, gamma: 1.2, rgb: [1.0, 1.0, 1.0] },
}

const [relayAvailable, setRelayAvailable] = createState(false)
const [temperature, setTemperature] = createState(6500)
const [gamma, setGamma] = createState(1.0)
const [rgbR, setRgbR] = createState(1.0)
const [rgbG, setRgbG] = createState(1.0)
const [rgbB, setRgbB] = createState(1.0)
const [activeProfile, setActiveProfile] = createState("default")

// Load saved settings
try {
  const saved = readFile(CONF_PATH)
  if (saved) {
    const parsed = JSON.parse(saved)
    if (parsed.temperature) setTemperature(parsed.temperature)
    if (parsed.gamma) setGamma(parsed.gamma)
    if (parsed.profile) setActiveProfile(parsed.profile)
    if (parsed.rgb) {
      setRgbR(parsed.rgb[0] ?? 1.0)
      setRgbG(parsed.rgb[1] ?? 1.0)
      setRgbB(parsed.rgb[2] ?? 1.0)
    }
  }
} catch {}

function ensureRelay() {
  execAsync(["busctl", "--user", "status", "rs.wl-gammarelay"])
    .then(() => {
      setRelayAvailable(true)
      const temp = temperature.get()
      const gam = gamma.get()
      if (temp !== 6500) applyTemp(temp)
      if (gam !== 1.0) applyGamma(gam)
    })
    .catch(() => {
      execAsync(["which", "wl-gammarelay-rs"])
        .then(() => {
          execAsync(["bash", "-c", "wl-gammarelay-rs &"]).catch(() => {})
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            execAsync(["busctl", "--user", "status", "rs.wl-gammarelay"])
              .then(() => {
                setRelayAvailable(true)
                const temp = temperature.get()
                const gam = gamma.get()
                if (temp !== 6500) applyTemp(temp)
                if (gam !== 1.0) applyGamma(gam)
              })
              .catch(() => setRelayAvailable(false))
            return GLib.SOURCE_REMOVE
          })
        })
        .catch(() => setRelayAvailable(false))
    })
}
ensureRelay()

// Apply saved RGB on startup
{
  const r = rgbR.get(), g = rgbG.get(), b = rgbB.get()
  if (r < 0.99 || g < 0.99 || b < 0.99) applyRgbShader(r, g, b)
}

function applyTemp(kelvin: number) {
  execAsync(["busctl", "--user", "set-property", "rs.wl-gammarelay", "/", "rs.wl.gammarelay", "Temperature", "q", String(Math.round(kelvin))]).catch(() => {})
}
function applyGamma(value: number) {
  execAsync(["busctl", "--user", "set-property", "rs.wl-gammarelay", "/", "rs.wl.gammarelay", "Gamma", "d", String(value.toFixed(2))]).catch(() => {})
}
function applyRgbShader(r: number, g: number, b: number) {
  if (r >= 0.99 && g >= 0.99 && b >= 0.99) {
    execAsync(["hyprshade", "off"]).catch(() => {})
    return
  }
  const shader = `#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D tex;
out vec4 fragColor;

const vec3 RGB_TINT = vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)});

void main() {
    vec4 c = texture(tex, v_texcoord);
    c.rgb *= RGB_TINT;
    fragColor = c;
}
`
  try {
    writeFile(SHADER_PATH, shader)
    execAsync(["hyprshade", "on", SHADER_PATH]).catch(() => {})
  } catch {}
}

let persistTimer: number | null = null
function persistSettings() {
  if (persistTimer) GLib.source_remove(persistTimer)
  persistTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    persistTimer = null
    try {
      writeFile(CONF_PATH, JSON.stringify({
        temperature: temperature.get(),
        gamma: gamma.get(),
        rgb: [rgbR.get(), rgbG.get(), rgbB.get()],
        profile: activeProfile.get(),
      }))
    } catch {}
    return GLib.SOURCE_REMOVE
  })
}

function detectProfile() {
  const t = temperature.get(), g = gamma.get()
  const r = rgbR.get(), gv = rgbG.get(), b = rgbB.get()
  const match = Object.entries(COLOR_PROFILES).find(([_, p]) =>
    Math.abs(p.temp - t) < 50 && Math.abs(p.gamma - g) < 0.05 &&
    Math.abs(p.rgb[0] - r) < 0.03 && Math.abs(p.rgb[1] - gv) < 0.03 && Math.abs(p.rgb[2] - b) < 0.03
  )
  setActiveProfile(match ? match[0] : "")
}

function setTemp(kelvin: number) {
  const clamped = Math.max(TEMP_MIN, Math.min(TEMP_MAX, Math.round(kelvin)))
  setTemperature(clamped)
  applyTemp(clamped)
  detectProfile()
  persistSettings()
}
function setGam(value: number) {
  const clamped = Math.max(GAMMA_MIN, Math.min(GAMMA_MAX, Math.round(value * 100) / 100))
  setGamma(clamped)
  applyGamma(clamped)
  detectProfile()
  persistSettings()
}
function setRChannel(value: number) {
  const v = Math.max(RGB_MIN, Math.min(RGB_MAX, Math.round(value * 100) / 100))
  setRgbR(v)
  applyRgbShader(v, rgbG.get(), rgbB.get())
  detectProfile()
  persistSettings()
}
function setGChannel(value: number) {
  const v = Math.max(RGB_MIN, Math.min(RGB_MAX, Math.round(value * 100) / 100))
  setRgbG(v)
  applyRgbShader(rgbR.get(), v, rgbB.get())
  detectProfile()
  persistSettings()
}
function setBChannel(value: number) {
  const v = Math.max(RGB_MIN, Math.min(RGB_MAX, Math.round(value * 100) / 100))
  setRgbB(v)
  applyRgbShader(rgbR.get(), rgbG.get(), v)
  detectProfile()
  persistSettings()
}

function applyProfile(key: string) {
  const p = COLOR_PROFILES[key]
  if (!p) return
  setTemperature(p.temp); setGamma(p.gamma)
  setRgbR(p.rgb[0]); setRgbG(p.rgb[1]); setRgbB(p.rgb[2])
  setActiveProfile(key)
  applyTemp(p.temp); applyGamma(p.gamma)
  applyRgbShader(p.rgb[0], p.rgb[1], p.rgb[2])
  persistSettings()
}

// Poll relay values
const relayPoll = createPoll({ temp: 6500, gam: 1.0 }, 2000, () => {
  if (!relayAvailable.get()) return { temp: temperature.get(), gam: gamma.get() }
  return execAsync(["busctl", "--user", "get-property", "rs.wl-gammarelay", "/", "rs.wl.gammarelay", "Temperature"])
    .then((tempOut) => {
      const tempVal = parseInt(tempOut.replace(/[^0-9]/g, ""))
      return execAsync(["busctl", "--user", "get-property", "rs.wl-gammarelay", "/", "rs.wl.gammarelay", "Gamma"])
        .then((gamOut) => {
          const gamVal = parseFloat(gamOut.replace(/[^0-9.]/g, ""))
          if (!isNaN(tempVal)) setTemperature(tempVal)
          if (!isNaN(gamVal)) setGamma(gamVal)
          return { temp: tempVal || 6500, gam: gamVal || 1.0 }
        })
    })
    .catch(() => { setRelayAvailable(false); return { temp: temperature.get(), gam: gamma.get() } })
})

const brightness = createPoll(1, 1000, () => {
  return execAsync("brightnessctl -d intel_backlight get")
    .then((cur) => execAsync("brightnessctl -d intel_backlight max").then((max) => parseInt(cur) / parseInt(max)))
    .catch(() => 1)
})
function setBrightness(val: number) {
  execAsync(`brightnessctl -d intel_backlight set ${Math.round(val * 100)}%`).catch(() => {})
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

function EQColumn({ value, label, onSet, litClass, disabled }: {
  value: Accessor<number>, label: string, onSet: (seg: number) => void, litClass?: string, disabled?: Accessor<boolean>
}) {
  const cls = litClass || ""

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
            if (v > 0 && segIdx === v - 1) return cls ? `peak ${cls}` : "peak"
            return cls ? `${segIdx < v ? "lit" : "unlit"} ${cls}` : (segIdx < v ? "lit" : "unlit")
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

export default function DisplayEQ() {
  const briSegments = brightness.as((b) => Math.round(b * BRI_SEGMENTS))
  const tempSegments = temperature.as((t) => Math.round(((t - TEMP_MIN) / TEMP_RANGE) * SEGMENTS))
  const gamSegments = gamma.as((g) => Math.round(((g - GAMMA_MIN) / GAMMA_RANGE) * SEGMENTS))
  const rSegments = rgbR.as((v) => Math.round(((v - RGB_MIN) / RGB_RANGE) * SEGMENTS))
  const gSegments = rgbG.as((v) => Math.round(((v - RGB_MIN) / RGB_RANGE) * SEGMENTS))
  const bSegments = rgbB.as((v) => Math.round(((v - RGB_MIN) / RGB_RANGE) * SEGMENTS))

  return (
    <box name="eq-panel" vertical>
      <box name="control-header">
        <label name="control-icon" label="" />
        <label name="control-label" label="DISPLAY" />
        <box hexpand />
        <label name="control-value" label={brightness.as((b) => `${Math.round(b * 100)}%`)} />
      </box>
      <box name="eq-columns" homogeneous>
        <EQColumn value={tempSegments} label="TEMP" onSet={(seg) => setTemp(TEMP_MIN + (seg / SEGMENTS) * TEMP_RANGE)} litClass="eq-warm" disabled={relayAvailable.as((a) => !a)} />
        <EQColumn value={gamSegments} label="GAM" onSet={(seg) => setGam(GAMMA_MIN + (seg / SEGMENTS) * GAMMA_RANGE)} litClass="eq-gamma" disabled={relayAvailable.as((a) => !a)} />
        <EQColumn value={rSegments} label="R" onSet={(seg) => setRChannel(RGB_MIN + (seg / SEGMENTS) * RGB_RANGE)} litClass="eq-red" />
        <EQColumn value={gSegments} label="G" onSet={(seg) => setGChannel(RGB_MIN + (seg / SEGMENTS) * RGB_RANGE)} litClass="eq-green" />
        <EQColumn value={bSegments} label="B" onSet={(seg) => setBChannel(RGB_MIN + (seg / SEGMENTS) * RGB_RANGE)} litClass="eq-blue" />
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
          setBrightness(Math.max(0, Math.min(1, x / w)))
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
            const cur = brightness.get()
            setBrightness(Math.max(0, Math.min(1, cur + dy / (h * 3))))
          } else {
            setBrightness(Math.max(0, Math.min(1, x / w)))
          }
          return true
        })
        hbarEb.connect("scroll-event", (_w: any, event: any) => {
          const dir = event.get_scroll_direction()[1]
          const cur = brightness.get()
          if (dir === Gdk.ScrollDirection.UP) setBrightness(Math.min(1, cur + 0.05))
          else if (dir === Gdk.ScrollDirection.DOWN) setBrightness(Math.max(0, cur - 0.05))
          return true
        })
        const hbar = (
          <box name="eq-hbar">
            {Array(BRI_SEGMENTS).fill(0).map((_, i) => (
              <box name="eq-hseg" hexpand
                class={briSegments.as((v) => i < v ? "lit" : "unlit")}
              />
            ))}
          </box>
        )
        hbarEb.add(hbar)
        return hbarEb
      })()}
      <box name="eq-presets">
        {Object.entries(COLOR_PROFILES).map(([key, profile]) => (
          <button name="eq-preset-btn" hexpand
            class={activeProfile.as((a) => a === key ? "active" : "")}
            onClicked={() => applyProfile(key)}
          >
            <label name="eq-preset-label" label={profile.label} />
          </button>
        ))}
      </box>
    </box>
  )
}

// Settings window — the 43PR-style control centre: bracketed frame, left nav,
// big letter-spaced header with a live clock, one page per area.
//
//   System     spinning wallpaper disc, OS/WM/kernel/uptime, live CPU/GPU/RAM graphs
//   Audio      output devices, master volume, per-app volume, microphones
//   Display    the display arranger (DisplayLayout, embedded) + colour controls
//   Network    Wi-Fi on/off, networks (connect / password / forget), wired state
//   Bluetooth  the Bluetooth manager (embedded)
//   Storage    mounted filesystems with usage bars
//   Configs    open config files in nvim
//
// Open: SUPER+comma, `ags request toggle-settings`, or the ⚙ button on SET.
// Everything polls only while the window is open and the page is showing.

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { execAsync } from "ags/process"
import { readFile } from "ags/file"
import { createRoot } from "gnim"
import cairo from "cairo"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=3.0"
import Gtk from "gi://Gtk?version=3.0"
import GdkPixbuf from "gi://GdkPixbuf"
import Wp from "gi://AstalWp"
import Network from "gi://AstalNetwork"
import { settingsVisible, setSettingsVisible, settingsPage, setSettingsPage } from "../state"
import { px } from "../scale"
import caps from "../capabilities"
import { DisplayLayout } from "./DisplayLayout"
import DisplayEQ from "./DisplayEQ"
import { BluetoothManager } from "./BluetoothWindow"
import { getHwSpeakers, sinkDesc, selectSink } from "./AudioEQ"

const FONT = "JetBrainsMono Nerd Font"
const HOME = GLib.get_home_dir()

const PAGES = [
  { id: "system", icon: "\u{f013}", label: "System" },
  { id: "audio", icon: "\u{f057e}", label: "Audio" },
  { id: "display", icon: "\u{f0379}", label: "Display" },
  { id: "network", icon: "\u{f05a9}", label: "Network" },
  { id: "bluetooth", icon: "\u{f00af}", label: "Bluetooth" },
  { id: "storage", icon: "\u{f02ca}", label: "Storage" },
  { id: "configs", icon: "\u{f0219}", label: "Configs" },
]

// ── small helpers ────────────────────────────────────────────────────────────

function read(path: string): string {
  try { return readFile(path) || "" } catch { return "" }
}

function colorOf(w: Gtk.Widget, name: string, alpha = 1): [number, number, number, number] {
  const [ok, c] = w.get_style_context().lookup_color(name)
  return ok ? [c.red, c.green, c.blue, alpha] : [0.85, 0.85, 0.85, alpha]
}

// Rebuild a container's children inside a fresh gnim scope (they're rebuilt
// from signal/timer callbacks, which have no tracking context of their own).
function rebuilder(box: Gtk.Box, build: () => void) {
  let dispose: (() => void) | null = null
  return () => {
    dispose?.()
    box.get_children().forEach((c) => c.destroy())
    createRoot((d) => { dispose = d; build() })
    box.show_all()
  }
}

// The global stylesheet doesn't reach GtkScale/GtkLevelBar's inner nodes over
// the fallback Adwaita theme's background-image fills, so pin their look with
// a per-widget provider (theme colours still resolve via @define-color).
const MONO_CSS = `
  scale trough, levelbar trough { background-image: none; background-color: alpha(@fg, 0.12); border: none; box-shadow: none; border-radius: 2px; min-height: 4px; }
  scale highlight { background-image: none; background-color: @fg_bright; border: none; border-radius: 2px; }
  scale slider { background-image: none; background-color: @fg_bright; border: none; box-shadow: none; min-width: 12px; min-height: 12px; border-radius: 9999px; margin: -5px 0; }
  levelbar trough { min-height: 6px; margin: 5px 0; padding: 0; }
  levelbar block.filled, levelbar block.low, levelbar block.high, levelbar block.full { background-image: none; background-color: @fg_bright; border: none; box-shadow: none; }
  levelbar.nearfull block.filled, levelbar.nearfull block.high, levelbar.nearfull block.full { background-color: @red; }
  levelbar block.empty { background-image: none; background-color: transparent; border: none; }
`
const monoProvider = new Gtk.CssProvider()
monoProvider.load_from_data(MONO_CSS)
function mono(w: Gtk.Widget) {
  w.get_style_context().add_provider(monoProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER + 10)
}

function slider(value: number, max: number, onChange: (v: number) => void): Gtk.Scale {
  const s = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: new Gtk.Adjustment({ lower: 0, upper: max, step_increment: 0.01, page_increment: 0.05 }),
    draw_value: false,
    hexpand: true,
  })
  s.set_name("st-slider")
  mono(s)
  s.set_value(value)
  s.connect("value-changed", () => onChange(s.get_value()))
  return s
}

function sectionLabel(text: string): Gtk.Widget {
  return (<label name="st-section" label={text} xalign={0} />) as Gtk.Widget
}

// Rolling history graph: filled area + bright line, 0–100 scale.
function Sparkline(samples: number[]) {
  const da = new Gtk.DrawingArea()
  da.set_hexpand(true)
  da.set_size_request(-1, px(64))
  da.connect("draw", (_w: any, cr: any) => {
    const W = da.get_allocated_width(), H = da.get_allocated_height()
    cr.rectangle(0, 0, W, H)
    cr.setSourceRGBA(...colorOf(da, "fg", 0.04))
    cr.fill()
    if (samples.length < 2) return false
    const n = 60
    const step = W / (n - 1)
    // Full history scrolls in from the right; a short one grows from the left
    // (instead of a stub in the far corner of an empty box).
    const pts = samples.slice(-n).map((v, i, a) =>
      [a.length >= n ? W - (a.length - 1 - i) * step : i * step,
       H - 3 - (Math.min(100, Math.max(0, v)) / 100) * (H - 8)])
    cr.moveTo(pts[0][0], H)
    for (const [x, y] of pts) cr.lineTo(x, y)
    cr.lineTo(pts[pts.length - 1][0], H)
    cr.closePath()
    cr.setSourceRGBA(...colorOf(da, "fg", 0.12))
    cr.fill()
    cr.moveTo(pts[0][0], pts[0][1])
    for (const [x, y] of pts) cr.lineTo(x, y)
    cr.setSourceRGBA(...colorOf(da, "fg_bright", 0.9))
    cr.setLineWidth(1.6)
    cr.stroke()
    cr.selectFontFace(FONT, cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
    cr.setFontSize(px(8))
    cr.setSourceRGBA(...colorOf(da, "fg_dim", 0.7))
    cr.moveTo(W - px(28), px(10)); cr.showText("100%")
    cr.moveTo(W - px(16), H - px(3)); cr.showText("0%")
    return false
  })
  da.show()
  return da
}

// ── System ───────────────────────────────────────────────────────────────────

function SystemPage() {
  const cpuHist: number[] = [], gpuHist: number[] = [], ramHist: number[] = []
  const cpuGraph = Sparkline(cpuHist), gpuGraph = Sparkline(gpuHist), ramGraph = Sparkline(ramHist)
  const cpuStat = (<label name="st-stat" label="" xalign={0} />) as Gtk.Label
  const gpuStat = (<label name="st-stat" label="" xalign={0} />) as Gtk.Label
  const ramStat = (<label name="st-stat" label="" xalign={0} />) as Gtk.Label
  const uptime = (<label name="st-info-value" label="" xalign={0} />) as Gtk.Label

  const os = read("/etc/os-release").match(/^PRETTY_NAME="?([^"\n]+)/m)?.[1] ?? "Linux"
  const kernel = read("/proc/sys/kernel/osrelease").trim()
  const host = (read("/sys/class/dmi/id/product_name").trim() || GLib.get_host_name())
  const cpuModel = (read("/proc/cpuinfo").match(/model name\s*:\s*(.+)/)?.[1] ?? "CPU").replace(/\s+/g, " ")
  let wm = "Hyprland"
  execAsync(["hyprctl", "version", "-j"]).then((o) => { wm = `Hyprland ${JSON.parse(o).version}`; wmLabel.set_label(wm) }).catch(() => {})
  const wmLabel = (<label name="st-info-value" label={wm} xalign={0} />) as Gtk.Label

  // coretemp (Intel) / k10temp (AMD) package temperature
  let tempPath = ""
  try {
    const dir = GLib.Dir.open("/sys/class/hwmon", 0)
    let n: string | null
    while ((n = dir.read_name()) !== null) {
      const name = read(`/sys/class/hwmon/${n}/name`).trim()
      if (name === "coretemp" || name === "k10temp") { tempPath = `/sys/class/hwmon/${n}/temp1_input`; break }
    }
    dir.close()
  } catch {}

  let prevIdle = 0, prevTotal = 0
  function sampleCpu(): number {
    const f = read("/proc/stat").split("\n")[0].split(/\s+/).slice(1).map(Number)
    const idle = f[3] + (f[4] || 0), total = f.reduce((a, b) => a + b, 0)
    const d = total - prevTotal, di = idle - prevIdle
    prevIdle = idle; prevTotal = total
    return d > 0 ? (1 - di / d) * 100 : 0
  }

  let gpuName = "GPU"
  function sampleGpu() {
    if (!caps.nvidia) { gpuStat.set_label("no NVIDIA GPU / nvidia-smi"); return }
    execAsync(["nvidia-smi", "--query-gpu=name,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"])
      .then((o) => {
        const [name, util, temp] = o.trim().split("\n")[0].split(",").map((x) => x.trim())
        gpuName = name
        gpuHist.push(Number(util) || 0); if (gpuHist.length > 120) gpuHist.shift()
        gpuStat.set_label(`${gpuName}   ${util}%   ${temp}°C`)
        gpuGraph.queue_draw()
      })
      .catch(() => gpuStat.set_label("nvidia-smi unavailable"))
  }

  function tick() {
    const cpu = sampleCpu()
    cpuHist.push(cpu); if (cpuHist.length > 120) cpuHist.shift()
    const t = tempPath ? Math.round(Number(read(tempPath)) / 1000) : null
    cpuStat.set_label(`${cpuModel}   ${Math.round(cpu)}%${t ? `   ${t}°C` : ""}`)
    const mi = read("/proc/meminfo")
    const kb = (k: string) => Number(mi.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))?.[1] ?? 0)
    const total = kb("MemTotal"), avail = kb("MemAvailable"), used = total - avail
    const pct = total ? used / total * 100 : 0
    ramHist.push(pct); if (ramHist.length > 120) ramHist.shift()
    ramStat.set_label(`${(used / 1048576).toFixed(1)} GiB / ${(total / 1048576).toFixed(1)} GiB   ${Math.round(pct)}%`)
    const up = Number(read("/proc/uptime").split(" ")[0])
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60)
    uptime.set_label(`up ${h ? `${h} h ` : ""}${m} min`)
    cpuGraph.queue_draw(); ramGraph.queue_draw()
  }

  // The spinning disc: current wallpaper, circle-cropped, slowly rotating.
  const disc = new Gtk.DrawingArea()
  disc.set_size_request(px(170), px(170))
  let discPb: GdkPixbuf.Pixbuf | null = null
  let angle = 0
  function loadDisc() {
    try {
      const wall = GLib.file_read_link(`${HOME}/.config/awww/current.set`)
      discPb = GdkPixbuf.Pixbuf.new_from_file_at_scale(wall, px(400), px(400), true)
    } catch { discPb = null }
  }
  disc.connect("draw", (_w: any, cr: any) => {
    const S = Math.min(disc.get_allocated_width(), disc.get_allocated_height())
    const r = S / 2 - 4
    cr.translate(S / 2, S / 2)
    cr.arc(0, 0, r, 0, 2 * Math.PI)
    cr.clip()
    if (discPb) {
      cr.save()
      cr.rotate(angle)
      const sc = (2 * r) / Math.min(discPb.get_width(), discPb.get_height())
      cr.scale(sc, sc)
      Gdk.cairo_set_source_pixbuf(cr, discPb, -discPb.get_width() / 2, -discPb.get_height() / 2)
      cr.paint()
      cr.restore()
      // a subtle sheen + spindle hole, like a disc
      cr.setSourceRGBA(1, 1, 1, 0.06)
      cr.arc(-r * 0.3, -r * 0.3, r * 0.9, 0, 2 * Math.PI)
      cr.fill()
    } else {
      cr.setSourceRGBA(...colorOf(disc, "bg_light"))
      cr.paint()
    }
    cr.setSourceRGBA(...colorOf(disc, "bg_dark"))
    cr.arc(0, 0, r * 0.1, 0, 2 * Math.PI)
    cr.fill()
    cr.setSourceRGBA(...colorOf(disc, "fg_dim", 0.5))
    cr.setLineWidth(1)
    cr.arc(0, 0, r, 0, 2 * Math.PI)
    cr.stroke()
    return false
  })

  const info = (icon: string, key: string, value: Gtk.Widget) => (
    <box vertical name="st-info">
      <label name="st-info-key" label={`${icon}  ${key}`} xalign={0} />
      {value}
    </box>
  ) as Gtk.Widget

  // CPU/RAM history is kept all the time (two tiny /proc reads a second) so
  // the graphs are already full when the page opens. GPU is polled only while
  // showing: nvidia-smi wakes the dGPU.
  tick()
  GLib.timeout_add(GLib.PRIORITY_LOW, 1000, () => { tick(); return GLib.SOURCE_CONTINUE })

  let timer = 0, spin = 0
  function start() {
    loadDisc()
    sampleGpu()
    cpuGraph.queue_draw(); ramGraph.queue_draw()
    if (!timer) timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { sampleGpu(); return GLib.SOURCE_CONTINUE })
    if (!spin) spin = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 33, () => { angle += 0.004; disc.queue_draw(); return GLib.SOURCE_CONTINUE })
  }
  function stop() {
    if (timer) { GLib.source_remove(timer); timer = 0 }
    if (spin) { GLib.source_remove(spin); spin = 0 }
  }

  const widget = (
    <box vertical name="st-page">
      <box name="st-hero">
        {disc}
        <box vertical name="st-hero-info" valign={Gtk.Align.CENTER}>
          {info("\u{f08c7}", "OS", <label name="st-info-value" label={os} xalign={0} /> as Gtk.Widget)}
          {info("\u{f05b5}", "WM", wmLabel)}
          {info("\u{f033e}", "HOST", <label name="st-info-value" label={`${host}  ·  ${kernel}`} xalign={0} /> as Gtk.Widget)}
          {info("\u{f051f}", "UPTIME", uptime)}
        </box>
      </box>
      <box name="st-stat-row"><label name="st-stat-key" label="CPU" />{cpuStat}</box>
      {cpuGraph}
      <box name="st-stat-row"><label name="st-stat-key" label="GPU" />{gpuStat}</box>
      {gpuGraph}
      <box name="st-stat-row"><label name="st-stat-key" label="RAM" />{ramStat}</box>
      {ramGraph}
    </box>
  ) as Gtk.Widget
  return { widget, start, stop }
}

// ── Audio ────────────────────────────────────────────────────────────────────

function AudioPage() {
  const wp = Wp.get_default()!
  const audio = wp.audio
  const outputs = (<box vertical />) as Gtk.Box
  const master = (<box vertical />) as Gtk.Box
  const apps = (<box vertical />) as Gtk.Box
  const mics = (<box vertical />) as Gtk.Box

  const rebuildOutputs = rebuilder(outputs, () => {
    const def = audio.default_speaker
    for (const s of getHwSpeakers()) {
      outputs.add(
        <button name="st-row-btn" class={def && s.id === def.id ? "active" : ""} onClicked={() => { selectSink(s.id); later(rebuildAll) }}>
          <box>
            <label name="st-row-icon" label={def && s.id === def.id ? "\u{f0765}" : "\u{f0766}"} />
            <label label={sinkDesc(s)} xalign={0} hexpand ellipsize={3} />
          </box>
        </button> as Gtk.Widget)
    }
  })

  const rebuildMaster = rebuilder(master, () => {
    const sp = audio.default_speaker
    if (!sp) return
    const mute = (<button name="st-mini-btn" class={sp.mute ? "active" : ""} onClicked={() => { sp.set_mute(!sp.mute); later(rebuildMaster) }}>
      <label label={sp.mute ? "MUTED" : "MUTE"} />
    </button>) as Gtk.Widget
    const row = (<box name="st-slider-row" />) as Gtk.Box
    row.add(<label name="st-slider-label" label="MASTER" xalign={0} /> as Gtk.Widget)
    row.add(slider(sp.volume, 1.5, (v) => sp.set_volume(v)))
    row.add(mute)
    master.add(row)
  })

  const rebuildApps = rebuilder(apps, () => {
    // Skip the EQ filter-chain's own internal streams — they aren't apps.
    const streams = ((audio.get_streams?.() ?? audio.streams ?? []) as any[])
      .filter((st) => !/^Equalizer (Sink|Source)$/.test(st.description || ""))
    if (streams.length === 0) apps.add(<label name="st-empty" label="NOTHING PLAYING" xalign={0} /> as Gtk.Widget)
    for (const st of streams) {
      const row = (<box name="st-slider-row" />) as Gtk.Box
      row.add(<label name="st-slider-label" label={(st.description || st.name || "app").slice(0, 22)} xalign={0} ellipsize={3} /> as Gtk.Widget)
      row.add(slider(st.volume, 1.5, (v) => st.set_volume(v)))
      apps.add(row)
    }
  })

  const rebuildMics = rebuilder(mics, () => {
    const def = audio.default_microphone
    for (const m of (audio.get_microphones?.() ?? audio.microphones ?? []) as any[]) {
      const isDef = def && m.id === def.id
      mics.add(
        <button name="st-row-btn" class={isDef ? "active" : ""}
          onClicked={() => { execAsync(["wpctl", "set-default", String(m.id)]).catch(() => {}); later(rebuildMics) }}>
          <box>
            <label name="st-row-icon" label={isDef ? "\u{f0765}" : "\u{f0766}"} />
            <label label={m.description || m.name} xalign={0} hexpand ellipsize={3} />
          </box>
        </button> as Gtk.Widget)
    }
    if (def) {
      const row = (<box name="st-slider-row" />) as Gtk.Box
      row.add(<label name="st-slider-label" label="MIC LEVEL" xalign={0} /> as Gtk.Widget)
      row.add(slider(def.volume, 1.5, (v) => def.set_volume(v)))
      mics.add(row)
    }
  })

  function rebuildAll() { rebuildOutputs(); rebuildMaster(); rebuildApps(); rebuildMics() }
  let active = false
  let pending = 0
  function later(fn: () => void) {
    if (pending) GLib.source_remove(pending)
    pending = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => { pending = 0; if (active) fn(); return GLib.SOURCE_REMOVE })
  }
  for (const sig of ["speaker-added", "speaker-removed", "stream-added", "stream-removed", "microphone-added", "microphone-removed", "notify::default-speaker", "notify::default-microphone"]) {
    try { audio.connect(sig, () => later(rebuildAll)) } catch {}
  }

  const widget = (
    <box vertical name="st-page">
      {sectionLabel("OUTPUT")}
      {outputs}
      {master}
      {sectionLabel("APPLICATIONS")}
      {apps}
      {sectionLabel("INPUT")}
      {mics}
    </box>
  ) as Gtk.Widget
  return { widget, start: () => { active = true; rebuildAll() }, stop: () => { active = false } }
}

// ── Display ──────────────────────────────────────────────────────────────────

function DisplayPage() {
  const arranger = DisplayLayout(true)
  const { layout, workspaces, actions } = arranger.parts
  // Screens + their workspace pins stay together: select a screen on the map,
  // then click workspaces below to pin/unpin them to it.
  const screens = (<box vertical name="st-screens">{layout}{workspaces}</box>) as Gtk.Widget
  const tabs = [
    { id: "layout", label: "SCREENS", widget: screens },
    { id: "colour", label: "COLOUR", widget: <DisplayEQ /> as Gtk.Widget },
  ]
  const stack = new Gtk.Stack({ transition_type: Gtk.StackTransitionType.CROSSFADE, transition_duration: 120, vexpand: false })
  stack.set_homogeneous(false)
  for (const t of tabs) stack.add_named(t.widget, t.id)
  stack.show_all()

  // APPLY/RESET belong to the screens tab, not colour
  const actionsHost = (<box name="st-sub-actions">{actions}</box>) as Gtk.Widget
  actionsHost.no_show_all = true

  const bar = (<box name="st-subtabs" />) as Gtk.Box
  let cur = "layout"
  const buildBar = rebuilder(bar, () => {
    for (const t of tabs) {
      bar.add(
        <button name="st-subtab" class={t.id === cur ? "active" : ""} onClicked={() => select(t.id)}>
          <label label={t.label} />
        </button> as Gtk.Widget)
    }
  })
  function select(id: string) {
    cur = id
    stack.set_visible_child_name(id)
    actionsHost.set_visible(id !== "colour")
    if (id !== "colour") actionsHost.show_all()
    buildBar()
  }
  select("layout")

  const widget = (
    <box vertical name="st-page" class="st-display">
      {bar}
      {stack}
      {actionsHost}
    </box>
  ) as Gtk.Widget
  // Mid keep/revert countdown, Escape reverts the layout instead of closing.
  return { widget, start: () => arranger.reload(), stop: () => {}, escape: (k: number) => !arranger.idle() && arranger.escape(k) }
}

// ── Network ──────────────────────────────────────────────────────────────────

function NetworkPage() {
  const net = Network.get_default()
  const wifi = net.wifi
  const top = (<box vertical />) as Gtk.Box
  const list = (<box vertical />) as Gtk.Box
  const notice = (<label name="st-notice" label="" xalign={0} wrap />) as Gtk.Label
  let saved = new Set<string>()
  let expanded = ""   // SSID whose password box is open
  let active = false

  function refreshSaved() {
    return execAsync(["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"])
      .then((o) => { saved = new Set(o.split("\n").filter((l) => l.includes("wireless")).map((l) => l.split(":")[0].replace(/\\:/g, ":"))) })
      .catch(() => {})
  }

  function connect(ssid: string, password?: string) {
    notice.set_label(`CONNECTING TO ${ssid.toUpperCase()}…`)
    const cmd = saved.has(ssid)
      ? ["nmcli", "connection", "up", "id", ssid]
      : ["nmcli", "device", "wifi", "connect", ssid, ...(password ? ["password", password] : [])]
    execAsync(cmd)
      .then(() => { notice.set_label(`CONNECTED TO ${ssid.toUpperCase()}`); expanded = ""; refreshSaved().then(rebuild) })
      .catch((e) => notice.set_label(`FAILED: ${String(e).replace(/^.*Error: /, "").slice(0, 80)}`))
  }

  const rebuildTop = rebuilder(top, () => {
    const row = (<box name="st-slider-row" />) as Gtk.Box
    row.add(<label name="st-slider-label" label="WI-FI" xalign={0} hexpand /> as Gtk.Widget)
    if (wifi) {
      row.add(<button name="st-mini-btn" class={wifi.enabled ? "active" : ""} onClicked={() => { wifi.set_enabled(!wifi.enabled); later() }}>
        <label label={wifi.enabled ? "ON" : "OFF"} />
      </button> as Gtk.Widget)
      row.add(<button name="st-mini-btn" onClicked={() => { try { wifi.scan() } catch {} ; notice.set_label("SCANNING…"); later(2500) }}>
        <label label="SCAN" />
      </button> as Gtk.Widget)
    }
    top.add(row)
    const wired = net.wired
    const status = [
      wifi?.ssid ? `Wi-Fi: ${wifi.ssid} (${wifi.strength}%)` : "Wi-Fi: not connected",
      wired ? `Ethernet: ${wired.internet === Network.Internet.CONNECTED ? "connected" : "not connected"}` : "",
    ].filter(Boolean).join("   ·   ")
    top.add(<label name="st-info-value" label={status} xalign={0} /> as Gtk.Widget)
  })

  const rebuildList = rebuilder(list, () => {
    if (!wifi || !wifi.enabled) { list.add(<label name="st-empty" label="WI-FI IS OFF" xalign={0} /> as Gtk.Widget); return }
    const best = new Map<string, any>()
    for (const ap of wifi.get_access_points?.() ?? wifi.access_points ?? []) {
      if (!ap.ssid) continue
      if (!best.has(ap.ssid) || best.get(ap.ssid).strength < ap.strength) best.set(ap.ssid, ap)
    }
    const aps = [...best.values()].sort((a, b) =>
      Number(b.ssid === wifi.ssid) - Number(a.ssid === wifi.ssid) ||
      Number(saved.has(b.ssid)) - Number(saved.has(a.ssid)) || b.strength - a.strength)
    for (const ap of aps) {
      const current = ap.ssid === wifi.ssid
      const secure = (ap.flags ?? 0) !== 0 || (ap.rsn_flags ?? 0) !== 0 || (ap.wpa_flags ?? 0) !== 0
      const bars = ap.strength > 75 ? "\u{f0928}" : ap.strength > 50 ? "\u{f0925}" : ap.strength > 25 ? "\u{f0922}" : "\u{f091f}"
      const row = (<box name="st-net-row" class={current ? "active" : ""} />) as Gtk.Box
      row.add(<label name="st-row-icon" label={bars} /> as Gtk.Widget)
      row.add(<label label={ap.ssid} xalign={0} hexpand ellipsize={3} /> as Gtk.Widget)
      row.add(<label name="st-net-meta" label={`${secure ? "\u{f033e} " : ""}${ap.strength}%${saved.has(ap.ssid) ? "  · SAVED" : ""}`} /> as Gtk.Widget)
      if (current) {
        row.add(<button name="st-mini-btn" onClicked={() => execAsync(["nmcli", "connection", "down", "id", ap.ssid]).then(() => later()).catch(() => {})}>
          <label label="DISCONNECT" /></button> as Gtk.Widget)
      } else {
        row.add(<button name="st-mini-btn" class="primary" onClicked={() => {
          if (saved.has(ap.ssid) || !secure) connect(ap.ssid)
          else { expanded = expanded === ap.ssid ? "" : ap.ssid; rebuildList() }
        }}><label label="CONNECT" /></button> as Gtk.Widget)
      }
      if (saved.has(ap.ssid)) {
        row.add(<button name="st-mini-btn" class="danger" tooltipText="Forget this network"
          onClicked={() => execAsync(["nmcli", "connection", "delete", "id", ap.ssid]).then(() => refreshSaved().then(rebuild)).catch(() => {})}>
          <label label="FORGET" /></button> as Gtk.Widget)
      }
      list.add(row)
      if (expanded === ap.ssid) {
        const entry = new Gtk.Entry({ visibility: false, placeholder_text: `password for ${ap.ssid}`, hexpand: true })
        entry.set_name("st-entry")
        entry.connect("activate", () => connect(ap.ssid, entry.get_text()))
        const pw = (<box name="st-pw-row" />) as Gtk.Box
        pw.add(entry)
        pw.add(<button name="st-mini-btn" class="primary" onClicked={() => connect(ap.ssid, entry.get_text())}><label label="JOIN" /></button> as Gtk.Widget)
        list.add(pw)
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => { entry.grab_focus(); return GLib.SOURCE_REMOVE })
      }
    }
  })

  function rebuild() { rebuildTop(); rebuildList() }
  let pending = 0
  function later(ms = 400) {
    if (pending) GLib.source_remove(pending)
    pending = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { pending = 0; if (active) { rebuild(); notice.get_label().startsWith("SCANNING") && notice.set_label("") } return GLib.SOURCE_REMOVE })
  }
  if (wifi) for (const sig of ["notify::enabled", "notify::ssid", "notify::access-points", "notify::state"]) wifi.connect(sig, () => later())

  const widget = (
    <box vertical name="st-page">
      {top}
      {sectionLabel("NETWORKS")}
      {list}
      {notice}
    </box>
  ) as Gtk.Widget
  return {
    widget,
    start: () => { active = true; refreshSaved().then(rebuild); try { wifi?.scan() } catch {} },
    stop: () => { active = false; expanded = "" },
  }
}

// ── Bluetooth ────────────────────────────────────────────────────────────────

function BluetoothPage(isActive: () => boolean) {
  const bt = BluetoothManager(isActive)
  return { widget: bt.widget, start: bt.show, stop: bt.hide }
}

// ── Storage ──────────────────────────────────────────────────────────────────

function StoragePage() {
  const list = (<box vertical />) as Gtk.Box
  const human = (b: number) => {
    const u = ["B", "K", "M", "G", "T"]; let i = 0
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++ }
    return `${b.toFixed(i >= 3 ? 1 : 0)}${u[i]}`
  }
  const rebuild = rebuilder(list, () => {})
  function start() {
    execAsync(["df", "-B1", "--output=source,target,fstype,size,used,pcent",
      "-x", "tmpfs", "-x", "devtmpfs", "-x", "efivarfs", "-x", "overlay", "-x", "squashfs"])
      .then((o) => {
        const seen = new Set<string>()
        const rows = o.trim().split("\n").slice(1).map((l) => l.trim().split(/\s+/))
          .filter((r) => r.length >= 6 && !seen.has(r[0]) && seen.add(r[0]))
        rebuild()
        createRoot(() => {
          for (const [src, target, fs, size, used, pcent] of rows) {
            const pct = Number(pcent.replace("%", "")) || 0
            const bar = new Gtk.LevelBar({ min_value: 0, max_value: 100, value: pct, hexpand: true })
            bar.set_name("st-level")
            // no default offsets → no low/high/full block colours from the theme
            for (const o of ["low", "high", "full"]) bar.remove_offset_value(o)
            mono(bar)
            if (pct >= 90) bar.get_style_context().add_class("nearfull")
            list.add(
              <box vertical name="st-disk">
                <box>
                  <label name="st-disk-name" label={target} xalign={0} hexpand />
                  <label name="st-net-meta" label={`${human(Number(used))} / ${human(Number(size))}   ${pct}%`} />
                </box>
                {bar}
                <label name="st-net-meta" label={`${src}  ·  ${fs}`} xalign={0} />
              </box> as Gtk.Widget)
          }
        })
        list.show_all()
      })
      .catch((e) => print(`settings: df failed: ${e}`))
  }
  return { widget: (<box vertical name="st-page">{sectionLabel("FILESYSTEMS")}{list}</box>) as Gtk.Widget, start, stop: () => {} }
}

// ── Configs ──────────────────────────────────────────────────────────────────

const CONFIGS: [string, string][] = [
  ["Hyprland", "~/.config/hypr/hyprland.lua"],
  ["Keybindings", "~/.config/hypr/keybindings.lua"],
  ["Window rules", "~/.config/hypr/rules.lua"],
  ["Displays (generated)", "~/.config/hypr/custom/displays.lua"],
  ["Machine general", "~/.config/hypr/custom/general.lua"],
  ["Machine env", "~/.config/hypr/custom/env.lua"],
  ["Idle / lock", "~/.config/hypr/hypridle.conf"],
  ["AGS app", "~/.config/ags/app.tsx"],
  ["AGS styles", "~/.config/ags/theme.ts"],
  ["Foot terminal", "~/.config/foot/foot.ini"],
  ["Fish shell", "~/.config/fish/config.fish"],
  ["Neovim", "~/.config/nvim/init.lua"],
  ["Dunst", "~/.config/dunst/dunstrc"],
]

function ConfigsPage() {
  const list = (<box vertical />) as Gtk.Box
  const expand = (p: string) => p.replace(/^~/, HOME)
  const rebuild = rebuilder(list, () => {
    for (const [label, path] of CONFIGS) {
      if (!GLib.file_test(expand(path), GLib.FileTest.EXISTS)) continue
      list.add(
        <button name="st-row-btn" tooltipText={`Open in nvim`}
          onClicked={() => { GLib.spawn_async(null, ["foot", "-e", "nvim", expand(path)], null, GLib.SpawnFlags.SEARCH_PATH, null); setSettingsVisible(false) }}>
          <box>
            <label name="st-row-icon" label={"\u{f0219}"} />
            <label label={label} xalign={0} hexpand />
            <label name="st-net-meta" label={path} />
          </box>
        </button> as Gtk.Widget)
    }
  })
  return { widget: (<box vertical name="st-page">{sectionLabel("CONFIG FILES")}{list}</box>) as Gtk.Widget, start: rebuild, stop: () => {} }
}

// ── Window ───────────────────────────────────────────────────────────────────

interface Page { widget: Gtk.Widget, start: () => void, stop: () => void, escape?: (k: number) => boolean }

function Settings() {
  const isOn = (id: string) => () => settingsVisible.get() && settingsPage.get() === id
  const pages: Record<string, Page> = {
    system: SystemPage(),
    audio: AudioPage(),
    display: DisplayPage(),
    network: NetworkPage(),
    bluetooth: BluetoothPage(isOn("bluetooth")),
    storage: StoragePage(),
    configs: ConfigsPage(),
  }

  const stack = new Gtk.Stack({ transition_type: Gtk.StackTransitionType.CROSSFADE, transition_duration: 150 })
  for (const p of PAGES) {
    const scroll = new Gtk.ScrolledWindow({
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
      hexpand: true, vexpand: true,
    })
    scroll.add(pages[p.id].widget)
    stack.add_named(scroll, p.id)
  }
  stack.show_all()

  const pageTitle = (<label name="st-page-title" label="" xalign={0} hexpand />) as Gtk.Label
  const clock = (<label name="st-clock" label="" />) as Gtk.Label
  const nav = (<box name="st-nav" vertical />) as Gtk.Box

  const buildNav = rebuilder(nav, () => {
    const cur = settingsPage.get()
    for (const p of PAGES) {
      nav.add(
        <button name="st-nav-btn" class={p.id === cur ? "active" : ""} onClicked={() => setSettingsPage(p.id)}>
          <box>
            <label name="st-nav-icon" label={p.icon} />
            <label name="st-nav-label" label={p.label} xalign={0} />
          </box>
        </button> as Gtk.Widget)
    }
  })

  let current = ""
  function show() {
    const id = PAGES.some((p) => p.id === settingsPage.get()) ? settingsPage.get() : "system"
    if (current && current !== id) pages[current].stop()
    current = id
    stack.set_visible_child_name(id)
    pageTitle.set_label(PAGES.find((p) => p.id === id)!.label.toUpperCase())
    buildNav()
    pages[id].start()
  }

  let clockTimer = 0
  const tickClock = () => { clock.set_label(GLib.DateTime.new_now_local().format("%H:%M:%S") ?? ""); return GLib.SOURCE_CONTINUE }
  settingsVisible.subscribe(() => {
    if (settingsVisible.get()) {
      show()
      tickClock()
      if (!clockTimer) clockTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, tickClock)
    } else {
      if (current) pages[current].stop()
      current = ""
      if (clockTimer) { GLib.source_remove(clockTimer); clockTimer = 0 }
    }
  })
  settingsPage.subscribe(() => { if (settingsVisible.get()) show() })

  // Corner brackets (top-left, bottom-right) over the frame
  const overlay = new Gtk.Overlay()
  const body = (
    <box name="st-frame" vertical>
      <box name="st-header">
        <label name="st-title" label="SETTINGS" />
        {pageTitle}
        {clock}
      </box>
      <box vexpand>
        {nav}
        <box name="st-content" hexpand vexpand>{stack}</box>
      </box>
    </box>
  ) as Gtk.Widget
  overlay.add(body)
  const tl = (<box name="st-corner-tl" halign={Gtk.Align.START} valign={Gtk.Align.START} />) as Gtk.Widget
  const br = (<box name="st-corner-br" halign={Gtk.Align.END} valign={Gtk.Align.END} />) as Gtk.Widget
  overlay.add_overlay(tl)
  overlay.add_overlay(br)
  overlay.set_overlay_pass_through(tl, true)
  overlay.set_overlay_pass_through(br, true)
  overlay.set_halign(Gtk.Align.CENTER)
  overlay.set_valign(Gtk.Align.CENTER)
  overlay.set_hexpand(true)
  overlay.set_vexpand(true)
  overlay.show_all()

  const key = (keyval: number) => {
    if (keyval !== Gdk.KEY_Escape) return false
    if (pages[current]?.escape?.(keyval)) return true
    setSettingsVisible(false)
    return true
  }
  return { widget: overlay as Gtk.Widget, key }
}

export default function SettingsWindow(gdkMonitor: number | any) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor
  const ui = Settings()
  return (
    <window
      name="settings"
      visible={settingsVisible}
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => ui.key(event.get_keyval()[1])}
    >
      <eventbox name="st-overlay" expand hexpand vexpand
        onButtonPressEvent={(self, event) => {
          // click on the dimmed backdrop (outside the frame) closes
          const [, ex, ey] = event.get_coords()
          const a = ui.widget.get_allocation()
          if (ex < a.x || ey < a.y || ex > a.x + a.width || ey > a.y + a.height) { setSettingsVisible(false); return true }
          return false
        }}>
        <box>{ui.widget}</box>
      </eventbox>
    </window>
  )
}

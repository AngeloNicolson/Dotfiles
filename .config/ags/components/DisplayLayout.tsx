// Display arrangement overlay — drag monitors around, pick mode/scale/rotation,
// pin workspaces to screens, then APPLY (live) with a timed keep/revert guard.
//
// Persistence: the chosen layout is written to ~/.config/hypr/custom/displays.lua
// (gitignored, loaded last by hyprland.lua so it wins over general.lua) plus a
// JSON mirror in ~/.local/state/ags/display-layout.json that this UI reloads.
// Positions are Hyprland logical px (physical ÷ scale, rotated).

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { execAsync } from "ags/process"
import { readFile, writeFile } from "ags/file"
import cairo from "cairo"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=3.0"
import Gtk from "gi://Gtk?version=3.0"
import { displaysVisible, setDisplaysVisible, displaysPlacement, toggleDisplays, barVisible } from "../state"
import { placementFrom, makeClip, preparePanel, openPanel, closePanel, clickedOutside, registerCloser, closeFlyout } from "../flyout"
import { hyprConfigIsLua, onMonitorsChanged } from "../compositor"
import { px } from "../scale"
import { createRoot } from "gnim"

const STATE_DIR = GLib.get_user_state_dir() + "/ags"
const JSON_PATH = STATE_DIR + "/display-layout.json"
const LUA_PATH = GLib.get_home_dir() + "/.config/hypr/custom/displays.lua"
GLib.mkdir_with_parents(STATE_DIR, 0o755)

const WORKSPACES = 10
const REVERT_SECONDS = 15
const CANVAS_W = 820
const CANVAS_H = 360
const FONT = "JetBrainsMono Nerd Font"
// Theme colour names (from theme.ts @define-color) cycled per monitor.
const MON_COLORS = ["accent", "cyan", "magenta", "yellow", "green"]
const NICE_SCALES = [1, 1.066667, 1.2, 1.25, 1.333333, 1.5, 1.6, 1.666667, 1.75, 2, 2.4, 2.5, 3]
const ROTATIONS = ["0°", "90°", "180°", "270°"]

interface Mon {
  name: string
  desc: string
  modes: string[]     // "3840x2160@60.00"
  mode: string
  x: number           // logical px
  y: number
  scale: number
  transform: number   // 0-3 (rotation only; flipped variants not exposed)
  enabled: boolean
}

interface SavedMon { mode: string, x: number, y: number, scale: number, transform: number, enabled: boolean }
interface Saved { monitors: Record<string, SavedMon>, workspaces: Record<string, string> }

// ── Geometry helpers ─────────────────────────────────────────────────────────

function modeSize(mode: string): [number, number] {
  const m = mode.match(/^(\d+)x(\d+)/)
  return m ? [Number(m[1]), Number(m[2])] : [1920, 1080]
}

function logicalSize(m: Mon): [number, number] {
  const [w, h] = modeSize(m.mode)
  const lw = Math.round(w / m.scale), lh = Math.round(h / m.scale)
  return m.transform % 2 === 1 ? [lh, lw] : [lw, lh]
}

interface Rect { x: number, y: number, w: number, h: number }
function rectOf(m: Mon): Rect {
  const [w, h] = logicalSize(m)
  return { x: m.x, y: m.y, w, h }
}
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

// Scales Hyprland accepts for a mode: logical size must come out whole.
function scalesFor(mode: string, current: number): number[] {
  const [w, h] = modeSize(mode)
  const ok = NICE_SCALES.filter((s) => {
    const lw = w / s, lh = h / s
    return Math.abs(lw - Math.round(lw)) < 0.01 && Math.abs(lh - Math.round(lh)) < 0.01
  })
  if (!ok.some((s) => Math.abs(s - current) < 0.001)) ok.push(current)
  return ok.sort((a, b) => a - b)
}

// Snap `d` flush against the nearest side of another enabled monitor, never
// overlapping any. Along the shared edge it keeps its position (clamped so the
// edges actually touch) and magnetises to aligned edges/centres.
function snapPlace(d: Mon, all: Mon[]) {
  const others = all.filter((m) => m !== d && m.enabled)
  if (others.length === 0) { d.x = 0; d.y = 0; return }
  const [dw, dh] = logicalSize(d)
  const mag = Math.max(dw, dh) * 0.08

  const magnet = (v: number, targets: number[]) => {
    for (const t of targets) if (Math.abs(v - t) < mag) return t
    return v
  }

  let best: { x: number, y: number, dist: number } | null = null
  for (const o of others) {
    const r = rectOf(o)
    const alongX = () => magnet(
      Math.min(Math.max(d.x, r.x - dw + 1), r.x + r.w - 1),
      [r.x, r.x + r.w - dw, Math.round(r.x + (r.w - dw) / 2)])
    const alongY = () => magnet(
      Math.min(Math.max(d.y, r.y - dh + 1), r.y + r.h - 1),
      [r.y, r.y + r.h - dh, Math.round(r.y + (r.h - dh) / 2)])
    const candidates = [
      { x: r.x + r.w, y: alongY() }, // right of
      { x: r.x - dw, y: alongY() },  // left of
      { x: alongX(), y: r.y + r.h }, // below
      { x: alongX(), y: r.y - dh },  // above
    ]
    for (const c of candidates) {
      const cand = { x: c.x, y: c.y, w: dw, h: dh }
      if (others.some((m) => overlaps(cand, rectOf(m)))) continue
      const dist = Math.hypot(c.x - d.x, c.y - d.y)
      if (!best || dist < best.dist) best = { ...c, dist }
    }
  }
  if (best) { d.x = Math.round(best.x); d.y = Math.round(best.y) }
}

// Shift everything so the layout's top-left is 0,0 (Hyprland prefers it).
function normalize(mons: Mon[]) {
  const en = mons.filter((m) => m.enabled)
  if (en.length === 0) return
  const minX = Math.min(...en.map((m) => m.x)), minY = Math.min(...en.map((m) => m.y))
  for (const m of en) { m.x -= minX; m.y -= minY }
}

// ── Hyprland I/O ─────────────────────────────────────────────────────────────

function luaStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function monitorLua(m: Mon): string {
  if (!m.enabled) return `hl.monitor({ output = ${luaStr(m.name)}, disabled = true })`
  const scale = Number(m.scale.toFixed(6))
  return `hl.monitor({ output = ${luaStr(m.name)}, mode = ${luaStr(m.mode)}, ` +
    `position = "${m.x}x${m.y}", scale = ${scale}, transform = ${m.transform} })`
}

// Lowest workspace pinned to a monitor becomes its default (shown on connect).
function workspaceRulesLua(ws: Record<string, string>): string[] {
  const firstFor = new Map<string, number>()
  for (const [id, mon] of Object.entries(ws)) {
    const n = Number(id)
    if (!firstFor.has(mon) || n < firstFor.get(mon)!) firstFor.set(mon, n)
  }
  return Object.entries(ws)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([id, mon]) =>
      `hl.workspace_rule({ workspace = "${id}", monitor = ${luaStr(mon)}` +
      `${firstFor.get(mon) === Number(id) ? ", default = true" : ""} })`)
}

function renderLuaFile(mons: Mon[], allSaved: Record<string, SavedMon>, ws: Record<string, string>): string {
  const lines = [
    "-- Generated by the AGS display arranger (SUPER+SHIFT+P / `ags request toggle-displays`).",
    "-- Loaded last from hyprland.lua, so it overrides custom/general.lua and custom/rules.lua.",
    "-- Edits here are overwritten on the next APPLY; state mirror:",
    `--   ${JSON_PATH}`,
    "",
    "-- Monitors (connected ones + remembered ones that are currently unplugged)",
  ]
  const live = new Set(mons.map((m) => m.name))
  for (const m of mons) lines.push(monitorLua(m))
  for (const [name, s] of Object.entries(allSaved)) {
    if (live.has(name)) continue
    lines.push(monitorLua({ name, desc: "", modes: [], ...s }))
  }
  lines.push("", "-- Workspace → monitor pins")
  lines.push(...workspaceRulesLua(ws))
  return lines.join("\n") + "\n"
}

async function hyprEval(chunk: string): Promise<string> {
  return (await execAsync(["hyprctl", "eval", chunk])).trim()
}

async function hyprJson(what: string): Promise<any> {
  return JSON.parse(await execAsync(["hyprctl", what, "-j"]))
}

function loadSaved(): Saved {
  try {
    const s = JSON.parse(readFile(JSON_PATH) || "{}")
    return { monitors: s.monitors ?? {}, workspaces: s.workspaces ?? {} }
  } catch {
    return { monitors: {}, workspaces: {} }
  }
}

function readOr(path: string): string | null {
  try { return GLib.file_test(path, GLib.FileTest.EXISTS) ? readFile(path) : null } catch { return null }
}

async function probeMonitors(): Promise<Mon[]> {
  const raw: any[] = JSON.parse(await execAsync(["hyprctl", "monitors", "all", "-j"]))
  const saved = loadSaved().monitors
  return raw.map((r) => {
    const modes: string[] = (r.availableModes ?? []).map((s: string) => s.replace(/Hz$/, ""))
    const cur = `${r.width}x${r.height}@${Number(r.refreshRate).toFixed(2)}`
    if (!modes.includes(cur)) modes.unshift(cur)
    const s = saved[r.name]
    const m: Mon = {
      name: r.name,
      desc: `${r.make ?? ""} ${r.model ?? ""}`.trim(),
      modes,
      mode: cur,
      x: r.x, y: r.y,
      scale: r.scale || 1,
      transform: (r.transform ?? 0) % 4,
      enabled: !r.disabled,
    }
    // A disabled monitor reports junk geometry; fall back to what we saved.
    if (r.disabled && s) Object.assign(m, { mode: modes.includes(s.mode) ? s.mode : cur, scale: s.scale, transform: s.transform })
    return m
  })
}

// Initial pins: saved state, else whatever numeric workspace rules are live.
async function probeWorkspaces(): Promise<Record<string, string>> {
  const saved = loadSaved().workspaces
  if (Object.keys(saved).length) return { ...saved }
  const out: Record<string, string> = {}
  try {
    for (const r of await hyprJson("workspacerules")) {
      if (/^\d+$/.test(r.workspaceString) && r.monitor) out[r.workspaceString] = r.monitor
    }
  } catch {}
  return out
}

// ── Component ────────────────────────────────────────────────────────────────

// `embed`: hosted inside another window (Settings → Display) — no CLOSE button.
export function DisplayLayout(embed = false) {
  let mons: Mon[] = []
  let pins: Record<string, string> = {}
  let selected = ""

  // Undo snapshot for the keep/revert countdown
  let undo: { mons: Mon[], pins: Record<string, string>, lua: string | null, json: string | null } | null = null
  let countdown = 0
  let countdownTimer = 0

  const colorIdx = (name: string) => Math.max(0, mons.findIndex((m) => m.name === name)) % MON_COLORS.length

  // ── Canvas ──
  const canvas = new Gtk.DrawingArea()
  canvas.set_name("displays-canvas")
  canvas.set_size_request(px(CANVAS_W), px(CANVAS_H))
  canvas.show()
  canvas.add_events(
    Gdk.EventMask.BUTTON_PRESS_MASK |
    Gdk.EventMask.BUTTON_RELEASE_MASK |
    Gdk.EventMask.POINTER_MOTION_MASK)

  // Canvas px ↔ logical px transform; frozen while dragging so nothing jumps.
  let view = { ratio: 0.1, ox: 0, oy: 0 }
  function computeView() {
    const en = mons.filter((m) => m.enabled)
    if (en.length === 0) return
    const rs = en.map(rectOf)
    const minX = Math.min(...rs.map((r) => r.x)), minY = Math.min(...rs.map((r) => r.y))
    const maxX = Math.max(...rs.map((r) => r.x + r.w)), maxY = Math.max(...rs.map((r) => r.y + r.h))
    const W = canvas.get_allocated_width() || px(CANVAS_W)
    const H = canvas.get_allocated_height() || px(CANVAS_H)
    const pad = px(36)
    // Leave room for the layout to grow while dragging.
    const ratio = Math.min((W - 2 * pad) / ((maxX - minX) * 1.15), (H - 2 * pad) / ((maxY - minY) * 1.15))
    view = {
      ratio,
      ox: (W - (maxX - minX) * ratio) / 2 - minX * ratio,
      oy: (H - (maxY - minY) * ratio) / 2 - minY * ratio,
    }
  }

  function color(name: string, alpha = 1): [number, number, number, number] {
    const [ok, c] = canvas.get_style_context().lookup_color(name)
    return ok ? [c.red, c.green, c.blue, alpha] : [0.6, 0.7, 0.8, alpha]
  }

  function roundRect(cr: any, x: number, y: number, w: number, h: number, r: number) {
    cr.newSubPath()
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI)
    cr.closePath()
  }

  function centeredText(cr: any, text: string, cx: number, cy: number) {
    const e = cr.textExtents(text)
    cr.moveTo(cx - e.width / 2 - e.xBearing, cy - e.height / 2 - e.yBearing)
    cr.showText(text)
  }

  canvas.connect("draw", (_w: any, cr: any) => {
    if (!dragging) computeView()
    const { ratio, ox, oy } = view
    for (const m of mons.filter((m) => m.enabled)) {
      const r = rectOf(m)
      const x = ox + r.x * ratio, y = oy + r.y * ratio, w = r.w * ratio, h = r.h * ratio
      const tone = MON_COLORS[colorIdx(m.name)]
      const sel = m.name === selected

      roundRect(cr, x + 2, y + 2, w - 4, h - 4, px(6))
      cr.setSourceRGBA(...color(tone, sel ? 0.22 : 0.1))
      cr.fillPreserve()
      cr.setSourceRGBA(...color(tone, sel ? 1 : 0.55))
      cr.setLineWidth(sel ? px(3) : px(1.5))
      cr.stroke()

      cr.selectFontFace(FONT, cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
      cr.setFontSize(px(13))
      cr.setSourceRGBA(...color("fg_bright"))
      cr.moveTo(x + px(12), y + px(22))
      cr.showText(m.name)

      cr.selectFontFace(FONT, cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
      cr.setFontSize(px(10))
      cr.setSourceRGBA(...color("fg_dim"))
      const [pw, ph] = modeSize(m.mode)
      cr.moveTo(x + px(12), y + px(38))
      cr.showText(`${pw}×${ph} @${Math.round(Number(m.mode.split("@")[1] ?? 60))}Hz  ×${Number(m.scale.toFixed(3))}  ${ROTATIONS[m.transform]}`)
      cr.moveTo(x + px(12), y + h - px(12))
      cr.showText(`${r.w}×${r.h} at ${r.x},${r.y}`)

      const wsList = Object.entries(pins)
        .filter(([, mon]) => mon === m.name)
        .map(([id]) => Number(id)).sort((a, b) => a - b)
      cr.selectFontFace(FONT, cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
      cr.setFontSize(Math.min(px(30), h / 5))
      cr.setSourceRGBA(...color(tone, 0.9))
      centeredText(cr, wsList.length ? wsList.join(" ") : "—", x + w / 2, y + h / 2)
    }
    return false
  })

  // ── Dragging ──
  let dragging: Mon | null = null
  let dragStart = { px: 0, py: 0, x: 0, y: 0 }

  function hit(ex: number, ey: number): Mon | null {
    const { ratio, ox, oy } = view
    for (const m of [...mons].reverse()) {
      if (!m.enabled) continue
      const r = rectOf(m)
      const x = ox + r.x * ratio, y = oy + r.y * ratio
      if (ex >= x && ex <= x + r.w * ratio && ey >= y && ey <= y + r.h * ratio) return m
    }
    return null
  }

  canvas.connect("button-press-event", (_w: any, ev: any) => {
    const [, ex, ey] = ev.get_coords()
    const m = hit(ex, ey)
    if (!m) return false
    selected = m.name
    dragging = m
    dragStart = { px: ex, py: ey, x: m.x, y: m.y }
    canvas.grab_add()
    rebuildPanel()
    canvas.queue_draw()
    return true
  })

  canvas.connect("motion-notify-event", (_w: any, ev: any) => {
    if (!dragging) return false
    const [, ex, ey] = ev.get_coords()
    dragging.x = Math.round(dragStart.x + (ex - dragStart.px) / view.ratio)
    dragging.y = Math.round(dragStart.y + (ey - dragStart.py) / view.ratio)
    canvas.queue_draw()
    return true
  })

  canvas.connect("button-release-event", () => {
    if (!dragging) return false
    canvas.grab_remove()
    snapPlace(dragging, mons)
    normalize(mons)
    dragging = null
    setStatus("")
    canvas.queue_draw()
    return true
  })

  // ── Side panel / workspace chips / action bar (rebuilt imperatively) ──
  const monTabs = (<box name="displays-mon-tabs" />) as Gtk.Box
  const settings = (<box name="displays-settings" vertical />) as Gtk.Box
  const chips = (<box name="displays-ws-row" />) as Gtk.Box
  const actions = (<box name="displays-actions" />) as Gtk.Box
  const status = (<label name="displays-status" label="" xalign={0} hexpand />) as Gtk.Label

  function setStatus(text: string) { status.set_label(text) }

  function stepper(label: string, value: string, onPrev: () => void, onNext: () => void): Gtk.Widget {
    return (
      <box name="displays-setting-row">
        <label name="displays-setting-label" label={label} xalign={0} />
        <button name="displays-step-btn" onClicked={onPrev}><label label="‹" /></button>
        <label name="displays-setting-value" label={value} hexpand />
        <button name="displays-step-btn" onClicked={onNext}><label label="›" /></button>
      </box>
    ) as Gtk.Widget
  }

  function changed() {
    const m = mons.find((m) => m.name === selected)
    // Size changed → re-seat it against its neighbours.
    if (m?.enabled) snapPlace(m, mons)
    normalize(mons)
    rebuildPanel()
    canvas.queue_draw()
  }

  // Rebuilds run from GLib/async callbacks, outside any gnim scope — give each
  // one its own root so JSX has a context and the previous one is disposed.
  let panelDispose: (() => void) | null = null
  function rebuildPanel() {
    // Dispose the old scope before destroying its widgets, or its cleanup
    // tries to disconnect handlers from already-disposed buttons.
    panelDispose?.()
    for (const box of [monTabs, settings, chips, actions]) {
      // `status` is long-lived and re-added each rebuild; detach it, don't destroy it.
      box.get_children().forEach((c) => c === status ? box.remove(c) : c.destroy())
    }
    createRoot((dispose) => { panelDispose = dispose; buildPanel() })
  }

  function buildPanel() {

    for (const m of mons) {
      monTabs.add(
        <button
          name="displays-mon-tab"
          class={`mon-${colorIdx(m.name)} ${m.name === selected ? "active" : ""} ${m.enabled ? "" : "off"}`}
          hexpand
          onClicked={() => { selected = m.name; rebuildPanel(); canvas.queue_draw() }}
        >
          <label label={m.enabled ? m.name : `${m.name} (OFF)`} />
        </button> as Gtk.Widget)
    }

    const m = mons.find((m) => m.name === selected)
    if (m) {
      settings.add(<label name="displays-desc" label={m.desc || m.name} xalign={0} /> as Gtk.Widget)

      const mi = Math.max(0, m.modes.indexOf(m.mode))
      settings.add(stepper("MODE", m.mode.replace(/\.00$/, "") + "Hz",
        () => { m.mode = m.modes[(mi - 1 + m.modes.length) % m.modes.length]; fixScale(m); changed() },
        () => { m.mode = m.modes[(mi + 1) % m.modes.length]; fixScale(m); changed() }))

      const scales = scalesFor(m.mode, m.scale)
      const si = scales.findIndex((s) => Math.abs(s - m.scale) < 0.001)
      const [lw, lh] = logicalSize(m)
      settings.add(stepper("SCALE", `×${Number(m.scale.toFixed(3))}  (${lw}×${lh})`,
        () => { m.scale = scales[Math.max(0, si - 1)]; changed() },
        () => { m.scale = scales[Math.min(scales.length - 1, si + 1)]; changed() }))

      settings.add(stepper("ROTATE", ROTATIONS[m.transform],
        () => { m.transform = (m.transform + 3) % 4; changed() },
        () => { m.transform = (m.transform + 1) % 4; changed() }))

      const lastOn = m.enabled && mons.filter((x) => x.enabled).length === 1
      settings.add(
        <box name="displays-setting-row">
          <label name="displays-setting-label" label="POWER" xalign={0} />
          <button
            name="displays-toggle"
            class={m.enabled ? "active" : ""}
            hexpand
            sensitive={!lastOn}
            onClicked={() => {
              m.enabled = !m.enabled
              // Re-enabled screens start just right of the layout, then snap.
              if (m.enabled) m.x = Math.max(0, ...mons.filter((x) => x.enabled && x !== m).map((x) => rectOf(x).x + rectOf(x).w))
              changed()
            }}
          >
            <label label={lastOn ? "ON (ONLY SCREEN)" : m.enabled ? "ON" : "OFF"} />
          </button>
        </box> as Gtk.Widget)
    }

    for (let i = 1; i <= WORKSPACES; i++) {
      const id = String(i)
      const owner = pins[id]
      const idx = owner ? mons.findIndex((m) => m.name === owner) : -1
      const cls = owner ? (idx >= 0 ? `mon-${idx % MON_COLORS.length}` : "absent") : ""
      chips.add(
        <button
          name="displays-ws-chip"
          class={cls}
          tooltipText={owner ? `workspace ${id} → ${owner}${idx < 0 ? " (unplugged)" : ""}` : `workspace ${id}: follows focus`}
          onClicked={() => {
            if (pins[id] === selected) delete pins[id]
            else if (selected) pins[id] = selected
            rebuildPanel()
            canvas.queue_draw()
          }}
        >
          <label label={i === 10 ? "0" : id} />
        </button> as Gtk.Widget)
    }

    if (countdown > 0) {
      actions.add(<label name="displays-confirm" label={`KEEP THIS LAYOUT? REVERTING IN ${countdown}s`} hexpand xalign={0} /> as Gtk.Widget)
      actions.add(<button name="displays-btn" onClicked={() => revert()}><label label="REVERT" /></button> as Gtk.Widget)
      actions.add(<button name="displays-btn" class="primary" onClicked={() => keep()}><label label="KEEP" /></button> as Gtk.Widget)
    } else {
      actions.add(status)
      actions.add(<button name="displays-btn" onClicked={() => reload()}><label label="RESET" /></button> as Gtk.Widget)
      if (!embed) actions.add(<button name="displays-btn" onClicked={() => closeFlyout("displays", () => setDisplaysVisible(false))}><label label="CLOSE" /></button> as Gtk.Widget)
      actions.add(<button name="displays-btn" class="primary" onClicked={() => apply()}><label label="APPLY" /></button> as Gtk.Widget)
    }

    for (const box of [monTabs, settings, chips, actions]) box.show_all()
  }

  function fixScale(m: Mon) {
    const ok = scalesFor(m.mode, -1).filter((s) => s > 0)
    if (!ok.some((s) => Math.abs(s - m.scale) < 0.001))
      m.scale = ok.reduce((a, b) => Math.abs(b - m.scale) < Math.abs(a - m.scale) ? b : a, 1)
  }

  // ── Apply / revert ──
  async function pushLive(target: Mon[], ws: Record<string, string>) {
    // Enable/position first, disable last, so there's never zero outputs.
    const order = [...target.filter((m) => m.enabled), ...target.filter((m) => !m.enabled)]
    await hyprEval(order.map(monitorLua).join("\n"))
    await hyprEval(workspaceRulesLua(ws).join("\n") || "do end")
    // Give the outputs a moment to reconfigure, then move existing workspaces.
    await new Promise((r) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => { r(null); return GLib.SOURCE_REMOVE }))
    const live = new Set(target.filter((m) => m.enabled).map((m) => m.name))
    // Only existing workspaces can move; the rules cover ones created later.
    const existing = new Set<string>((await hyprJson("workspaces").catch(() => [])).map((w: any) => String(w.id)))
    const moves = Object.entries(ws)
      .filter(([id, mon]) => live.has(mon) && existing.has(id))
      .map(([id, mon]) => `pcall(hl.dispatch, hl.dsp.workspace.move({ workspace = ${id}, monitor = ${luaStr(mon)} }))`)
    if (moves.length) await hyprEval(moves.join("\n")).catch(() => {})
  }

  function snapshot(list: Mon[]): Mon[] {
    return list.map((m) => ({ ...m, modes: [...m.modes] }))
  }

  async function apply() {
    if (!(await hyprConfigIsLua())) {
      setStatus("NEEDS THE LUA CONFIG (hyprland.lua)")
      return
    }
    try {
      const live = await probeMonitors()
      undo = { mons: live, pins: await probeWorkspaces(), lua: readOr(LUA_PATH), json: readOr(JSON_PATH) }
      await pushLive(mons, pins)
      saveFiles(mons, pins)
      startCountdown()
    } catch (e) {
      console.error("displays: apply failed", e)
      setStatus(`APPLY FAILED: ${String(e).slice(0, 60)}`)
      if (undo) revert()
    }
  }

  function saveFiles(list: Mon[], ws: Record<string, string>) {
    const saved = loadSaved()
    for (const m of list) {
      saved.monitors[m.name] = { mode: m.mode, x: m.x, y: m.y, scale: m.scale, transform: m.transform, enabled: m.enabled }
    }
    saved.workspaces = { ...ws }
    writeFile(JSON_PATH, JSON.stringify(saved, null, 2))
    writeFile(LUA_PATH, renderLuaFile(list, saved.monitors, ws))
  }

  function startCountdown() {
    countdown = REVERT_SECONDS
    rebuildPanel()
    if (countdownTimer) GLib.source_remove(countdownTimer)
    countdownTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      countdown--
      if (countdown <= 0) {
        countdownTimer = 0
        revert()
        return GLib.SOURCE_REMOVE
      }
      rebuildPanel()
      return GLib.SOURCE_CONTINUE
    })
  }

  function stopCountdown() {
    if (countdownTimer) GLib.source_remove(countdownTimer)
    countdownTimer = 0
    countdown = 0
  }

  function keep() {
    stopCountdown()
    undo = null
    setStatus("SAVED → custom/displays.lua")
    rebuildPanel()
  }

  async function revert() {
    stopCountdown()
    const u = undo
    undo = null
    if (!u) { rebuildPanel(); return }
    try {
      await pushLive(u.mons, u.pins)
      if (u.lua !== null) writeFile(LUA_PATH, u.lua)
      else GLib.unlink(LUA_PATH)
      if (u.json !== null) writeFile(JSON_PATH, u.json)
      else GLib.unlink(JSON_PATH)
    } catch (e) {
      console.error("displays: revert failed", e)
    }
    mons = snapshot(u.mons)
    pins = { ...u.pins }
    setStatus("REVERTED")
    rebuildPanel()
    canvas.queue_draw()
  }

  async function reload() {
    try {
      mons = await probeMonitors()
      pins = await probeWorkspaces()
    } catch (e) {
      console.error("displays: probe failed", e)
      setStatus("COULD NOT READ MONITORS")
    }
    if (!mons.some((m) => m.name === selected)) {
      const focused = (await hyprJson("monitors").catch(() => [])).find((m: any) => m.focused)
      selected = focused?.name ?? mons[0]?.name ?? ""
    }
    setStatus(`${mons.filter((m) => m.enabled).length} SCREEN(S) · DRAG TO ARRANGE`)
    rebuildPanel()
    canvas.queue_draw()
  }

  // Refresh from the compositor every time the overlay opens (not mid-confirm).
  displaysVisible.subscribe(() => {
    if (displaysVisible.get() && countdown === 0) reload()
    // Closing mid-confirm keeps the countdown running; it reverts unless kept.
  })
  reload()

  const escape = (keyval: number) => {
    if (keyval !== Gdk.KEY_Escape) return false
    if (countdown > 0) revert()
    else closeFlyout("displays", () => setDisplaysVisible(false))
    return true
  }

  const idle = () => countdown === 0

  // Parts, so a host (Settings → Display) can lay them out in its own tabs.
  const layoutPart = (
    <box>
      <box name="displays-canvas-frame">{canvas}</box>
      <box name="displays-side" vertical>
        {monTabs}
        {settings}
      </box>
    </box>
  ) as Gtk.Widget
  const workspacesPart = (
    <box vertical>
      <box name="displays-ws-header">
        <label name="displays-setting-label" label="WORKSPACES" xalign={0} />
        <label name="displays-hint" label="select a screen, then click workspaces to pin them to it · lowest pinned = its default" xalign={0} hexpand />
      </box>
      {chips}
    </box>
  ) as Gtk.Widget

  return {
    escape, idle,
    reload: () => { if (countdown === 0) reload() },
    parts: { layout: layoutPart, workspaces: workspacesPart, actions },
    // Standalone overlay: everything stacked in one panel.
    get widget() {
      return (
        <box name="displays-panel" vertical>
          <label name="section-header" label="//DISPLAYS" xalign={0} />
          {layoutPart}
          {workspacesPart}
          {actions}
        </box>
      ) as Gtk.Widget
    },
  }
}

// gdkMonitor may be a literal index or a reactive accessor so the overlay can
// follow the focused monitor.
export default function DisplayLayoutWindow(gdkMonitor: number | any) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor
  const ui = DisplayLayout()
  const panel = ui.widget  // build once (getter)
  const clip = makeClip(panel)
  const focusedMonitor = () => typeof gdkMonitor === "number" ? gdkMonitor : gdkMonitor.get()

  let closing = false
  registerCloser("displays", () => {
    if (closing || !displaysVisible.get()) return
    closing = true
    closePanel(clip, displaysPlacement.get(), () => { closing = false; setDisplaysVisible(false) })
  })

  const frame = (
    <eventbox
      name="displays-overlay"
      expand hexpand vexpand
      onButtonPressEvent={(self, event) => {
        // Flyout: a click beside it closes (never mid keep/revert countdown).
        if (displaysPlacement.get().x !== undefined && ui.idle() && clickedOutside(clip, self, event)) {
          closeFlyout("displays", () => setDisplaysVisible(false))
          return true
        }
        return false
      }}
    >
      <box>{clip}</box>
    </eventbox>
  ) as Gtk.Widget

  displaysPlacement.subscribe(() => preparePanel(frame, clip, panel, displaysPlacement.get()))
  // Grown out of the sidebar → goes away with it (not mid keep/revert, or the
  // KEEP button would vanish and the layout silently revert).
  barVisible.subscribe(() => {
    if (!barVisible.get() && displaysVisible.get() && displaysPlacement.get().x !== undefined && ui.idle())
      closeFlyout("displays", () => setDisplaysVisible(false))
  })
  displaysVisible.subscribe(() => {
    if (!displaysVisible.get()) return
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      openPanel(frame, clip, panel, displaysPlacement.get())
      return GLib.SOURCE_REMOVE
    })
  })

  return (
    <window
      name="displays"
      visible={displaysVisible}
      monitor={displaysPlacement.as((p) => p.monitor ?? focusedMonitor())}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => ui.escape(event.get_keyval()[1])}
    >
      {frame}
    </window>
  )
}

// ── Compact sidebar widget (Settings page) ───────────────────────────────────
// Mini map of the current layout + one row per screen; the pop-out button opens
// the full arranger above. Refreshes on hotplug and whenever the arranger closes.
export function DisplaysPanel() {
  let mons: Mon[] = []
  let pins: Record<string, string> = {}

  const map = new Gtk.DrawingArea()
  map.set_size_request(-1, px(84))
  map.set_hexpand(true)  // else the box hands it its natural width: 0
  map.show()
  const rows = (<box name="dsp-rows" vertical />) as Gtk.Box

  function color(name: string, alpha = 1): [number, number, number, number] {
    const [ok, c] = map.get_style_context().lookup_color(name)
    return ok ? [c.red, c.green, c.blue, alpha] : [0.6, 0.7, 0.8, alpha]
  }

  map.connect("draw", (_w: any, cr: any) => {
    const en = mons.filter((m) => m.enabled)
    if (en.length === 0) return false
    const rs = en.map(rectOf)
    const minX = Math.min(...rs.map((r) => r.x)), minY = Math.min(...rs.map((r) => r.y))
    const bw = Math.max(...rs.map((r) => r.x + r.w)) - minX
    const bh = Math.max(...rs.map((r) => r.y + r.h)) - minY
    const W = map.get_allocated_width(), H = map.get_allocated_height()
    const ratio = Math.min((W - 8) / bw, (H - 8) / bh)
    const ox = (W - bw * ratio) / 2 - minX * ratio, oy = (H - bh * ratio) / 2 - minY * ratio
    en.forEach((m, i) => {
      const r = rs[i]
      const tone = MON_COLORS[mons.indexOf(m) % MON_COLORS.length]
      const x = ox + r.x * ratio + 1.5, y = oy + r.y * ratio + 1.5, w = r.w * ratio - 3, h = r.h * ratio - 3
      cr.rectangle(x, y, w, h)
      cr.setSourceRGBA(...color(tone, 0.14))
      cr.fillPreserve()
      cr.setSourceRGBA(...color(tone, 0.8))
      cr.setLineWidth(1.5)
      cr.stroke()
      cr.selectFontFace(FONT, cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
      cr.setFontSize(px(9))
      cr.setSourceRGBA(...color("fg_bright", 0.9))
      const e = cr.textExtents(m.name)
      cr.moveTo(x + (w - e.width) / 2 - e.xBearing, y + (h - e.height) / 2 - e.yBearing)
      cr.showText(m.name)
    })
    return false
  })

  let rootDispose: (() => void) | null = null
  function rebuildRows() {
    rootDispose?.()
    rows.get_children().forEach((c) => c.destroy())
    createRoot((dispose) => {
      rootDispose = dispose
      for (const m of mons) {
        const [pw, ph] = modeSize(m.mode)
        const hz = Math.round(Number(m.mode.split("@")[1] ?? 60))
        const ws = Object.entries(pins).filter(([, mon]) => mon === m.name).map(([id]) => id)
          .sort((a, b) => Number(a) - Number(b))
        rows.add(
          <box name="dsp-row" class={`mon-${mons.indexOf(m) % MON_COLORS.length}`}>
            <label name="dsp-name" label={m.name} xalign={0} />
            <label name="dsp-mode" hexpand xalign={0}
              label={m.enabled ? `${pw}×${ph} ${hz}Hz ×${Number(m.scale.toFixed(2))}` : "OFF"} />
            <label name="dsp-ws" label={ws.length ? `WS ${ws.join(" ")}` : ""} />
          </box> as Gtk.Widget)
      }
    })
    rows.show_all()
  }

  async function refresh() {
    try {
      mons = await probeMonitors()
      pins = await probeWorkspaces()
    } catch {
      mons = []
    }
    rebuildRows()
    map.queue_draw()
  }

  onMonitorsChanged(() => refresh())
  displaysVisible.subscribe(() => { if (!displaysVisible.get()) refresh() })
  refresh()

  let panelRef: Gtk.Widget | null = null
  return (
    <box name="eq-panel" vertical $={(self) => { panelRef = self }}>
      <box name="control-header">
        <label name="control-icon" label="󰍹" />
        <label name="control-label" label="DISPLAYS" />
        <box hexpand />
        <button name="bt-scan-btn" tooltipText="Arrange screens & workspaces" onClicked={() => { if (!displaysVisible.get()) toggleDisplays(panelRef ? placementFrom(panelRef) : undefined) }}>
          <label name="bt-scan-label" label="󰁌" />
        </button>
      </box>
      <box name="dsp-map">{map}</box>
      {rows}
    </box>
  )
}

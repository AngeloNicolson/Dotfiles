// SHIELD bar style — Halo-themed top bar of three floating pills.
//
//  ( ⬡ 󰕾 ᛒ 󰖩 80 )        ( |┄ 1 ┄·┄ 2 ┄·┄ 3 ┄| )        ( 12:04 SAT 03 / )
//
// Left pill: hex emblem (Settings) + status. Centre pill: the workspace
// compass (Reach-style). Right pill: the clock. Clicking the centred workspace
// (or the clock) drops the media / calendar / controls panel; click again to
// close.

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import { createRoot, createBinding } from "gnim"
import Wp from "gi://AstalWp"
import Mpris from "gi://AstalMpris"
import { shieldConfig, shieldPanel, setShieldPanel, toggleSettings, type ShieldPanel } from "../state"
import { px } from "../scale"
import { Clock, StatusGlyphs } from "./BarWidgets"
import { localVol, setHwVolume } from "./AudioEQ"
import * as compositor from "../compositor"

type RGB = [number, number, number]
const REACH_EDGE: RGB = [0.66, 0.90, 1.0]   // Halo Reach HUD blue

function rgbOf(w: Gtk.Widget, name: string, fallback: RGB): RGB {
  const [ok, c] = w.get_style_context().lookup_color(name)
  return ok ? [c.red, c.green, c.blue] : fallback
}

const BAR_H = 30           // whole bar: three floating pills
const COMPASS_H = 22       // workspace compass strip
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

function hudColours(w: Gtk.Widget) {
  const reach = shieldConfig.get().color === "reach"
  return { edge: reach ? REACH_EDGE : rgbOf(w, "fg_bright", REACH_EDGE) }
}

// The full-width HUD line + the shield bar, drawn behind the corner widgets.
// Workspace compass (Reach-style): workspace numbers sit where the headings
// would, with tick clusters and dots between them. The focused one stays
// centred over the heading marker; switching slides the strip. Click a number
// to go there, scroll to step through them.
const SPACING = 72          // px between neighbouring workspaces

export function WorkspaceCompass(vertical = false, onCentreClick?: () => void) {
  // vertical: runs down the FRAME rail, numbers upright, marker on the right
  const W = vertical ? px(40) : px(360), H = vertical ? px(330) : px(COMPASS_H)
  const S = px(SPACING)
  const da = new Gtk.DrawingArea()
  da.set_size_request(W, H)
  da.show()
  const list = () => {
    const used = compositor.getWorkspaceIds()
    const max = Math.max(7, ...used, compositor.getFocusedWorkspaceId())
    return { max, used: new Set(used) }
  }
  // strip position in workspace units (n = workspace n centred)
  let pos = compositor.getFocusedWorkspaceId(), from = pos, to = pos, start = 0, timer = 0

  da.connect("draw", (_w: any, cr: any) => {
    const { edge } = hudColours(da)
    const w = da.get_allocated_width(), h = da.get_allocated_height()
    // Drawn in (along, across) terms; pt() maps to (x, y) for either layout.
    const L = vertical ? h : w
    // across-centre: ticks, numbers and caps sit exactly centred; the small
    // heading marker tucks into the space past the number
    const A = L / 2, C = vertical ? w / 2 - px(3) : h / 2
    const pt = (a: number, c: number): [number, number] => vertical ? [c, a] : [a, c]
    const rect = (a: number, c: number, al: number, cl: number) => {
      const [x, y] = pt(a, c)
      if (vertical) cr.rectangle(x, y, cl, al)
      else cr.rectangle(x, y, al, cl)
    }
    const fade = (a: number) => Math.max(0, 1 - Math.pow(Math.abs(a - A) / (L / 2 - px(6)), 2))
    const { max, used } = list()
    const focused = compositor.getFocusedWorkspaceId()

    // ticks: a dash cluster either side of a dot between each pair of numbers;
    // they run on past the real workspaces so it always reads as a compass
    for (let k = Math.floor(pos) - 4; k <= Math.ceil(pos) + 4; k++) {
      const a0 = A + (k - pos) * S
      for (const [t0, t1] of [[0.2, 0.4], [0.6, 0.8]]) {
        for (let t = t0; t <= t1 + 1e-6; t += 0.05) {
          const a = a0 + t * S, f = fade(a)
          if (f <= 0) continue
          rect(Math.round(a), C - px(2.5), px(1.2), px(5))
          cr.setSourceRGBA(...edge, 0.5 * f)
          cr.fill()
        }
      }
      const da_ = a0 + 0.5 * S, f = fade(da_)
      if (f > 0) {
        cr.arc(...pt(da_, C), px(1.6), 0, 2 * Math.PI)
        cr.setSourceRGBA(...edge, 0.8 * f)
        cr.fill()
      }
    }
    // workspace numbers (always upright)
    cr.selectFontFace("JetBrainsMono Nerd Font", 0, 1)
    for (let id = 1; id <= max; id++) {
      const a = A + (id - pos) * S, f = fade(a)
      if (f <= 0) continue
      const isFocused = id === focused
      cr.setFontSize(px(isFocused ? 12 : 10))
      const label = String(id)
      const ext = cr.textExtents(label)
      const [x, y] = pt(a, C)
      cr.moveTo(x - ext.width / 2 - ext.xBearing, y + ext.height / 2)
      cr.setSourceRGBA(...edge, f * (isFocused ? 1 : used.has(id) ? 0.8 : 0.35))
      cr.showText(label)
      // Bungie's number: 7 gets a faint pip on the far side from the marker
      if (id === 7) {
        cr.arc(...pt(a, C - px(9)), px(1.2), 0, 2 * Math.PI)
        cr.setSourceRGBA(...edge, 0.6 * f)
        cr.fill()
      }
    }
    // end caps + heading marker beside the centre, pointing at it
    for (const a of [px(1), L - px(3)]) {
      rect(a, C - px(6), px(2), px(12))
      cr.setSourceRGBA(...edge, 0.55)
      cr.fill()
    }
    cr.moveTo(...pt(A - px(3.5), C + px(11)))
    cr.lineTo(...pt(A + px(3.5), C + px(11)))
    cr.lineTo(...pt(A, C + px(8)))
    cr.closePath()
    cr.setSourceRGBA(...edge, 0.9)
    cr.fill()
    return false
  })

  const off = compositor.onWorkspacesChanged(() => {
    const target = compositor.getFocusedWorkspaceId()
    if (target !== to) {
      from = pos; to = target; start = GLib.get_monotonic_time()
      if (!timer) timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
        const t = Math.min(1, (GLib.get_monotonic_time() - start) / 1000 / 280)
        pos = from + (to - from) * easeOut(t)
        da.queue_draw()
        if (t < 1) return GLib.SOURCE_CONTINUE
        timer = 0
        return GLib.SOURCE_REMOVE
      })
    }
    da.queue_draw()
  })
  const unsub = shieldConfig.subscribe(() => da.queue_draw())
  da.connect("destroy", () => { off(); unsub(); if (timer) GLib.source_remove(timer) })

  return (
    <eventbox name="halo-compass" tooltipText="Workspaces"
      onButtonPressEvent={(_s, e) => {
        const [, x, y] = e.get_coords()
        const along = vertical ? y : x, L = vertical ? da.get_allocated_height() : da.get_allocated_width()
        const id = Math.round(pos + (along - L / 2) / S)
        if (id === compositor.getFocusedWorkspaceId() && onCentreClick) onCentreClick()
        else if (id >= 1 && id <= list().max) compositor.focusWorkspace(id)
        return true
      }}
      onScrollEvent={(_s, e) => {
        const [hasDir, dir] = e.get_scroll_direction()
        let step = 0
        if (hasDir && dir !== Gdk.ScrollDirection.SMOOTH) {
          step = dir === Gdk.ScrollDirection.UP || dir === Gdk.ScrollDirection.LEFT ? -1
            : dir === Gdk.ScrollDirection.DOWN || dir === Gdk.ScrollDirection.RIGHT ? 1 : 0
        } else {
          const [, dx, dy] = e.get_scroll_deltas()
          const d = Math.abs(dy) >= Math.abs(dx) ? dy : dx
          step = d > 0.5 ? 1 : d < -0.5 ? -1 : 0
        }
        const target = compositor.getFocusedWorkspaceId() + step
        if (step && target >= 1) compositor.focusWorkspace(target)
        return true
      }}>
      {da}
    </eventbox>
  )
}

// ── morph panel surfaces ─────────────────────────────────────────────────────

function MediaSurface() {
  const box = (<box name="shield-media" vertical />) as Gtk.Box
  const mpris = Mpris.get_default()
  let dispose: (() => void) | null = null
  const build = () => {
    dispose?.()
    box.get_children().forEach((c) => c.destroy())
    const players = mpris.get_players()
    const p = players.find((x) => x.playback_status === Mpris.PlaybackStatus.PLAYING) ?? players[0]
    createRoot((d) => {
      dispose = d
      if (!p) {
        box.add(<label name="shield-empty" label="NO MEDIA PLAYING" /> as Gtk.Widget)
        return
      }
      const title = createBinding(p, "title")
      const artist = createBinding(p, "artist")
      const status = createBinding(p, "playback_status")
      box.add(
        <box vertical>
          <label name="shield-media-title" label={title.as((t) => t || "Unknown")} maxWidthChars={40} ellipsize={3} />
          <label name="shield-media-artist" label={artist.as((a) => a || p.identity || "")} maxWidthChars={40} ellipsize={3} />
          <box name="shield-media-ctl" halign={Gtk.Align.CENTER}>
            <button name="shield-btn" onClicked={() => p.previous()}><label label={"\u{f04ae}"} /></button>
            <button name="shield-btn" onClicked={() => p.play_pause()}>
              <label label={status.as((s) => s === Mpris.PlaybackStatus.PLAYING ? "\u{f03e4}" : "\u{f040a}")} />
            </button>
            <button name="shield-btn" onClicked={() => p.next()}><label label={"\u{f04ad}"} /></button>
          </box>
        </box> as Gtk.Widget)
    })
    box.show_all()
  }
  build()
  const ids = [mpris.connect("player-added", build), mpris.connect("player-closed", build)]
  box.connect("destroy", () => ids.forEach((id) => mpris.disconnect(id)))
  return box
}

function CalendarSurface() {
  const cal = new Gtk.Calendar()
  cal.set_name("shield-calendar")
  cal.show()
  return (<box name="shield-cal-box" halign={Gtk.Align.CENTER}>{cal}</box>) as Gtk.Widget
}

function volumeRow(label: string, ep: any) {
  if (!ep) return <box />
  const s = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: new Gtk.Adjustment({ lower: 0, upper: 1, step_increment: 0.01, page_increment: 0.05 }),
    draw_value: false,
    hexpand: true,
  })
  s.set_name("shield-slider")
  s.set_value(ep.volume)
  s.show()
  s.connect("value-changed", () => { ep.volume = s.get_value() })
  const id = ep.connect("notify::volume", () => { if (Math.abs(s.get_value() - ep.volume) > 0.005) s.set_value(ep.volume) })
  s.connect("destroy", () => ep.disconnect(id))
  return (
    <box name="shield-row">
      <label name="shield-row-label" label={label} xalign={0} widthChars={6} />
      {s}
    </box>
  )
}

// OUT follows the hardware sink the EQ sidebar selected — see BarWidgets'
// VolumeGlyph for why not default_speaker.
function hwVolumeRow(label: string) {
  const s = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: new Gtk.Adjustment({ lower: 0, upper: 1, step_increment: 0.01, page_increment: 0.05 }),
    draw_value: false,
    hexpand: true,
  })
  s.set_name("shield-slider")
  s.set_value(localVol.get())
  s.show()
  s.connect("value-changed", () => { if (Math.abs(s.get_value() - localVol.get()) > 0.005) setHwVolume(s.get_value()) })
  const unsub = localVol.subscribe(() => { if (Math.abs(s.get_value() - localVol.get()) > 0.005) s.set_value(localVol.get()) })
  s.connect("destroy", () => unsub())
  return (
    <box name="shield-row">
      <label name="shield-row-label" label={label} xalign={0} widthChars={6} />
      {s}
    </box>
  )
}

function ControlsSurface() {
  const audio = Wp.get_default()?.audio
  return (
    <box name="shield-controls" vertical>
      {hwVolumeRow("OUT")}
      {volumeRow("MIC", audio?.default_microphone)}
      <box halign={Gtk.Align.END}>
        <button name="shield-btn" tooltipText="Settings" onClicked={() => { setShieldPanel(null); toggleSettings() }}>
          <label label={"\u{f0493}"} />
        </button>
      </box>
    </box>
  )
}

const SURFACES: { id: Exclude<ShieldPanel, null>, label: string }[] = [
  { id: "media", label: "MEDIA" },
  { id: "calendar", label: "CALENDAR" },
  { id: "controls", label: "CONTROLS" },
]

function ShieldPanelWindow(gdkMonitor: number) {
  const { TOP } = Astal.WindowAnchor
  const stack = new Gtk.Stack({ transition_type: Gtk.StackTransitionType.CROSSFADE, transition_duration: 150 })
  stack.add_named(MediaSurface(), "media")
  stack.add_named(CalendarSurface(), "calendar")
  stack.add_named(ControlsSurface() as Gtk.Widget, "controls")
  stack.show_all()
  const sync = () => { const p = shieldPanel.get(); if (p) stack.set_visible_child_name(p) }
  const unsub = shieldPanel.subscribe(sync)
  stack.connect("destroy", unsub)
  sync()

  return (
    <window
      visible
      name="shield-panel"
      namespace="shield-panel"
      monitor={gdkMonitor}
      anchor={TOP}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      // fixed NONE: flipping keymode at runtime parks Hyprland's focus on the layer
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <revealer revealChild={shieldPanel.as((p) => p !== null)} transitionType="slide_down" transitionDuration={220}>
        <box name="shield-panel-box" vertical widthRequest={px(460)}>
          <box name="shield-tabs" homogeneous>
            {SURFACES.map((s) => (
              <button name="shield-tab" class={shieldPanel.as((p) => p === s.id ? "active" : "")}
                onClicked={() => setShieldPanel(s.id)}>
                <label label={s.label} />
              </button>
            ))}
          </box>
          {stack}
        </box>
      </revealer>
    </window>
  ) as Gtk.Window
}

function toggle(panel: Exclude<ShieldPanel, null>) {
  setShieldPanel(shieldPanel.get() === panel ? null : panel)
}

function ShieldTop(gdkMonitor: number) {
  const openDropdown = () => toggle(shieldPanel.get() ?? "media")
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  // Three floating pills: status (left), compass (centre), clock (right).
  const overlay = new Gtk.Overlay()
  overlay.add((<box heightRequest={px(BAR_H)} hexpand />) as Gtk.Widget)
  const left = (
    <box name="halo-pill" class="left" halign={Gtk.Align.START} valign={Gtk.Align.START}>
      <button name="halo-emblem" valign={Gtk.Align.CENTER} tooltipText="Settings (SUPER+comma)" onClicked={() => toggleSettings()}>
        <label label={"\u{f02d9}"} />
      </button>
      <box valign={Gtk.Align.CENTER}><StatusGlyphs /></box>
    </box>
  ) as Gtk.Widget
  const right = (
    <box name="halo-pill" class="right" halign={Gtk.Align.END} valign={Gtk.Align.START}>
      <eventbox valign={Gtk.Align.CENTER} onButtonPressEvent={() => { toggle("calendar"); return true }}>
        <box name="halo-clock" valign={Gtk.Align.CENTER}>
          <Clock />
          <label name="halo-slash" label="/" />
        </box>
      </eventbox>
    </box>
  ) as Gtk.Widget
  overlay.add_overlay(left)
  overlay.add_overlay(right)
  // compass pill, top centre
  const compass = (
    <box name="halo-pill" class="center" halign={Gtk.Align.CENTER} valign={Gtk.Align.START}>
      <box valign={Gtk.Align.CENTER}>{WorkspaceCompass(false, openDropdown)}</box>
    </box>
  ) as Gtk.Widget
  overlay.add_overlay(compass)
  overlay.show_all()
  return (
    <window
      visible
      name="shield-bar"
      namespace="shield-bar"
      monitor={gdkMonitor}
      anchor={TOP | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <box name="shield-bar-box" class={shieldConfig.as((c) => c.color)}>{overlay}</box>
    </window>
  ) as Gtk.Window
}

export default function ShieldBar(gdkMonitor: number): Gtk.Window[] {
  return [ShieldTop(gdkMonitor), ShieldPanelWindow(gdkMonitor)]
}

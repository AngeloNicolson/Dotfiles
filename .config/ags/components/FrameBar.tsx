// FRAME bar style — a Sumi-like band drawn round the whole desktop, with a
// wider left rail carrying workspaces, status glyphs and a vertical clock.
//
//   backdrop  BOTTOM layer, full screen, click-through to nothing (it sits
//             under every window, over the wallpaper): paints the band with a
//             rounded hole the windows live in.
//   rail      TOP layer, left edge, reserves `rail` px; transparent, so the
//             backdrop's band shows through behind its widgets. Carries the
//             vertical workspace compass.
//   spacers   TOP layer, top/right/bottom edges, reserve `thickness` px so
//             tiled windows never overlap the band.
//
// Sizes come from Settings → Bar Studio (frameConfig); app.tsx rebuilds the
// windows when they change.

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import Gtk from "gi://Gtk?version=3.0"
import cairo from "cairo"
import { frameConfig } from "../state"
import { px } from "../scale"
import { Clock, StatusGlyphs } from "./BarWidgets"
import { passThrough } from "../layer"
import { WorkspaceCompass } from "./ShieldBar"

function colorOf(w: Gtk.Widget, name: string, alpha = 1): [number, number, number, number] {
  const [ok, c] = w.get_style_context().lookup_color(name)
  return ok ? [c.red, c.green, c.blue, alpha] : [0.05, 0.05, 0.05, alpha]
}

function roundedRect(cr: any, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  cr.newSubPath()
  cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI)
  cr.closePath()
}

function Backdrop(gdkMonitor: number) {
  const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor
  const cfg = frameConfig.get()
  const t = px(cfg.thickness), rail = px(cfg.rail), r = px(cfg.radius)
  const da = new Gtk.DrawingArea()
  da.set_hexpand(true)
  da.set_vexpand(true)
  da.show()
  da.connect("draw", (_w: any, cr: any) => {
    const W = da.get_allocated_width(), H = da.get_allocated_height()
    cr.setFillRule(cairo.FillRule.EVEN_ODD)
    cr.rectangle(0, 0, W, H)
    roundedRect(cr, rail, t, W - rail - t, H - 2 * t, r)
    cr.setSourceRGBA(...colorOf(da, "bg_dark", cfg.opacity))
    cr.fill()
    // ink line round the hole
    roundedRect(cr, rail + 0.5, t + 0.5, W - rail - t - 1, H - 2 * t - 1, r)
    cr.setSourceRGBA(...colorOf(da, "fg_dim", 0.25 * cfg.opacity))
    cr.setLineWidth(1)
    cr.stroke()
    return false
  })
  return (
    <window
      visible
      name="frame-backdrop"
      namespace="frame-backdrop"
      monitor={gdkMonitor}
      anchor={TOP | LEFT | RIGHT | BOTTOM}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.BOTTOM}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      {da}
    </window>
  ) as Gtk.Window
}

function Spacer(gdkMonitor: number, edge: "top" | "right" | "bottom") {
  const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor
  const t = px(frameConfig.get().thickness)
  const anchor = edge === "top" ? TOP | LEFT | RIGHT
    : edge === "bottom" ? BOTTOM | LEFT | RIGHT
    : TOP | RIGHT | BOTTOM
  const box = (<box name="frame-spacer" />) as Gtk.Box
  if (edge === "right") box.set_size_request(t, -1)
  else box.set_size_request(-1, t)
  return (
    <window
      visible
      name={`frame-${edge}`}
      namespace="frame-edge"
      monitor={gdkMonitor}
      anchor={anchor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      {box}
    </window>
  ) as Gtk.Window
}

function Rail(gdkMonitor: number) {
  const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor
  const cfg = frameConfig.get()
  return (
    <window
      visible
      name="frame-rail"
      namespace="frame-rail"
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <box name="frame-rail-box" vertical widthRequest={px(cfg.rail)}>
        <label name="frame-rail-logo" label={"\u{f08c7}"} />
        <box vexpand />
        {WorkspaceCompass(true)}
        <box vexpand />
        <StatusGlyphs vertical />
        <Clock vertical />
      </box>
    </window>
  ) as Gtk.Window
}

// Every window the FRAME style needs on one monitor.
export default function FrameBar(gdkMonitor: number): Gtk.Window[] {
  return [
    passThrough(Backdrop(gdkMonitor)),
    passThrough(Spacer(gdkMonitor, "top")),
    passThrough(Spacer(gdkMonitor, "right")),
    passThrough(Spacer(gdkMonitor, "bottom")),
    Rail(gdkMonitor),
  ]
}

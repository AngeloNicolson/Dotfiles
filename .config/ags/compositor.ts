// Compositor seam — the single place that talks to the window manager.
// Everything else asks this module for monitors/focus and subscribes to events,
// so supporting another compositor later means swapping only this file's
// backend. When Hyprland isn't running we fall back to GDK: monitor list and
// add/remove events still work (so bars appear anywhere), only focus tracking
// degrades to "first monitor".

import GLib from "gi://GLib"
import AstalHyprland from "gi://AstalHyprland"
import { Gdk } from "ags/gtk3"

export interface MonitorInfo {
  name: string
  x: number
  y: number
  width: number   // physical px
  height: number  // physical px
  scale: number   // width/scale, height/scale = logical px
}

let hypr: AstalHyprland.Hyprland | null = null
try {
  if (GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")) {
    hypr = AstalHyprland.get_default()
  }
} catch (e) {
  print(`compositor: Hyprland unavailable, using GDK fallback (${e})`)
}

export const compositorName = hypr ? "hyprland" : "gdk"

function display(): Gdk.Display | null {
  return Gdk.Display.get_default()
}

function fromHypr(mon: AstalHyprland.Monitor): MonitorInfo {
  return {
    name: mon.get_name(),
    x: mon.get_x(),
    y: mon.get_y(),
    width: mon.get_width(),
    height: mon.get_height(),
    scale: mon.get_scale() || 1,
  }
}

// GDK geometry is already logical px, so report scale 1 against logical dims —
// consumers computing width/scale get the right logical size either way.
function fromGdk(i: number): MonitorInfo | null {
  const gm = display()?.get_monitor(i)
  if (!gm) return null
  const g = gm.get_geometry()
  return {
    name: gm.get_model() || `monitor-${i}`,
    x: g.x,
    y: g.y,
    width: g.width,
    height: g.height,
    scale: 1,
  }
}

export function getMonitors(): MonitorInfo[] {
  if (hypr) return hypr.get_monitors().map(fromHypr)
  const n = display()?.get_n_monitors() ?? 0
  const out: MonitorInfo[] = []
  for (let i = 0; i < n; i++) {
    const m = fromGdk(i)
    if (m) out.push(m)
  }
  return out
}

export function getFocusedMonitor(): MonitorInfo | null {
  if (hypr) {
    const mon = hypr.get_focused_monitor()
      || hypr.get_focused_workspace()?.get_monitor()
      || hypr.get_monitors()[0]
    return mon ? fromHypr(mon) : null
  }
  return fromGdk(0)
}

export function getFocusedMonitorName(): string | null {
  return getFocusedMonitor()?.name ?? null
}

// Map a compositor monitor to its GDK monitor index by matching the logical
// origin (x,y). Robust across machines — GDK index order is not guaranteed to
// match the compositor's.
export function gdkIndexFor(mon: MonitorInfo): number {
  const d = display()
  const n = d?.get_n_monitors() ?? 1
  for (let i = 0; i < n; i++) {
    const g = d?.get_monitor(i)?.get_geometry()
    if (g && g.x === mon.x && g.y === mon.y) return i
  }
  return 0
}

// Fires when a monitor is connected or disconnected.
export function onMonitorsChanged(cb: () => void): void {
  if (hypr) {
    hypr.connect("monitor-added", () => cb())
    hypr.connect("monitor-removed", () => cb())
    return
  }
  const d = display()
  d?.connect("monitor-added", () => cb())
  d?.connect("monitor-removed", () => cb())
}

// Fires when focus may have moved to another monitor. No-op on the GDK
// fallback (no focus concept without compositor IPC).
export function onFocusChanged(cb: () => void): void {
  hypr?.connect("notify::focused-workspace", () => cb())
}

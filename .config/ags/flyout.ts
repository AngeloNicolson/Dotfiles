// Flyouts: overlay panels (display arranger, Bluetooth manager) that either
// open centred on the focused monitor (keybind / IPC) or *grow out of* the
// sidebar widget whose pop-out button was pressed: the panel starts exactly
// over that widget (same spot, same size), animates out past the sidebar edge
// to full size, and shrinks back into the widget when closed.
//
// Structure inside each overlay window:  frame (eventbox) > box > clip > panel
// `clip` is a ScrolledWindow used purely as a clipping viewport while the
// size animates (EXTERNAL policy = clips, no scrollbars).

import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"

export interface Placement {
  monitor: number | null  // GDK index; null = follow the focused monitor
  // Source widget rect, monitor-local logical px (absent = centred overlay)
  x?: number
  y?: number
  w?: number
  h?: number
}

export const CENTERED: Placement = { monitor: null }

const GROW_MS = 200

// The rect of a widget living in a sidebar window (anchored at its monitor's
// top-left, so window coordinates are monitor coordinates).
export function placementFrom(widget: Gtk.Widget): Placement {
  const top = widget.get_toplevel()
  const [ok, x, y] = widget.translate_coordinates(top, 0, 0)
  const display = Gdk.Display.get_default()
  const gdkWin = top.get_window()
  let monitor: number | null = null
  if (display && gdkWin) {
    const m = display.get_monitor_at_window(gdkWin)
    for (let i = 0; i < display.get_n_monitors(); i++) {
      if (display.get_monitor(i) === m) { monitor = i; break }
    }
  }
  return {
    monitor,
    x: ok ? x : 0,
    y: ok ? y : 0,
    w: widget.get_allocated_width(),
    h: widget.get_allocated_height(),
  }
}

export function makeClip(panel: Gtk.Widget): Gtk.ScrolledWindow {
  const clip = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.NEVER,
    // Without these a ScrolledWindow reports its child's *minimum* size, which
    // squashes inner scrolling lists (Bluetooth devices) to a sliver.
    propagate_natural_width: true,
    propagate_natural_height: true,
  })
  clip.set_name("flyout-clip")
  // Expand so halign/valign (centre vs. start+margins) actually position it.
  clip.set_hexpand(true)
  clip.set_vexpand(true)
  clip.add(panel)
  clip.show_all()
  // Content that grows after opening mustn't push the panel off-screen: once
  // settled (not animating), nudge it up to keep the bottom edge visible.
  clip.connect("size-allocate", (_w: any, alloc: any) => {
    if (clip.get_valign() !== Gtk.Align.START) return
    if (clip.get_vscrollbar_policy?.() === Gtk.PolicyType.EXTERNAL) return
    const H = clip.get_parent()?.get_allocated_height() ?? 0
    const top = clip.get_margin_top()
    if (H > 0 && top + alloc.height > H - 8 && top > 8) {
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        clip.set_margin_top(Math.max(8, H - alloc.height - 8))
        return GLib.SOURCE_REMOVE
      })
    }
  })
  return clip
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

// Animate clip size + position between two rects, then call done.
function animate(
  clip: Gtk.ScrolledWindow,
  from: { x: number, y: number, w: number, h: number },
  to: { x: number, y: number, w: number, h: number },
  done: () => void,
) {
  clip.set_policy(Gtk.PolicyType.EXTERNAL, Gtk.PolicyType.EXTERNAL)
  const start = GLib.get_monotonic_time()
  const step = () => {
    const t = Math.min(1, (GLib.get_monotonic_time() - start) / 1000 / GROW_MS)
    const k = easeOut(t)
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * k)
    clip.set_margin_start(lerp(from.x, to.x))
    clip.set_margin_top(lerp(from.y, to.y))
    clip.set_min_content_width(lerp(from.w, to.w))
    clip.set_min_content_height(lerp(from.h, to.h))
    clip.set_max_content_width(lerp(from.w, to.w))
    clip.set_max_content_height(lerp(from.h, to.h))
    if (t < 1) return GLib.SOURCE_CONTINUE
    done()
    return GLib.SOURCE_REMOVE
  }
  step()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 12, step)
}

function releaseSize(clip: Gtk.ScrolledWindow) {
  clip.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER)
  clip.set_min_content_width(-1)
  clip.set_min_content_height(-1)
  clip.set_max_content_width(-1)
  clip.set_max_content_height(-1)
}

function setMode(frame: Gtk.Widget, clip: Gtk.Widget, panel: Gtk.Widget, flyout: boolean) {
  for (const w of [frame, panel]) {
    const ctx = w.get_style_context()
    if (flyout) ctx.add_class("flyout")
    else ctx.remove_class("flyout")
  }
  clip.set_halign(flyout ? Gtk.Align.START : Gtk.Align.CENTER)
  clip.set_valign(flyout ? Gtk.Align.START : Gtk.Align.CENTER)
}

// Called as soon as the placement is known (before the window maps), so the
// first frame is already backdrop-free and sitting exactly over the widget.
export function preparePanel(frame: Gtk.Widget, clip: Gtk.ScrolledWindow, panel: Gtk.Widget, p: Placement) {
  const flyout = p.x !== undefined
  setMode(frame, clip, panel, flyout)
  if (!flyout) {
    releaseSize(clip)
    clip.set_margin_start(0)
    clip.set_margin_top(0)
    return
  }
  clip.set_policy(Gtk.PolicyType.EXTERNAL, Gtk.PolicyType.EXTERNAL)
  clip.set_margin_start(p.x!)
  clip.set_margin_top(p.y!)
  for (const [set, v] of [
    [clip.set_min_content_width, p.w!], [clip.set_max_content_width, p.w!],
    [clip.set_min_content_height, p.h!], [clip.set_max_content_height, p.h!],
  ] as const) set.call(clip, v)
}

// Called once the window is visible: centre it, or grow it out of the widget.
export function openPanel(frame: Gtk.Widget, clip: Gtk.ScrolledWindow, panel: Gtk.Widget, p: Placement) {
  const flyout = p.x !== undefined
  setMode(frame, clip, panel, flyout)
  if (!flyout) {
    releaseSize(clip)
    clip.set_margin_start(0)
    clip.set_margin_top(0)
    return
  }
  const [, natW] = panel.get_preferred_width()
  const [, natH] = panel.get_preferred_height_for_width(natW)
  const screenW = frame.get_allocated_width() || 1920
  const screenH = frame.get_allocated_height() || 1080
  const from = { x: p.x!, y: p.y!, w: p.w!, h: p.h! }
  const to = {
    x: Math.max(8, Math.min(p.x!, screenW - natW - 8)),
    y: Math.max(8, Math.min(p.y!, screenH - natH - 8)),
    w: natW,
    h: natH,
  }
  // Grown: hand sizing back to GTK (clear the animation's size clamps too) so
  // content that fills in later — device rows, audio profiles — resizes it.
  animate(clip, from, to, () => releaseSize(clip))
}

// Shrink back into the source widget (flyout only), then run done.
export function closePanel(clip: Gtk.ScrolledWindow, p: Placement, done: () => void) {
  if (p.x === undefined) { done(); return }
  const from = {
    x: clip.get_margin_start(),
    y: clip.get_margin_top(),
    w: clip.get_allocated_width(),
    h: clip.get_allocated_height(),
  }
  animate(clip, from, { x: p.x!, y: p.y!, w: p.w!, h: p.h! }, done)
}

// True when a click on the overlay frame landed outside the panel.
export function clickedOutside(target: Gtk.Widget, frame: Gtk.Widget, event: Gdk.Event): boolean {
  const [, ex, ey] = event.get_coords()
  const [ok, px, py] = target.translate_coordinates(frame, 0, 0)
  if (!ok) return true
  const w = target.get_allocated_width(), h = target.get_allocated_height()
  return ex < px || ey < py || ex > px + w || ey > py + h
}

// Each flyout window registers how to close itself (with its shrink
// animation); everything else closes through here.
const closers = new Map<string, () => void>()
export function registerCloser(name: string, fn: () => void) { closers.set(name, fn) }
export function closeFlyout(name: string, fallback: () => void) { (closers.get(name) ?? fallback)() }

// Edge tab (FRAME and SHIELD styles) — a small handle that bulges out of the
// right screen edge, Sumi-style (concave corners blend into the edge), with the
// page slid out beside it. One per monitor, each with its own open page.
// No hover: SUPER+P (hypr keybindings.lua) or a click on the right screen edge
// (a separate trigger window, see EdgeTrigger) opens it on the planner; the
// handle icons switch pages. It stays out until toggled shut (SUPER+P again,
// or the active handle icon).
// Never takes the keyboard (so the planner's text inputs can't be typed in yet).
//
//   ags request edge-page <pomodoro|planner|power>   open (no arg closes)
//   ags request edge-toggle [pomodoro|planner|power] open, or close if it's out
//                                                (no arg: planner / close)
// Both act on the focused monitor.

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import Gtk from "gi://Gtk?version=3.0"
import GLib from "gi://GLib"
import cairo from "cairo"
import Gdk from "gi://Gdk?version=3.0"
import { type Accessor, getScope } from "gnim"
import { getEdgePageState } from "../state"
import { PAGES } from "../pages"
import { px, U, withU } from "../scale"
import { buildPage } from "./Sidebar"
import { panelAlpha } from "../theme"

// Pages the tab offers, in handle order, and the one it opens on.
export const EDGE_PAGES = ["pomodoro", "planner", "power"]
export const DEFAULT_EDGE_PAGE = "planner"
const ICONS: Record<string, string> = {
  pomodoro: "\u{f051b}",  // timer
  planner: "\u{f00c5}",   // calendar-check
  power: "\u{f0e7}",      // lightning bolt
}

function colorOf(w: Gtk.Widget, name: string, alpha = 1): [number, number, number, number] {
  const [ok, c] = w.get_style_context().lookup_color(name)
  return ok ? [c.red, c.green, c.blue, alpha] : [0.05, 0.05, 0.05, alpha]
}

// Concave fillet joining the handle to the page beside it (top or bottom).
function Fillet(where: "top" | "bottom") {
  const r = px(7)
  const da = new Gtk.DrawingArea()
  da.set_size_request(r, r)
  da.set_halign(Gtk.Align.END)
  da.connect("draw", (_w: any, cr: any) => {
    // fill the corner square minus a quarter circle centred off the handle side
    cr.rectangle(0, 0, r, r)
    if (where === "top") { cr.moveTo(0, 0); cr.arc(0, 0, r, 0, Math.PI / 2) }
    else { cr.moveTo(0, r); cr.arc(0, r, r, -Math.PI / 2, 0) }
    cr.closePath()
    cr.setFillRule(1) // EVEN_ODD
    cr.setSourceRGBA(...colorOf(da, "bg_dark", panelAlpha()))
    cr.fill()
    return false
  })
  da.show()
  return da
}

// `edgeInset`: FRAME passes its band thickness — the panel window already sits
// inside the band (it honours the exclusive zone); only the edge trigger, which
// spans the band, uses it. SHIELD passes 0.
// Returns [panel window, edge trigger window].
export default function EdgeTab(gdkMonitor: number, monitorName: string, edgeInset = 0): Gtk.Window[] {
  const { TOP, RIGHT, BOTTOM } = Astal.WindowAnchor
  const [edgePage, setEdgePage] = getEdgePageState(monitorName)
  const toggleEdgePage = (id: string) => setEdgePage(edgePage.get() === id ? null : id)
  const defs = EDGE_PAGES.map((id) => PAGES.find((p) => p.id === id)!).filter(Boolean)

  // Pages are built on first open — the planner in particular is heavy. That
  // happens later, from a state callback, so capture what the build needs now:
  // the bar's scope (so the page's bindings are released when the bars are
  // rebuilt, instead of "out of tracking context" leaks) and this monitor's
  // size factor (pages read U at build time).
  const scope = getScope(), pageU = U
  const stack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.CROSSFADE,
    transition_duration: 150,
  })
  // Made by hand, so nothing shows it — without this the pages build inside a
  // hidden stack and the panel is just its black background.
  stack.show()
  const built = new Set<string>()
  const show = () => {
    const id = edgePage.get()
    if (!id) return
    if (!built.has(id)) {
      const page = scope.run(() => withU(pageU, () => buildPage(id)))
      page.show_all()
      stack.add_named(page, id)
      built.add(id)
    }
    stack.set_visible_child_name(id)
  }
  const unsub = edgePage.subscribe(show)
  stack.connect("destroy", unsub)
  show()

  const handle = (
    <box name="edge-handle" vertical valign={Gtk.Align.CENTER}>
      {defs.map((p) => (
        <button name="edge-btn" tooltipText={p.label}
          class={edgePage.as((cur) => cur === p.id ? "active" : "")}
          onClicked={() => toggleEdgePage(p.id)}>
          <label label={ICONS[p.id] ?? p.icon} />
        </button>
      ))}
    </box>
  ) as Gtk.Widget

  // The window never resizes: resizing under the pointer fakes enter/leave
  // events and tangles Hyprland's focus. It's a fixed-size, full-height
  // transparent window; only its *input region* changes — nothing while tucked
  // away, the handle and page while one is out. Everywhere else clicks pass
  // straight through.
  const PANEL_W = px(377)
  const isOpen = edgePage.as((p) => p !== null)

  const handleCol = (
    <box vertical valign={Gtk.Align.CENTER}>
      {Fillet("top")}
      <box>{handle}</box>
      {Fillet("bottom")}
    </box>
  ) as Gtk.Widget
  const handleRev = (
    <revealer revealChild={isOpen} transitionType="slide_left" transitionDuration={180}
      valign={Gtk.Align.CENTER}>
      {handleCol}
    </revealer>
  ) as Gtk.Revealer
  const panel = (
    <box name="sidebar-bg" class="edge-panel" vertical widthRequest={PANEL_W}>{stack}</box>
  ) as Gtk.Widget
  const pageRev = (
    <revealer revealChild={isOpen} transitionType="slide_left" transitionDuration={277}
      valign={Gtk.Align.FILL}>
      {/* full height, like the sidebar: the pages are built to stretch and
          collapse to a sliver if left at their natural height */}
      {panel}
    </revealer>
  ) as Gtk.Revealer

  let win: Gtk.Window | null = null
  let shapeQueued = false
  const rectOf = (w: Gtk.Widget) => {
    if (!win || !w.get_mapped()) return null
    const [ok, x, y] = w.translate_coordinates(win, 0, 0)
    const aw = w.get_allocated_width(), ah = w.get_allocated_height()
    return ok && aw > 1 && ah > 1 ? { x, y, width: aw, height: ah } : null
  }
  const updateShape = () => {
    shapeQueued = false
    if (!win) return GLib.SOURCE_REMOVE
    const region = new cairo.Region()
    if (edgePage.get()) for (const w of [handleRev, pageRev]) {
      const r = rectOf(w)
      if (r) region.unionRectangle(r)
    }
    try {
      win.input_shape_combine_region(region)
      // GDK only sends a new input region to the compositor with the window's
      // next commit. Reopening on the page it closed on draws nothing new
      // after this runs, so Hyprland kept the empty (closed) region and the
      // panel took no clicks at all. Force a frame so the region goes out.
      win.queue_draw()
    } catch (e) {
      // Without a working input region this full-height window would eat
      // clicks down the right edge; better no tab than a dead strip.
      console.error("edge-tab: input region failed, hiding the tab:", e)
      win.hide()
    }
    return GLib.SOURCE_REMOVE
  }
  const queueShape = () => {
    if (shapeQueued) return
    shapeQueued = true
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, updateShape)
  }
  for (const r of [handleRev, pageRev]) {
    r.connect("size-allocate", queueShape)
    r.connect("notify::child-revealed", queueShape)
  }

  // Mapped only while a page is out (or still sliding shut). The input region
  // alone wasn't enough: a closed tab still blocked clicks across the right
  // 440px of the screen (e.g. a site's top-right "Log In" button). Unmapped,
  // it can't take anything.
  const unsubOpen = edgePage.subscribe(() => {
    if (edgePage.get()) win?.show()
    queueShape()
  })
  pageRev.connect("notify::child-revealed", () => {
    if (!edgePage.get() && !pageRev.get_child_revealed()) win?.hide()
  })
  stack.connect("destroy", unsubOpen)

  win = (
    <window
      visible={edgePage.get() !== null}
      name="edge-tab"
      namespace="edge-tab"
      monitor={gdkMonitor}
      anchor={TOP | RIGHT | BOTTOM}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.TOP}
      // Never takes the keyboard, and never switches keymode at runtime: a
      // layer whose keyboard mode flips while mapped left Hyprland's focus
      // parked on it (focus stopped following the mouse).
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <eventbox>
        {/* fixed width: the window keeps its size whatever is revealed */}
        <box widthRequest={PANEL_W + px(60)} halign={Gtk.Align.END}>
          <box hexpand />
          {handleRev}
          {pageRev}
        </box>
      </eventbox>
    </window>
  ) as Gtk.Window
  win.connect("size-allocate", queueShape)
  win.connect("map", queueShape)
  return [win, EdgeTrigger(gdkMonitor, edgeInset, edgePage.as((p) => p === null),
    () => setEdgePage(DEFAULT_EDGE_PAGE))]
}

// Click target on the right screen edge that opens the tab. A window of its own
// because the panel window honours exclusive zones: under FRAME it starts at the
// band's inner edge, so a cursor pushed against the screen edge landed on the
// band and missed. This one ignores exclusive zones and spans the band plus a
// few px, so slamming the mouse right always hits it. Invisible, never takes
// the keyboard; kept tall so it doesn't need aiming. Unmapped while the tab is
// out, so it can't swallow clicks on the panel's right edge.
function EdgeTrigger(gdkMonitor: number, edgeInset: number, closed: Accessor<boolean>, open: () => void) {
  const { RIGHT } = Astal.WindowAnchor
  return (
    <window
      visible={closed}
      name="edge-trigger"
      namespace="edge-tab-trigger"
      monitor={gdkMonitor}
      anchor={RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      {/* Open on release, then from idle: opening unmaps this window, and
          unmapping it mid-click (on press) broke the pointer's implicit grab,
          leaving GTK thinking a button was still down, so the panel's own
          buttons ignored clicks. */}
      <eventbox
        onButtonPressEvent={() => true}
        onButtonReleaseEvent={() => {
          GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => { open(); return GLib.SOURCE_REMOVE })
          return true
        }}>
        <box widthRequest={edgeInset + px(6)} heightRequest={px(240)} />
      </eventbox>
    </window>
  ) as Gtk.Window
}

// Wallpaper carousel — the hyprquickpaper look: a row of tall wallpaper strips,
// biggest in the middle and shrinking toward the edges, sliding smoothly as
// you scroll. Filter chips underneath pick what's shown: starred favourites,
// everything, or one category (sets with sub-folders get a second chip row).
// Themes live in Settings → Theme.
//
// Open: SUPER+W, `ags request toggle-wallpapers`, or 󰁌 on the CORE page.
// Keys: ←/→ or h/l move · Enter apply · f star · Tab/S-Tab category ·
// ↑/↓ sub-category · Esc close. Mouse: scroll moves, click a strip to apply
// it, click empty space to close.
//
// Portrait crops are made once with ffmpeg into ~/.cache/ags/wall-strips/ so
// opening stays instant even though the source images are large.

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { execAsync } from "ags/process"
import { createRoot } from "gnim"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import Gdk from "gi://Gdk?version=3.0"
import Gtk from "gi://Gtk?version=3.0"
import GdkPixbuf from "gi://GdkPixbuf"
import { createState } from "ags"
import { wallpapersVisible, setWallpapersVisible } from "../state"
import { applyStaticWallpaper, applyLiveWallpaper } from "./WallpaperSelector"
import {
  scanWallpapers, groupsOf, subsOf, favouritePaths, isFavourite, toggleFavourite, isVideo,
  type Wallpaper, type Category,
} from "./WallpaperLibrary"
import { px } from "../scale"
import { passThrough } from "../layer"

const CACHE_DIR = GLib.get_user_cache_dir() + "/ags/wall-strips"
const CURRENT_LINK = GLib.get_home_dir() + "/.config/awww/current.set"
const CURRENT_LIVE_LINK = GLib.get_home_dir() + "/.config/awww/current-live.set"
const STRIP_W = 360        // cached crop size (portrait)
const STRIP_H = 800
const VISIBLE_SIDE = 10    // strips drawn each side of the centre
const GAP = 10
// The strip band sits at a fixed spot on screen, centred this far down, with
// the filter chips hanging below it. Nothing is centred on content height, so
// however tall the chips get (sub rows wrap, titles change) the strips stay put.
const BAND_H = 560
const BAND_CENTRE = 0.38
// Hyprland animation speeds are in 100ms units. LAYER_FADE is the normal
// fadeLayersIn (the global default, 0.8s) restored after the backdrop's fade.
const BACKDROP_FADE = 17
const LAYER_FADE = 8
const FONT = "JetBrainsMono Nerd Font"
const STAR = "\u{f005}"
GLib.mkdir_with_parents(CACHE_DIR, 0o755)

function cachePath(path: string): string {
  // mtime in the key so an edited/replaced wallpaper gets a fresh crop
  let mtime = ""
  try {
    mtime = String(Gio.File.new_for_path(path)
      .query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null)
      .get_attribute_uint64("time::modified"))
  } catch {}
  const sum = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, path + mtime, -1)
  return `${CACHE_DIR}/${sum}.jpg`
}

function WallpaperCarousel() {
  let library: Wallpaper[] = []
  let walls: string[] = []   // the filtered view the strips show
  let filter = ""            // "fav" | "all" | group | "group/sub"; "" = pick on open
  const strips = new Map<string, GdkPixbuf.Pixbuf | null>()  // null = loading
  let sel = 0          // target index
  let pos = 0          // animated index (float)
  let hover = -1
  let animTimer = 0

  const canvas = new Gtk.DrawingArea()
  canvas.set_hexpand(true)
  canvas.set_size_request(-1, px(BAND_H))
  canvas.add_events(
    Gdk.EventMask.BUTTON_PRESS_MASK |
    Gdk.EventMask.POINTER_MOTION_MASK |
    Gdk.EventMask.SCROLL_MASK |
    Gdk.EventMask.SMOOTH_SCROLL_MASK |
    Gdk.EventMask.LEAVE_NOTIFY_MASK)
  canvas.show()

  const title = (<label name="wc-title" label="" />) as Gtk.Label
  const groupRow = (<box name="wc-filters" halign={Gtk.Align.CENTER} />) as Gtk.Box
  // FlowBox so a set with many sub-categories wraps instead of overflowing
  // Fills the width (with side margins) so it wraps to the screen rather than
  // to a fixed chip count — long names would otherwise push it off-screen.
  const subRow = new Gtk.FlowBox({
    selection_mode: Gtk.SelectionMode.NONE,
    min_children_per_line: 1,
    max_children_per_line: 40,
    row_spacing: 6,
    column_spacing: 0,
    halign: Gtk.Align.FILL,
    margin_start: px(60),
    margin_end: px(60),
  })
  subRow.set_name("wc-subfilters")
  subRow.set_no_show_all(true)

  function color(name: string, alpha = 1): [number, number, number, number] {
    const [ok, c] = canvas.get_style_context().lookup_color(name)
    return ok ? [c.red, c.green, c.blue, alpha] : [0.9, 0.9, 0.9, alpha]
  }

  // ── Thumbnails ──
  let inflight = 0
  const queue: string[] = []
  function pump() {
    while (inflight < 3 && queue.length) {
      const src = queue.shift()!
      const out = cachePath(src)
      inflight++
      const done = () => {
        inflight--
        try { strips.set(src, GdkPixbuf.Pixbuf.new_from_file(out)) } catch { strips.delete(src) }
        canvas.queue_draw()
        pump()
      }
      if (GLib.file_test(out, GLib.FileTest.EXISTS)) { done(); continue }
      // Videos: grab a frame a few seconds in, past any fade from black
      const seek = isVideo(src) ? ["-ss", "3"] : []
      execAsync(["ffmpeg", "-loglevel", "error", "-y", ...seek, "-i", src, "-frames:v", "1",
        "-vf", `scale=${STRIP_W}:${STRIP_H}:force_original_aspect_ratio=increase,crop=${STRIP_W}:${STRIP_H}`,
        "-q:v", "4", out])
        .then(done)
        .catch((e) => { print(`carousel: thumb failed for ${src}: ${e}`); inflight--; strips.delete(src); pump() })
    }
  }
  function ensureStrip(src: string) {
    if (strips.has(src)) return
    strips.set(src, null)
    queue.push(src)
    pump()
  }

  // ── Geometry: centre strip biggest, shrinking with distance ──
  interface Slot { i: number, x: number, y: number, w: number, h: number }
  function layout(): Slot[] {
    const W = canvas.get_allocated_width(), H = canvas.get_allocated_height()
    const maxH = H * 0.78
    const size = (d: number) => {
      const k = Math.max(0.32, 1 - Math.abs(d) * 0.075)
      return { h: maxH * k, w: maxH * 0.42 * k }
    }
    const slots: Slot[] = []
    const base = Math.floor(pos)
    const frac = pos - base
    // x of the centre point of strip i relative to the canvas middle
    const centreX = (d: number) => {
      // integrate half-widths from 0 to d (d relative to the animated pos)
      let x = 0
      const step = d >= 0 ? 1 : -1
      for (let t = 0; Math.abs(t) < Math.abs(d); t += step) {
        const a = size(t), b = size(t + step)
        x += step * (a.w / 2 + b.w / 2 + GAP)
      }
      return x
    }
    for (let i = Math.max(0, base - VISIBLE_SIDE); i <= Math.min(walls.length - 1, base + VISIBLE_SIDE + 1); i++) {
      const d = i - pos
      // interpolate between integer offsets so motion is smooth
      const d0 = Math.floor(d), t = d - d0
      const x = centreX(d0) * (1 - t) + centreX(d0 + 1) * t
      const s0 = size(d0), s1 = size(d0 + 1)
      const w = s0.w * (1 - t) + s1.w * t, h = s0.h * (1 - t) + s1.h * t
      slots.push({ i, x: W / 2 + x - w / 2, y: (H - h) / 2, w, h })
    }
    void frac
    // Draw far ones first so nearer strips overlap them if they touch.
    return slots.sort((a, b) => Math.abs(b.i - pos) - Math.abs(a.i - pos))
  }

  canvas.connect("draw", (_w: any, cr: any) => {
    if (walls.length === 0) {
      cr.selectFontFace(FONT, 0, 1)
      cr.setFontSize(px(14))
      cr.setSourceRGBA(...color("fg_dim"))
      const t = filter === "fav"
        ? "NO FAVOURITES YET — press f on a wallpaper to star it, Tab for all"
        : "NO WALLPAPERS — add images to ~/.config/ags/wallpapers"
      const e = cr.textExtents(t)
      cr.moveTo((canvas.get_allocated_width() - e.width) / 2, canvas.get_allocated_height() / 2)
      cr.showText(t)
      return false
    }
    for (const s of layout()) {
      const src = walls[s.i]
      ensureStrip(src)
      const pb = strips.get(src)
      const dist = Math.abs(s.i - pos)
      cr.save()
      cr.rectangle(s.x, s.y, s.w, s.h)
      cr.clip()
      if (pb) {
        cr.translate(s.x, s.y)
        cr.scale(s.w / pb.get_width(), s.h / pb.get_height())
        Gdk.cairo_set_source_pixbuf(cr, pb, 0, 0)
        cr.paint()
      } else {
        cr.setSourceRGBA(...color("bg_light", 0.8))
        cr.paint()
      }
      cr.restore()
      // Fade distant strips slightly into the background
      if (dist > 1) {
        cr.rectangle(s.x, s.y, s.w, s.h)
        cr.setSourceRGBA(0, 0, 0, Math.min(0.45, (dist - 1) * 0.05))
        cr.fill()
      }
      if (s.i === sel || s.i === hover) {
        cr.rectangle(s.x + 1, s.y + 1, s.w - 2, s.h - 2)
        cr.setSourceRGBA(...color("fg_bright", s.i === sel ? 0.95 : 0.6))
        cr.setLineWidth(2)
        cr.stroke()
      }
      if (isVideo(src) && s.w > px(40)) {
        const r = Math.max(px(9), s.w * 0.07), cx = s.x + r + px(6), cy = s.y + r + px(6)
        cr.arc(cx, cy, r, 0, 2 * Math.PI)
        cr.setSourceRGBA(0, 0, 0, 0.55)
        cr.fill()
        cr.moveTo(cx - r * 0.3, cy - r * 0.45)
        cr.lineTo(cx + r * 0.5, cy)
        cr.lineTo(cx - r * 0.3, cy + r * 0.45)
        cr.closePath()
        cr.setSourceRGBA(...color("fg_bright"))
        cr.fill()
      }
      if (isFavourite(src) && s.w > px(40)) {
        const r = Math.max(px(9), s.w * 0.07), cx = s.x + s.w - r - px(6), cy = s.y + r + px(6)
        cr.arc(cx, cy, r, 0, 2 * Math.PI)
        cr.setSourceRGBA(0, 0, 0, 0.55)
        cr.fill()
        cr.selectFontFace(FONT, 0, 0)
        cr.setFontSize(r * 1.1)
        const e = cr.textExtents(STAR)
        cr.moveTo(cx - e.width / 2 - e.xBearing, cy - e.height / 2 - e.yBearing)
        cr.setSourceRGBA(...color("fg_bright"))
        cr.showText(STAR)
      }
    }
    return false
  })

  function hitIndex(x: number, y: number): number {
    const slots = layout().reverse()  // nearest first
    for (const s of slots) if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s.i
    return -1
  }

  // ── Motion ──
  function setSel(i: number) {
    sel = Math.max(0, Math.min(walls.length - 1, i))
    updateTitle()
    if (animTimer) return
    animTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      pos += (sel - pos) * 0.22
      if (Math.abs(sel - pos) < 0.002) { pos = sel; animTimer = 0 }
      canvas.queue_draw()
      return animTimer ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE
    })
  }

  function apply(i: number) {
    const src = walls[i]
    if (!src) return
    if (isVideo(src)) applyLiveWallpaper(src)
    else applyStaticWallpaper(src)
    setWallpapersVisible(false)
  }

  // Smooth-scroll events report direction as "invalid" (whose value happens to
  // be UP), so trust the direction only when its ok flag says so; otherwise
  // accumulate deltas — one strip per notch, touchpads included.
  let scrollAcc = 0
  canvas.connect("scroll-event", (_w: any, ev: any) => {
    const [okDir, dir] = ev.get_scroll_direction()
    let step = 0
    if (okDir) {
      if (dir === Gdk.ScrollDirection.UP || dir === Gdk.ScrollDirection.LEFT) step = -1
      else if (dir === Gdk.ScrollDirection.DOWN || dir === Gdk.ScrollDirection.RIGHT) step = 1
    } else {
      const [okD, dx, dy] = ev.get_scroll_deltas()
      if (okD) {
        scrollAcc += Math.abs(dx) > Math.abs(dy) ? dx : dy
        if (Math.abs(scrollAcc) >= 1) { step = Math.trunc(scrollAcc); scrollAcc -= step }
      }
    }
    if (step) setSel(sel + step)
    return true
  })

  canvas.connect("motion-notify-event", (_w: any, ev: any) => {
    const [, x, y] = ev.get_coords()
    const h = hitIndex(x, y)
    if (h !== hover) { hover = h; canvas.queue_draw() }
    return false
  })
  canvas.connect("leave-notify-event", () => { hover = -1; canvas.queue_draw(); return false })

  canvas.connect("button-press-event", (_w: any, ev: any) => {
    const [, x, y] = ev.get_coords()
    const h = hitIndex(x, y)
    if (h < 0) { setWallpapersVisible(false); return true }
    if (h === sel) apply(h)
    else setSel(h)   // first click centres it, second applies
    return true
  })

  function updateTitle() {
    const src = walls[sel]
    const name = src?.split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
    const star = src && isFavourite(src) ? `${STAR}  ` : ""
    const counter = walls.length ? `   ${sel + 1}/${walls.length}` : ""
    title.set_label(star + name.replace(/[-_]+/g, " ").toUpperCase() + counter)
  }

  // ── Filters ──
  function chip(label: string, count: number, active: boolean, onClicked: () => void): Gtk.Widget {
    return (
      <button name="wc-chip" class={active ? "active" : ""} onClicked={onClicked}>
        <box spacing={6}>
          <label label={label} />
          <label name="wc-chip-count" label={String(count)} />
        </box>
      </button>
    ) as Gtk.Widget
  }

  const groupOf = (f: string) => f.split("/")[0]
  // Chip order for Tab cycling: fav, all, then each group (sub filters fold
  // into their group).
  function filterCycle(): string[] {
    return ["fav", "all", ...groupsOf(library).map((g) => g.id)]
  }

  function filtered(f: string): string[] {
    if (f === "fav") return favouritePaths()
    if (f === "all") return library.map((w) => w.path)
    const [g, ...rest] = f.split("/")
    const sub = rest.join("/")
    return library.filter((w) => w.group === g && (!sub || w.sub === sub)).map((w) => w.path)
  }

  let chipDispose: (() => void) | null = null
  function buildChips() {
    chipDispose?.()
    groupRow.get_children().forEach((c) => c.destroy())
    subRow.get_children().forEach((c) => c.destroy())
    const g = groupOf(filter)
    let subs: Category[] = []
    createRoot((dispose) => {
      chipDispose = dispose
      groupRow.add(chip(`${STAR} FAVOURITES`, favouritePaths().length, filter === "fav", () => setFilter("fav")))
      groupRow.add(chip("ALL", library.length, filter === "all", () => setFilter("all")))
      for (const c of groupsOf(library)) groupRow.add(chip(c.label, c.count, g === c.id, () => setFilter(c.id)))
      subs = filter === "fav" || filter === "all" ? [] : subsOf(library, g)
      if (subs.length) {
        const total = library.filter((w) => w.group === g).length
        subRow.add(chip("ALL", total, filter === g, () => setFilter(g)))
        for (const c of subs) subRow.add(chip(c.label, c.count, filter === c.id, () => setFilter(c.id)))
      }
    })
    groupRow.show_all()
    subRow.show_all()
    subRow.set_visible(subs.length > 0)
  }

  function setFilter(f: string, keep?: string) {
    filter = f
    walls = filtered(f)
    const idx = keep ? walls.indexOf(keep) : -1
    sel = pos = Math.max(0, idx)
    setSel(sel)
    buildChips()
    canvas.queue_draw()
  }

  function cycleGroup(step: number) {
    const cycle = filterCycle()
    const i = cycle.indexOf(filter === "fav" || filter === "all" ? filter : groupOf(filter))
    setFilter(cycle[(i + step + cycle.length) % cycle.length])
  }

  function cycleSub(step: number) {
    if (filter === "fav" || filter === "all") return
    const g = groupOf(filter)
    const ids = [g, ...subsOf(library, g).map((c) => c.id)]
    if (ids.length < 2) return
    const i = Math.max(0, ids.indexOf(filter))
    setFilter(ids[(i + step + ids.length) % ids.length])
  }

  function star() {
    const src = walls[sel]
    if (!src) return
    toggleFavourite(src)
    // Unstarring inside the favourites view drops it from the list
    if (filter === "fav") setFilter("fav", walls[sel + 1] ?? walls[sel - 1])
    else { buildChips(); updateTitle(); canvas.queue_draw() }
  }

  function reload() {
    placeBand()
    library = scanWallpapers()
    let current = ""
    // A static apply removes current-live.set, so if it exists a video is on
    try { current = GLib.file_read_link(CURRENT_LIVE_LINK) } catch {}
    if (!current) try { current = GLib.file_read_link(CURRENT_LINK) } catch {}
    // First open: favourites if there are any. Keep the last filter after that,
    // unless its category has since disappeared.
    const valid = filter === "fav" || filter === "all" || filtered(filter).length > 0
    if (!filter || !valid) filter = favouritePaths().length ? "fav" : "all"
    setFilter(filter, current)
  }

  wallpapersVisible.subscribe(() => { if (wallpapersVisible.get()) reload() })

  const key = (keyval: number): boolean => {
    switch (keyval) {
      case Gdk.KEY_Escape: setWallpapersVisible(false); return true
      case Gdk.KEY_Left: case Gdk.KEY_h: setSel(sel - 1); return true
      case Gdk.KEY_Right: case Gdk.KEY_l: setSel(sel + 1); return true
      case Gdk.KEY_Home: setSel(0); return true
      case Gdk.KEY_End: setSel(walls.length - 1); return true
      case Gdk.KEY_Return: case Gdk.KEY_KP_Enter: case Gdk.KEY_space: apply(sel); return true
      case Gdk.KEY_f: case Gdk.KEY_s: star(); return true
      case Gdk.KEY_Tab: cycleGroup(1); return true
      case Gdk.KEY_ISO_Left_Tab: cycleGroup(-1); return true
      case Gdk.KEY_Down: case Gdk.KEY_j: cycleSub(1); return true
      case Gdk.KEY_Up: case Gdk.KEY_k: cycleSub(-1); return true
    }
    return false
  }

  const spacer = (<box />) as Gtk.Box
  const widget = (
    <box name="wc-root" vertical valign={Gtk.Align.START} hexpand>
      {spacer}
      {canvas}
      <box vertical valign={Gtk.Align.START}>
        {title}
        {groupRow}
        {subRow}
        <label name="wc-hint" label="← → scroll · click to centre, click again or ⏎ to apply · f star · tab category · ↑↓ sub-category · esc" />
      </box>
    </box>
  ) as Gtk.Widget
  // Size the top spacer from the monitor height — never from any allocation,
  // which would feed back through the spacer — so the band is centred at
  // BAND_CENTRE of the screen regardless of what's under it.
  function placeBand() {
    const win = widget.get_window()
    if (!win) return
    const mon = win.get_display().get_monitor_at_window(win)
    const h = Math.max(0, Math.round(mon.get_geometry().height * BAND_CENTRE - px(BAND_H) / 2))
    if (spacer.get_size_request()[1] !== h) spacer.set_size_request(-1, h)
  }
  widget.connect("map", placeBand)

  return { widget, key }
}

export default function WallpaperCarouselWindow(gdkMonitor: number | any) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor
  const ui = WallpaperCarousel()
  const fit = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.EXTERNAL,
    hexpand: true, vexpand: true,
  })
  // EXTERNAL scrolling: the window takes the monitor's size instead of asking
  // for its content's (a wrapping FlowBox requests its height at one chip per
  // line, which made the layer taller than the screen).
  fit.add(ui.widget)
  fit.show_all()

  // The dimmed, blurred backdrop is its own layer so it can fade in slowly
  // while the strips (this window, no_anim) appear instantly. Hyprland fades
  // a layer's blur together with its alpha, but the fade speed is global, so
  // fadeLayersIn is stretched to BACKDROP_FADE just for this map and put back
  // afterwards (hypr/rules.lua has the matching layer rules).
  const [backdropVisible, setBackdropVisible] = createState(false)
  let restoreTimer = 0
  const setLayerFade = (speed: number) =>
    execAsync(["hyprctl", "eval",
      `hl.animation({ leaf = "fadeLayersIn", enabled = true, speed = ${speed}, bezier = "${speed === LAYER_FADE ? "default" : "carouselFade"}" })`])
      .catch((e) => print(`carousel: layer fade: ${e}`))
  wallpapersVisible.subscribe(() => {
    if (!wallpapersVisible.get()) { setBackdropVisible(false); return }
    setLayerFade(BACKDROP_FADE).finally(() => {
      if (!wallpapersVisible.get()) return
      setBackdropVisible(true)
      if (restoreTimer) GLib.source_remove(restoreTimer)
      restoreTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, BACKDROP_FADE * 100 + 500, () => {
        restoreTimer = 0
        setLayerFade(LAYER_FADE)
        return GLib.SOURCE_REMOVE
      })
    })
  })

  // Decoration only: click-through, so it can never swallow input meant for
  // the TOP-layer panels it shares a layer with (edge tab, bars).
  passThrough((
    <window
      name="wallpapers-backdrop"
      namespace="wallpapers-backdrop"
      visible={backdropVisible}
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      application={app}
      layer={Astal.Layer.TOP}
    >
      <box name="wc-backdrop" expand hexpand vexpand />
    </window>
  ) as Gtk.Window)

  return (
    <window
      name="wallpapers"
      namespace="wallpapers"
      visible={wallpapersVisible}
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => ui.key(event.get_keyval()[1])}
    >
      <box name="wc-overlay" expand hexpand vexpand>
        {fit}
      </box>
    </window>
  )
}

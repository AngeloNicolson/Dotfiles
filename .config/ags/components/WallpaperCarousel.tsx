// Wallpaper carousel — the hyprquickpaper look: a row of tall wallpaper strips,
// biggest in the middle and shrinking toward the edges, sliding smoothly as
// you scroll. Your colour themes sit underneath as a row of chips.
//
// Open: SUPER+W, `ags request toggle-wallpapers`, or 󰁌 on the CORE page.
// Keys: ←/→ or h/l move · Enter apply · Esc close. Mouse: scroll moves,
// click a strip to apply it, click empty space to close.
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
import { wallpapersVisible, setWallpapersVisible } from "../state"
import { getStaticWallpapers, applyStaticWallpaper } from "./WallpaperSelector"
import { listThemes, currentTheme, switchTheme } from "./ThemeSelector"
import { px } from "../scale"

const CACHE_DIR = GLib.get_user_cache_dir() + "/ags/wall-strips"
const CURRENT_LINK = GLib.get_home_dir() + "/.config/awww/current.set"
const STRIP_W = 360        // cached crop size (portrait)
const STRIP_H = 800
const VISIBLE_SIDE = 10    // strips drawn each side of the centre
const GAP = 10
const FONT = "JetBrainsMono Nerd Font"
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
  let walls: string[] = []
  const strips = new Map<string, GdkPixbuf.Pixbuf | null>()  // null = loading
  let sel = 0          // target index
  let pos = 0          // animated index (float)
  let hover = -1
  let animTimer = 0

  const canvas = new Gtk.DrawingArea()
  canvas.set_hexpand(true)
  canvas.set_size_request(-1, px(560))
  canvas.add_events(
    Gdk.EventMask.BUTTON_PRESS_MASK |
    Gdk.EventMask.POINTER_MOTION_MASK |
    Gdk.EventMask.SCROLL_MASK |
    Gdk.EventMask.SMOOTH_SCROLL_MASK |
    Gdk.EventMask.LEAVE_NOTIFY_MASK)
  canvas.show()

  const title = (<label name="wc-title" label="" />) as Gtk.Label
  const themeRow = (<box name="wc-themes" halign={Gtk.Align.CENTER} />) as Gtk.Box

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
      execAsync(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-frames:v", "1",
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
      const t = "NO WALLPAPERS — add images to ~/.config/ags/wallpapers"
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
    const name = walls[sel]?.split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
    title.set_label(name.replace(/[-_]+/g, " ").toUpperCase())
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
    applyStaticWallpaper(src)
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

  // ── Themes row ──
  let themeDispose: (() => void) | null = null
  function buildThemes() {
    themeDispose?.()
    themeRow.get_children().forEach((c) => c.destroy())
    createRoot((dispose) => {
      themeDispose = dispose
      const cur = currentTheme.get()
      for (const t of listThemes()) {
        themeRow.add(
          <button name="wc-theme" class={t.name === cur ? "active" : ""}
            onClicked={() => { switchTheme(t.name); GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => { buildThemes(); return GLib.SOURCE_REMOVE }) }}>
            <box spacing={8}>
              <label $={(self: Gtk.Label) => self.set_markup(`<span foreground="${t.colors.accent}">●</span>`)} />
              <label label={t.displayName.toUpperCase()} />
            </box>
          </button> as Gtk.Widget)
      }
    })
    themeRow.show_all()
  }

  function reload() {
    walls = getStaticWallpapers()
    let current = ""
    try { current = GLib.file_read_link(CURRENT_LINK) } catch {}
    const idx = Math.max(0, walls.indexOf(current))
    pos = idx
    setSel(idx)
    buildThemes()
    canvas.queue_draw()
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
    }
    return false
  }

  const widget = (
    <box name="wc-root" vertical valign={Gtk.Align.CENTER} vexpand hexpand>
      {canvas}
      {title}
      {themeRow}
      <label name="wc-hint" label="← → scroll · click to centre, click again or ⏎ to apply · esc" />
    </box>
  ) as Gtk.Widget

  return { widget, key }
}

export default function WallpaperCarouselWindow(gdkMonitor: number | any) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor
  const ui = WallpaperCarousel()

  return (
    <window
      name="wallpapers"
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
        {ui.widget}
      </box>
    </window>
  )
}

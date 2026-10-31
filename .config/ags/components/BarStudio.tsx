// Settings → Bar Studio: pick the bar style (FRAME / SHIELD) and tune
// the chosen one. Every change applies live and is remembered (ui-state.json).
// Also: `ags request bar-style <frame|shield>`.

import Gtk from "gi://Gtk?version=3.0"
import { createRoot } from "gnim"
import {
  barStyle, setBarStyle, type BarStyle,
  frameConfig, setFrameConfig, FRAME_DEFAULTS, type FrameConfig,
  shieldConfig, setShieldConfig, SHIELD_DEFAULTS, type ShieldConfig,
} from "../state"
import { px } from "../scale"

const STYLES: { id: BarStyle, label: string, desc: string }[] = [
  { id: "frame", label: "FRAME", desc: "A band round the desktop with a status rail" },
  { id: "shield", label: "SHIELD", desc: "Three pills on top with a Halo workspace compass" },
]

function colorOf(w: Gtk.Widget, name: string, alpha = 1): [number, number, number, number] {
  const [ok, c] = w.get_style_context().lookup_color(name)
  return ok ? [c.red, c.green, c.blue, alpha] : [0.85, 0.85, 0.85, alpha]
}

// Miniature of each style inside a screen outline.
function StyleDiagram(id: BarStyle) {
  const da = new Gtk.DrawingArea()
  da.set_size_request(px(200), px(110))
  da.connect("draw", (_w: any, cr: any) => {
    const W = da.get_allocated_width(), H = da.get_allocated_height()
    const fg = (a: number) => cr.setSourceRGBA(...colorOf(da, "fg", a))
    const win = (x: number, y: number, w: number, h: number) => { cr.rectangle(x, y, w, h); fg(0.14); cr.fill() }
    if (id === "frame") {
      cr.setFillRule(1) // EVEN_ODD: band with a hole
      cr.rectangle(0, 0, W, H)
      cr.rectangle(W * 0.09, 4, W * 0.89, H - 8)
      fg(0.3); cr.fill()
      cr.setFillRule(0)
      win(W * 0.11, 8, W * 0.85, H - 16)
      for (let i = 0; i < 4; i++) { cr.arc(W * 0.045, 12 + i * 8, 2, 0, 2 * Math.PI); fg(i === 0 ? 0.9 : 0.45); cr.fill() }
    } else {
      const sw = W * 0.5, sx = (W - sw) / 2, sh = 9
      cr.moveTo(sx, 3); cr.lineTo(sx + sw, 3); cr.lineTo(sx + sw - sh, 3 + sh); cr.lineTo(sx + sh, 3 + sh); cr.closePath()
      cr.setSourceRGBA(...colorOf(da, "accent", 0.85)); cr.fill()
      win(4, 18, W - 8, H - 22)
    }
    cr.rectangle(0.5, 0.5, W - 1, H - 1)
    cr.setSourceRGBA(...colorOf(da, "fg_dim", 0.6))
    cr.setLineWidth(1)
    cr.stroke()
    return false
  })
  da.show()
  return da
}

function rebuilder(box: Gtk.Box, build: () => void) {
  let dispose: (() => void) | null = null
  return () => {
    dispose?.()
    box.get_children().forEach((c) => c.destroy())
    createRoot((d) => { dispose = d; build() })
    box.show_all()
  }
}

function section(text: string) {
  return (<label name="st-section" label={text} xalign={0} />) as Gtk.Widget
}

function optionRow(title: string, desc: string, control: Gtk.Widget) {
  return (
    <box name="bs-row">
      <box vertical hexpand valign={Gtk.Align.CENTER}>
        <label name="bs-row-title" label={title} xalign={0} />
        <label name="bs-row-desc" label={desc} xalign={0} wrap />
      </box>
      {control}
    </box>
  ) as Gtk.Widget
}

function stepper(value: number, unit: string, step: number, min: number, max: number, set: (v: number) => void) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 100) / 100))
  return (
    <box name="bs-stepper" valign={Gtk.Align.CENTER}>
      <label name="bs-value" label={`${unit === "%" ? Math.round(value * 100) : value} ${unit}`} />
      <button name="bs-step-btn" onClicked={() => set(clamp(value - step))}><label label="−" /></button>
      <button name="bs-step-btn" onClicked={() => set(clamp(value + step))}><label label="+" /></button>
    </box>
  ) as Gtk.Widget
}

function chips<T extends string>(cur: T, opts: { id: T, label: string }[], set: (v: T) => void) {
  return (
    <box name="bs-chips" valign={Gtk.Align.CENTER}>
      {opts.map((o) => (
        <button name="bs-chip" class={o.id === cur ? "active" : ""} onClicked={() => set(o.id)}>
          <label label={o.label} />
        </button>
      ))}
    </box>
  ) as Gtk.Widget
}

export default function BarStudioPage() {
  const cards = (<box name="st-layout-row" homogeneous />) as Gtk.Box
  const options = (<box name="bs-options" vertical />) as Gtk.Box

  const buildCards = rebuilder(cards, () => {
    const cur = barStyle.get()
    for (const s of STYLES) {
      cards.add(
        <button name="st-layout-card" class={s.id === cur ? "active" : ""} onClicked={() => setBarStyle(s.id)}>
          <box vertical>
            {StyleDiagram(s.id)}
            <label name="st-layout-name" label={s.label} xalign={0} />
            <label name="st-layout-desc" label={s.desc} xalign={0} wrap />
          </box>
        </button> as Gtk.Widget)
    }
  })

  const buildOptions = rebuilder(options, () => {
    const style = barStyle.get()
    if (style === "frame") {
      const f = frameConfig.get()
      const set = (patch: Partial<FrameConfig>) => setFrameConfig(patch)
      options.add(section("FRAME"))
      options.add(optionRow("Frame thickness", "How thick the band round the top, right and bottom is.",
        stepper(f.thickness, "px", 1, 2, 24, (v) => set({ thickness: v }))))
      options.add(optionRow("Rail width", "Width of the left rail with workspaces, status and clock.",
        stepper(f.rail, "px", 2, 32, 80, (v) => set({ rail: v }))))
      options.add(optionRow("Corner radius", "How round the frame cuts the desktop's corners.",
        stepper(f.radius, "px", 2, 0, 40, (v) => set({ radius: v }))))
      options.add(optionRow("Opacity", "How solid the frame draws.",
        stepper(f.opacity, "%", 0.05, 0.2, 1, (v) => set({ opacity: v }))))
      options.add(
        <button name="bs-reset" halign={Gtk.Align.START} onClicked={() => setFrameConfig(FRAME_DEFAULTS)}>
          <label label="RESET TO DEFAULTS" />
        </button> as Gtk.Widget)
    } else if (style === "shield") {
      const s = shieldConfig.get()
      const set = (patch: Partial<ShieldConfig>) => setShieldConfig(patch)
      options.add(section("SHIELD"))
      options.add(optionRow("Colour", "Compass in classic Reach blue, or your current theme's colours.",
        chips(s.color, [{ id: "reach", label: "REACH" }, { id: "theme", label: "THEME" }], (v) => set({ color: v }))))
      options.add(
        <button name="bs-reset" halign={Gtk.Align.START} onClicked={() => setShieldConfig(SHIELD_DEFAULTS)}>
          <label label="RESET TO DEFAULTS" />
        </button> as Gtk.Widget)
    }
  })

  const unsubs: (() => void)[] = []
  const widget = (
    <box vertical name="st-barstudio">
      {section("BAR STYLE")}
      {cards}
      <label name="st-layout-hint" xalign={0} wrap
        label="Changes land live and are remembered." />
      {options}
    </box>
  ) as Gtk.Widget

  return {
    widget,
    start() {
      buildCards()
      buildOptions()
      unsubs.push(
        barStyle.subscribe(() => { buildCards(); buildOptions() }),
        frameConfig.subscribe(buildOptions),
        shieldConfig.subscribe(buildOptions),
      )
    },
    stop() {
      unsubs.splice(0).forEach((u) => u())
    },
  }
}

// Responsive-scaling unit for the whole shell.
//
// Every hardcoded pixel value in the UI was authored against this machine's
// display: eDP-1, 2560x1600 run at scale 1.25 → *logical* 2048x1280. GTK lays
// windows out in logical pixels, so the design baseline is that logical space and
// its short side, 1280px, is BASELINE_MIN.
//
// `U` is the ratio of the current display's logical short-side to that baseline.
// On this machine U === 1 (pixel-identical to before). On a 1920x1080 @ scale 1
// screen the short side is 1080 → U ≈ 0.84, so everything shrinks proportionally
// and keeps the same *fraction* of the screen. Multiply any baseline px by `U`
// (via px()/pxStr()) to get the value for the current display.
//
// Per-monitor sizing: app.apply_css() is global (one stylesheet for every
// window), so the stylesheet is built as a base copy scaled by `U` (the
// *smallest* connected monitor's factor) plus, for every other monitor size, a
// copy of the px-bearing rules scaled for it and scoped to a window class
// (`.ui-u169` etc.). Each AGS window carries the class of the monitor it's on
// (trackWindowScale), so a sidebar on a 4K TV is sized for the TV while the
// laptop's stays laptop-sized. JS px() values use `U` unless built inside withU().

import { getMonitors, getFocusedMonitor, gdkIndexFor, type MonitorInfo } from "./compositor"

// Logical short-side of the reference display (eDP-1 2560x1600 @ 1.25 = 2048x1280).
export const BASELINE_MIN = 1280

// Clamp so an unusually small/large panel can't produce absurd UI.
const MIN_U = 0.6
const MAX_U = 2.5

function logicalMinDim(mon: MonitorInfo): number {
  const scale = mon.scale || 1
  return Math.min(mon.width / scale, mon.height / scale)
}

function computeU(): number {
  try {
    const mons = getMonitors()
    const dims = (mons.length ? mons : [getFocusedMonitor()].filter(Boolean) as MonitorInfo[])
      .map(logicalMinDim).filter((d) => isFinite(d) && d > 0)
    if (dims.length === 0) return 1
    const u = Math.min(...dims) / BASELINE_MIN
    if (!isFinite(u) || u <= 0) return 1
    return Math.max(MIN_U, Math.min(MAX_U, u))
  } catch (e) {
    print(`scale: failed to compute U, defaulting to 1 (${e})`)
    return 1
  }
}

// Current scale factor. Mutable: updated by recomputeScale().
export let U = computeU()

type Listener = () => void
const listeners = new Set<Listener>()

// Subscribe to scale changes (e.g. to re-render a widget that sizes itself in JS
// rather than CSS). Returns an unsubscribe function.
export function onScaleChange(cb: Listener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// Recompute U from the connected monitors. Returns true if it changed (and
// fires listeners). Call this on monitor add/remove (focus changes are harmless).
export function recomputeScale(): boolean {
  const next = computeU()
  if (Math.abs(next - U) < 0.001) return false
  U = next
  listeners.forEach((cb) => {
    try {
      cb()
    } catch (e) {
      print(`scale: listener error (${e})`)
    }
  })
  return true
}

// Scale a baseline (eDP-1) pixel value to the current display.
export function px(n: number): number {
  return Math.round(n * U)
}

// Same as px() but as a CSS string, e.g. pxStr(48) -> "48px" (at U=1).
export function pxStr(n: number): string {
  return `${px(n)}px`
}

// ── Per-monitor factors ─────────────────────────────────────────────────────

export function uFor(mon: MonitorInfo): number {
  const u = logicalMinDim(mon) / BASELINE_MIN
  if (!isFinite(u) || u <= 0) return 1
  return Math.max(MIN_U, Math.min(MAX_U, u))
}

// Window class for a factor, e.g. 1.6875 → "ui-u169".
export function scaleClass(u: number): string {
  return `ui-u${Math.round(u * 100)}`
}

// Distinct factors of the connected monitors, excluding the base `U`.
export function extraFactors(): number[] {
  const out = new Set<number>()
  for (const m of getMonitors()) {
    const u = Math.round(uFor(m) * 100) / 100
    if (Math.abs(u - U) > 0.005) out.add(u)
  }
  return [...out]
}

// Run fn with px() temporarily using factor u (for widgets built for one monitor).
export function withU<T>(u: number, fn: () => T): T {
  const saved = U
  U = u
  try { return fn() } finally { U = saved }
}

function scalePxBy(css: string, u: number): string {
  if (u === 1) return css
  return css.replace(/(\d*\.?\d+)px/g, (_, num) => `${Math.round(parseFloat(num) * u)}px`)
}

// Copy of the px-bearing rules scaled by u and scoped to its window class.
// The stylesheet is flat `selectors { decls }` rules (no nesting/@-blocks), so a
// regex walk is enough. Colour-only rules are identical at any size — skipped.
export function scopedCss(css: string, u: number): string {
  const cls = scaleClass(u)
  const out: string[] = []
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "")
  for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim(), decls = m[2]
    if (!sel || sel.startsWith("@") || !/\dpx/.test(decls)) continue
    const scoped = sel.split(",").map((x) => {
      x = x.trim()
      return /^window\b/.test(x) ? x.replace(/^window/, `window.${cls}`) : `.${cls} ${x}`
    }).join(", ")
    out.push(`${scoped} {${scalePxBy(decls, u)}}`)
  }
  return out.join("\n")
}

// Keep a window's scale class in sync with the monitor it's on.
export function trackWindowScale(win: any) {
  let current = ""
  const update = () => {
    const idx = typeof win.monitor === "number" ? win.monitor : 0
    const mon = getMonitors().find((m) => gdkIndexFor(m) === idx)
    const next = mon && Math.abs(uFor(mon) - U) > 0.005 ? scaleClass(Math.round(uFor(mon) * 100) / 100) : ""
    if (next === current) return
    const ctx = win.get_style_context()
    if (current) ctx.remove_class(current)
    if (next) ctx.add_class(next)
    current = next
  }
  update()
  try { win.connect("notify::monitor", update) } catch {}
  scaleTracked.add(update)
}
const scaleTracked = new Set<() => void>()
// Re-evaluate every tracked window (after monitors/U change).
export function refreshWindowScales() { scaleTracked.forEach((f) => f()) }

// Scale every `<number>px` length in a CSS string by U. This is how the whole
// generated stylesheet becomes responsive without touching hundreds of literals:
// pass the generated CSS through this before app.apply_css(). At U=1 it returns
// the input unchanged (exact identity → zero regression on the baseline display).
// A leading `-` is left outside the match so negative margins keep their sign.
export function scaleCss(css: string): string {
  if (U === 1) return css
  return css.replace(/(\d*\.?\d+)px/g, (_, num) => `${Math.round(parseFloat(num) * U)}px`)
}

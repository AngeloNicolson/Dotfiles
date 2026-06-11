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
// Caveat: app.apply_css() is global (one stylesheet for every monitor), so on a
// multi-monitor setup `U` is taken from the focused monitor and recomputed when
// focus moves. There is no per-window stylesheet, so mixed-DPI monitors share one
// scale — the focused one wins.

import AstalHyprland from "gi://AstalHyprland"

// Logical short-side of the reference display (eDP-1 2560x1600 @ 1.25 = 2048x1280).
export const BASELINE_MIN = 1280

// Clamp so an unusually small/large panel can't produce absurd UI.
const MIN_U = 0.6
const MAX_U = 2.5

function logicalMinDim(mon: AstalHyprland.Monitor): number {
  const scale = mon.get_scale() || 1
  const w = mon.get_width() / scale
  const h = mon.get_height() / scale
  return Math.min(w, h)
}

function computeU(): number {
  try {
    const hypr = AstalHyprland.get_default()
    const mon = hypr.get_focused_monitor() || hypr.get_monitors()[0]
    if (!mon) return 1
    const u = logicalMinDim(mon) / BASELINE_MIN
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

// Recompute U from the focused monitor. Returns true if it changed (and fires
// listeners). Call this on monitor add/remove and focus change.
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

// Scale every `<number>px` length in a CSS string by U. This is how the whole
// generated stylesheet becomes responsive without touching hundreds of literals:
// pass the generated CSS through this before app.apply_css(). At U=1 it returns
// the input unchanged (exact identity → zero regression on the baseline display).
// A leading `-` is left outside the match so negative margins keep their sign.
export function scaleCss(css: string): string {
  if (U === 1) return css
  return css.replace(/(\d*\.?\d+)px/g, (_, num) => `${Math.round(parseFloat(num) * U)}px`)
}

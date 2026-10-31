// Theme colours for cairo-drawn widgets. Resolved through the widget's style
// context from the @define-color header theme.ts generates, so a drawing
// follows theme switches the same way the CSS does. Read them inside the draw
// callback (not at construction) so a theme change is picked up on redraw.
import Gtk from "gi://Gtk?version=3.0"

export type RGB = [number, number, number]
export type RGBA = [number, number, number, number]

export const THEME_COLOR_NAMES = [
  "bg", "bg_dark", "bg_light", "bg_lighter",
  "fg", "fg_dim", "fg_bright", "accent",
  "red", "red_bright", "green", "green_bright", "yellow", "yellow_bright",
  "blue", "blue_bright", "magenta", "magenta_bright", "cyan", "cyan_bright", "gray",
] as const
export type ThemeColorName = typeof THEME_COLOR_NAMES[number]
export type Palette = Record<ThemeColorName, RGB>

const FALLBACK: RGB = [0.05, 0.05, 0.05]

export function rgbOf(w: Gtk.Widget, name: string, fallback: RGB = FALLBACK): RGB {
  const [ok, c] = w.get_style_context().lookup_color(name)
  return ok ? [c.red, c.green, c.blue] : fallback
}

export function rgbaOf(w: Gtk.Widget, name: string, alpha = 1, fallback: RGB = FALLBACK): RGBA {
  return [...rgbOf(w, name, fallback), alpha]
}

// Every theme colour at once, for draw callbacks that use several.
export function paletteOf(w: Gtk.Widget): Palette {
  const p = {} as Palette
  for (const n of THEME_COLOR_NAMES) p[n] = rgbOf(w, n)
  return p
}

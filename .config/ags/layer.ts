// Layer-shell window helpers shared by the bar styles.

import Gtk from "gi://Gtk?version=3.0"
import cairo from "cairo"

// Decoration only: an empty input region makes the window fully click- and
// hover-through. The full-screen backdrop taking the pointer (in the gaps
// between windows) broke Hyprland's focus-follows-mouse.
export function passThrough(win: Gtk.Window): Gtk.Window {
  const apply = () => {
    try { win.input_shape_combine_region(new cairo.Region()) }
    catch (e) { console.error("frame: input region failed:", e) }
  }
  win.connect("realize", apply)
  win.connect("map", apply)
  if (win.get_realized()) apply()
  return win
}


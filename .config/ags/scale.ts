import { Gdk } from "ags/gtk3"

// Reference resolution (designed for)
const REF_HEIGHT = 1600

// Get primary monitor height
function getMonitorHeight(): number {
  const display = Gdk.Display.get_default()
  if (!display) return REF_HEIGHT
  const monitor = display.get_primary_monitor() || display.get_monitor(0)
  if (!monitor) return REF_HEIGHT
  const geo = monitor.get_geometry()
  return geo.height
}

const monitorHeight = getMonitorHeight()
const SCALE_FACTOR = monitorHeight / REF_HEIGHT

/** Scale a pixel value relative to the reference 1600p height */
export function s(px: number): number {
  return Math.round(px * SCALE_FACTOR)
}

/** Get the raw scale factor */
export function getScale(): number {
  return SCALE_FACTOR
}

/** Generate scaled CSS overrides */
export function getScaledCSS(): string {
  if (SCALE_FACTOR === 1) return ""

  return `
    * { font-size: ${s(14)}px; }
    .bar { min-width: ${s(48)}px; padding: ${s(8)}px; }
    .time-indicator { min-width: ${s(32)}px; padding: ${s(8)}px; border-radius: ${s(8)}px; }
    .bar-edge { min-height: ${s(100)}px; }
    #quick-toggle { min-width: ${s(64)}px; min-height: ${s(64)}px; max-width: ${s(64)}px; max-height: ${s(64)}px; }
    #toggle-icon { font-size: ${s(28)}px; }
    #battery-icon { font-size: ${s(24)}px; }
    #battery-level { font-size: ${s(18)}px; }
    #wallpaper-thumb image { min-width: ${s(280)}px; min-height: ${s(175)}px; }
    #wallpaper-empty { padding: ${s(40)}px ${s(20)}px; }
    #wallpaper-empty #status-icon { font-size: ${s(48)}px; }
    #element-cell { min-width: ${s(42)}px; min-height: ${s(42)}px; max-width: ${s(42)}px; max-height: ${s(42)}px; }
    #element-cell-empty { min-width: ${s(42)}px; min-height: ${s(42)}px; max-width: ${s(42)}px; max-height: ${s(42)}px; }
    #series-label { min-width: ${s(28)}px; min-height: ${s(42)}px; }
    #power-bar-frame { min-width: ${s(200)}px; }
    #power-big-percent { font-size: ${s(64)}px; }
    #periodic-title { font-size: ${s(16)}px; }
  `
}

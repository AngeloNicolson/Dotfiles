import app from "ags/gtk3/app"
import { createState } from "ags"
import {
  toggleBar, cyclePage, cyclePageBack, removeSidebarStack,
  toggleDestination, toggleGalaxy, togglePeriodicTable, toggleDisplays, toggleBluetoothWindow, toggleWallpapers, toggleSettings, getSidebarStacks,
} from "./state"
import { initTheme, applyTheme, reapplyCss } from "./theme"
import { recomputeScale, uFor, withU, trackWindowScale, refreshWindowScales } from "./scale"
import * as compositor from "./compositor"
import Bar from "./components/Bar"
import DestinationWindow from "./components/DestinationWindow"
import GalaxyWindow from "./components/GalaxyWindow"
import PeriodicTableWindow from "./components/PeriodicTableWindow"
import BreakPopupWindow from "./components/BreakPopupWindow"
import WorkspaceOsdWindow from "./components/WorkspaceOsd"
import DisplayLayoutWindow from "./components/DisplayLayout"
import BluetoothWindow from "./components/BluetoothWindow"
import WallpaperCarouselWindow from "./components/WallpaperCarousel"
import SettingsWindow from "./components/SettingsWindow"

// `ags request <cmd> [args...]` handlers. Adding a command = adding an entry;
// `ags request help` lists them all.
const commands: Record<string, (args: string[]) => string> = {
  "toggle-bar": () => {
    toggleBar()
    return "toggled"
  },
  "cycle-sidebar": () => {
    cyclePage()
    return "cycled"
  },
  "cycle-sidebar-back": () => {
    cyclePageBack()
    return "cycled back"
  },
  "toggle-destination": () => {
    toggleDestination()
    return "destination toggled"
  },
  "toggle-galaxy": () => {
    toggleGalaxy()
    return "galaxy toggled"
  },
  "toggle-periodic-table": () => {
    togglePeriodicTable()
    return "periodic table toggled"
  },
  "toggle-displays": () => {
    toggleDisplays()
    return "displays toggled"
  },
  "toggle-bluetooth": () => {
    toggleBluetoothWindow()
    return "bluetooth toggled"
  },
  "toggle-wallpapers": () => {
    toggleWallpapers()
    return "wallpapers toggled"
  },
  "toggle-settings": ([page]) => {
    toggleSettings(page)
    return page ? `settings: ${page}` : "settings toggled"
  },
  "debug-stacks": () =>
    `Registered stacks: ${JSON.stringify(Array.from(getSidebarStacks().keys()))}`,
  "theme": ([themeName]) => {
    if (!themeName) return "usage: theme <name>"
    applyTheme(themeName)
    return `theme set to ${themeName}`
  },
  "help": () => `commands: ${Object.keys(commands).sort().join(", ")}`,
}

app.start({
  requestHandler(request: string[], response: (res: string) => void) {
    const [cmd, ...args] = request
    if (!cmd) {
      response("no command provided")
      return
    }
    const handler = commands[cmd]
    response(handler ? handler(args) : `unknown command: ${cmd} (try: help)`)
  },
  main() {
    initTheme()

    // GDK index of the focused monitor — overlays bind to this so they always
    // appear on the screen the user is looking at, not a hardcoded monitor 0.
    const [overlayMonitor, setOverlayMonitor] = createState(0)
    const updateOverlayMonitor = () => {
      const focused = compositor.getFocusedMonitor()
      if (focused) setOverlayMonitor(compositor.gdkIndexFor(focused))
    }

    // Recompute the display scale (U) from the focused monitor and re-apply the
    // rescaled stylesheet if it changed.
    // Monitors changed: the base factor and/or the set of per-monitor sizes
    // may have changed, so rebuild the stylesheet and re-tag windows.
    const updateScale = () => {
      recomputeScale()
      reapplyCss()
      refreshWindowScales()
    }

    // Track bars by monitor name (stable identifier)
    const bars: Map<string, any> = new Map()

    // Sync bars with current monitors
    const syncBars = () => {
      // Destroy all existing bars and recreate them
      // GDK monitor indices can shift when monitors are added/removed
      bars.forEach((bar, name) => {
        bar.destroy()
        removeSidebarStack(name)
      })
      bars.clear()

      // Create bars for all current monitors
      compositor.getMonitors().forEach((mon) => {
        const gdkIndex = compositor.gdkIndexFor(mon)
        console.log(`Creating bar for monitor: ${mon.name} (gdk index: ${gdkIndex})`)
        // Built with this monitor's factor (JS px values) and tagged so the
        // stylesheet's per-size copy applies to it.
        const bar = withU(uFor(mon), () => Bar(gdkIndex, mon.name))
        trackWindowScale(bar)
        bars.set(mon.name, bar)
      })

      console.log(`Active bars: ${Array.from(bars.keys()).join(", ")}`)
    }

    // Update which bar is visible based on focus
    const updateBarVisibility = () => {
      // Single monitor - just show it
      if (bars.size <= 1) {
        bars.forEach(bar => bar.visible = true)
        return
      }

      const focusedName = compositor.getFocusedMonitorName()
      if (!focusedName) {
        bars.forEach(bar => bar.visible = true)
        return
      }

      bars.forEach((bar, name) => {
        bar.visible = name === focusedName
      })
    }

    compositor.onMonitorsChanged(() => {
      console.log("Monitor layout changed")
      syncBars()
      updateBarVisibility()
      updateScale()
      updateOverlayMonitor()
    })

    compositor.onFocusChanged(() => {
      updateBarVisibility()
      updateOverlayMonitor()
    })

    // Initial setup
    // Recompute U from the now-ready focused monitor before anything is built.
    // initTheme() above ran at import-time U (which falls back to 1 if the
    // monitor dims weren't populated yet); without this, a single-monitor machine
    // that just boots never fires monitor-added/focus events, so U would stay 1 and
    // the whole UI would render at full baseline size (too large on smaller screens).
    updateScale()
    syncBars()
    updateBarVisibility()
    updateOverlayMonitor()

    // Overlay windows follow the focused monitor (reactive index) instead of
    // being pinned to monitor 0.
    // Every overlay follows a monitor; keep its size class in sync with it.
    trackWindowScale(DestinationWindow(overlayMonitor))
    trackWindowScale(GalaxyWindow(overlayMonitor))
    trackWindowScale(PeriodicTableWindow(overlayMonitor))
    trackWindowScale(BreakPopupWindow(overlayMonitor))
    trackWindowScale(WorkspaceOsdWindow(overlayMonitor))
    trackWindowScale(DisplayLayoutWindow(overlayMonitor))
    trackWindowScale(BluetoothWindow(overlayMonitor))
    trackWindowScale(WallpaperCarouselWindow(overlayMonitor))
    trackWindowScale(SettingsWindow(overlayMonitor))
  },
})

import app from "ags/gtk3/app"
import { createState } from "ags"
import { toggleBar, cyclePage, cyclePageBack, removeSidebarStack, toggleDestination, toggleGalaxy, togglePeriodicTable } from "./state"
import { initTheme, applyTheme, reapplyCss } from "./theme"
import { recomputeScale } from "./scale"
import Bar from "./components/Bar"
import DestinationWindow from "./components/DestinationWindow"
import GalaxyWindow from "./components/GalaxyWindow"
import PeriodicTableWindow from "./components/PeriodicTableWindow"
import BreakPopupWindow from "./components/BreakPopupWindow"
import WorkspaceOsdWindow from "./components/WorkspaceOsd"
import AstalHyprland from "gi://AstalHyprland"
import { Gdk } from "ags/gtk3"

app.start({
  requestHandler(request: string[], response: (res: string) => void) {
    const cmd = request[0]
    if (!cmd) {
      response("no command provided")
      return
    }
    if (cmd === "toggle-bar") {
      print("app.tsx: calling toggleBar")
      toggleBar()
      response("toggled")
    } else if (cmd === "cycle-sidebar") {
      cyclePage()
      response("cycled")
    } else if (cmd === "cycle-sidebar-back") {
      cyclePageBack()
      response("cycled back")
    } else if (cmd === "toggle-destination") {
      toggleDestination()
      response("destination toggled")
    } else if (cmd === "toggle-galaxy") {
      toggleGalaxy()
      response("galaxy toggled")
    } else if (cmd === "toggle-periodic-table") {
      togglePeriodicTable()
      response("periodic table toggled")
    } else if (cmd === "debug-stacks") {
      const { getSidebarStacks } = require("./state")
      const stacks = getSidebarStacks()
      response(`Registered stacks: ${JSON.stringify(Array.from(stacks.keys()))}`)
    } else if (cmd === "theme") {
      const themeName = request[1]
      if (themeName) {
        applyTheme(themeName)
        response(`theme set to ${themeName}`)
      } else {
        response("usage: theme <name>")
      }
    } else {
      response(`unknown command: ${cmd}`)
    }
  },
  main() {
    initTheme()

    const display = Gdk.Display.get_default()
    const hyprland = AstalHyprland.get_default()

    // Map a Hyprland monitor to its GDK monitor index by matching the logical
    // origin (x,y). Robust across machines — replaces the old assumption that GDK
    // indices are simply the reverse of Hyprland's order.
    const gdkIndexForHypr = (mon: AstalHyprland.Monitor): number => {
      const n = display?.get_n_monitors() ?? 1
      const hx = mon.get_x()
      const hy = mon.get_y()
      for (let i = 0; i < n; i++) {
        const gm = display?.get_monitor(i)
        if (!gm) continue
        const g = gm.get_geometry()
        if (g.x === hx && g.y === hy) return i
      }
      return 0
    }

    // GDK index of the focused monitor — overlays bind to this so they always
    // appear on the screen the user is looking at, not a hardcoded monitor 0.
    const [overlayMonitor, setOverlayMonitor] = createState(0)
    const updateOverlayMonitor = () => {
      const focused = hyprland.get_focused_monitor()
        || hyprland.get_focused_workspace()?.get_monitor()
        || hyprland.get_monitors()[0]
      if (focused) setOverlayMonitor(gdkIndexForHypr(focused))
    }

    // Recompute the display scale (U) from the focused monitor and re-apply the
    // rescaled stylesheet if it changed.
    const updateScale = () => {
      if (recomputeScale()) reapplyCss()
    }

    // Track bars by monitor name (stable identifier)
    const bars: Map<string, any> = new Map()

    // Sync bars with current monitors
    const syncBars = () => {
      const hyprMonitors = hyprland.get_monitors()

      // Destroy all existing bars and recreate them
      // GDK monitor indices can shift when monitors are added/removed
      bars.forEach((bar, name) => {
        bar.destroy()
        removeSidebarStack(name)
      })
      bars.clear()

      // Create bars for all current monitors
      hyprMonitors.forEach((mon) => {
        const name = mon.get_name()
        const gdkIndex = gdkIndexForHypr(mon)
        console.log(`Creating bar for monitor: ${name} (gdk index: ${gdkIndex})`)
        bars.set(name, Bar(gdkIndex, name))
      })

      console.log(`Active bars: ${Array.from(bars.keys()).join(", ")}`)
    }

    // Update which bar is visible based on focus
    const updateBarVisibility = () => {
      const numMonitors = display?.get_n_monitors() || 1

      // Single monitor - just show it
      if (numMonitors <= 1) {
        bars.forEach(bar => bar.visible = true)
        return
      }

      const focusedWorkspace = hyprland.get_focused_workspace()
      const focusedMonitor = focusedWorkspace?.get_monitor()

      if (!focusedMonitor) {
        bars.forEach(bar => bar.visible = true)
        return
      }

      const focusedName = focusedMonitor.get_name()

      bars.forEach((bar, name) => {
        bar.visible = name === focusedName
      })
    }

    // Listen for monitor changes from Hyprland
    hyprland.connect("monitor-added", (_hypr, mon) => {
      console.log(`Monitor added: ${mon.get_name()}`)
      syncBars()
      updateBarVisibility()
      updateScale()
      updateOverlayMonitor()
    })

    hyprland.connect("monitor-removed", (_hypr, name) => {
      console.log(`Monitor removed: ${name}`)
      syncBars()
      updateBarVisibility()
      updateScale()
      updateOverlayMonitor()
    })

    hyprland.connect("notify::focused-workspace", () => {
      updateBarVisibility()
      updateScale()
      updateOverlayMonitor()
    })

    // Initial setup
    // Recompute U from the now-ready focused monitor before anything is built.
    // initTheme() above ran at import-time U (which falls back to 1 if Hyprland's
    // monitor dims weren't populated yet); without this, a single-monitor machine
    // that just boots never fires monitor-added/focus events, so U would stay 1 and
    // the whole UI would render at full baseline size (too large on smaller screens).
    updateScale()
    syncBars()
    updateBarVisibility()
    updateOverlayMonitor()

    // Overlay windows follow the focused monitor (reactive index) instead of
    // being pinned to monitor 0.
    DestinationWindow(overlayMonitor)
    GalaxyWindow(overlayMonitor)
    PeriodicTableWindow(overlayMonitor)
    BreakPopupWindow(overlayMonitor)
    WorkspaceOsdWindow(overlayMonitor)
  },
})

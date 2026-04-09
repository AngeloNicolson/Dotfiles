import app from "ags/gtk3/app"
import Gtk from "gi://Gtk?version=3.0"
import { toggleBar, cyclePage, cyclePageBack, removeSidebarStack, toggleDestination, toggleGalaxy, togglePeriodicTable } from "./state"
import { initTheme, applyTheme } from "./theme"
import { getScaledCSS, getScale } from "./scale"
import Bar from "./components/Bar"
import DestinationWindow from "./components/DestinationWindow"
import GalaxyWindow from "./components/GalaxyWindow"
import PeriodicTableWindow from "./components/PeriodicTableWindow"
import BreakPopupWindow from "./components/BreakPopupWindow"
import TaskPopupWindow from "./components/TaskPopupWindow"
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

    // Apply responsive scaling CSS
    const scaledCSS = getScaledCSS()
    if (scaledCSS) {
      const cssProvider = new Gtk.CssProvider()
      cssProvider.load_from_data(scaledCSS, scaledCSS.length)
      Gtk.StyleContext.add_provider_for_screen(
        Gdk.Screen.get_default()!,
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1,
      )
      print(`AGS: Scale factor ${getScale().toFixed(2)} applied`)
    }

    const display = Gdk.Display.get_default()
    const hyprland = AstalHyprland.get_default()

    // Track bars by monitor name (stable identifier)
    const bars: Map<string, any> = new Map()

    // Sync bars with current monitors
    const syncBars = () => {
      const hyprMonitors = hyprland.get_monitors()

      // Get current monitor names
      const currentMonitors = new Set<string>()
      hyprMonitors.forEach(mon => {
        currentMonitors.add(mon.get_name())
      })

      // Remove bars for disconnected monitors
      bars.forEach((bar, name) => {
        if (!currentMonitors.has(name)) {
          console.log(`Removing bar for disconnected monitor: ${name}`)
          bar.destroy()
          bars.delete(name)
          removeSidebarStack(name)
        }
      })

      // Add bars for new monitors
      hyprMonitors.forEach((mon, idx) => {
        const name = mon.get_name()
        if (!bars.has(name)) {
          // GDK monitor index is typically reversed from Hyprland order
          const numMonitors = display?.get_n_monitors() || 1
          const gdkIndex = numMonitors > 1 ? (numMonitors - 1) - idx : 0
          console.log(`Creating bar for monitor: ${name} (gdk index: ${gdkIndex})`)
          bars.set(name, Bar(gdkIndex, name))
        }
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
    })

    hyprland.connect("monitor-removed", (_hypr, name) => {
      console.log(`Monitor removed: ${name}`)
      syncBars()
      updateBarVisibility()
    })

    hyprland.connect("notify::focused-workspace", updateBarVisibility)

    // Initial setup
    syncBars()
    updateBarVisibility()

    // Create destination menu and galaxy overlay windows on primary monitor
    DestinationWindow(0)
    GalaxyWindow(0)
    PeriodicTableWindow(0)
    BreakPopupWindow(0)
    TaskPopupWindow(0)
  },
})

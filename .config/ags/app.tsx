import app from "ags/gtk3/app"
import { toggleBar, cyclePage } from "./state"
import { initTheme, applyTheme } from "./theme"
import Bar from "./components/Bar"
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
      toggleBar()
      response("toggled")
    } else if (cmd === "cycle-sidebar") {
      cyclePage()
      response("cycled")
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
          bars.set(name, Bar(gdkIndex))
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
  },
})

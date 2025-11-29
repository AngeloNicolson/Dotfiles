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

    // Create bars for all monitors
    const display = Gdk.Display.get_default()
    const hyprland = AstalHyprland.get_default()
    const bars: Map<string, any> = new Map()
    let numMonitors = 0

    if (display) {
      numMonitors = display.get_n_monitors()
      for (let i = 0; i < numMonitors; i++) {
        bars.set(`gdk-${i}`, Bar(i))
      }
    }

    // Map Hyprland monitor IDs to GDK indices (inverted)
    const hyprMonitors = hyprland.get_monitors()
    const monitorMap: Map<number, number> = new Map()

    hyprMonitors.forEach((mon, idx) => {
      // Invert the mapping: Hyprland ID to opposite GDK index
      const gdkIndex = (numMonitors - 1) - idx
      monitorMap.set(mon.get_id(), gdkIndex)
    })

    // Track focused monitor and show/hide bars accordingly
    const updateBarVisibility = () => {
      const focusedWorkspace = hyprland.get_focused_workspace()
      if (!focusedWorkspace) return

      const focusedMonitor = focusedWorkspace.get_monitor()
      if (!focusedMonitor) return

      const hyprId = focusedMonitor.get_id()
      const gdkIndex = monitorMap.get(hyprId)

      bars.forEach((bar, key) => {
        const barIndex = parseInt(key.replace('gdk-', ''))
        bar.visible = barIndex === gdkIndex
      })
    }

    hyprland.connect("notify::focused-workspace", updateBarVisibility)
    updateBarVisibility()
  },
})

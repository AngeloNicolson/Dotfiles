import app from "ags/gtk3/app"
import { toggleBar, cyclePage } from "./state"
import { initTheme, applyTheme } from "./theme"
import Bar from "./components/Bar"

app.start({
  requestHandler(request: string[], response: (res: string) => void) {
    const cmd = request[0]
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
    Bar(0)
  },
})

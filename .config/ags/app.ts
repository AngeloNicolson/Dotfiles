import app from "ags/gtk3/app"
import style from "./style.scss"
import Bar, { toggleBar, cycleSidebarPage } from "./widget/Bar"

app.start({
  css: style,
  main() {
    app.get_monitors().map(Bar)
  },
  requestHandler(request: string[], res: (response: string) => void) {
    const cmd = request[0]
    if (cmd === "toggle-bar") {
      toggleBar()
      res("toggled")
    } else if (cmd === "cycle-sidebar") {
      cycleSidebarPage()
      res("cycled")
    } else {
      res(`unknown request: ${cmd}`)
    }
  },
})

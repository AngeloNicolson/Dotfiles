import { createState } from "ags"
import Home from "./Home"
import AppLauncher from "./AppLauncher"
import Wallpapers from "./Wallpapers"
import Pomodoro from "./Pomodoro"

type Page = "home" | "applauncher" | "wallpapers" | "pomodoro"

export const [sidebarPage, setSidebarPage] = createState<Page>("home")
export const [sidebarVisible, setSidebarVisible] = createState(false)

export function toggleSidebar() {
  setSidebarVisible(!sidebarVisible.get())
  if (!sidebarVisible.get()) {
    setSidebarPage("home")
  }
}

export function showPage(page: Page) {
  setSidebarPage(page)
  setSidebarVisible(true)
}

export default function Sidebar() {
  const closeSidebar = () => {
    setSidebarVisible(false)
    setSidebarPage("home")
  }

  return (
    <revealer
      revealChild={sidebarVisible}
      transitionType="slide_right"
      transitionDuration={300}
    >
      <box class="sidebar">
        <box visible={sidebarPage((p) => p === "home")}>
          <Home />
        </box>
        <box visible={sidebarPage((p) => p === "applauncher")}>
          <AppLauncher onClose={closeSidebar} />
        </box>
        <box visible={sidebarPage((p) => p === "wallpapers")}>
          <Wallpapers onClose={closeSidebar} />
        </box>
        <box visible={sidebarPage((p) => p === "pomodoro")}>
          <Pomodoro onClose={closeSidebar} />
        </box>
      </box>
    </revealer>
  )
}

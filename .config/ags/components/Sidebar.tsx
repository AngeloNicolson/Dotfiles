import Gtk from "gi://Gtk?version=3.0"
import { setSidebarStack, getPageState, setPage } from "../state"
import Home from "./Home"
import Planner from "./Planner"
import AppLauncher from "./AppLauncher"
import PowerIndicator from "./PowerIndicator"
import WallpaperSelector from "./WallpaperSelector"
import Pomodoro, { secondsRemaining, phase } from "./Pomodoro"

const tabs = [
  { id: "page1", icon: "", label: "HOME" },
  { id: "page2", icon: "", label: "PLAN" },
  { id: "page3", icon: "", label: "POMO" },
  { id: "page4", icon: "", label: "APPS" },
  { id: "page5", icon: "", label: "WALL" },
  { id: "page6", icon: "", label: "PWR" },
]

export default function Sidebar({ monitorName }: { monitorName: string }) {
  // Use shared state so cycling and clicking stay in sync
  const [activePage] = getPageState(monitorName)

  const stack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.SLIDE_RIGHT,
    transition_duration: 300,
  })

  const homePage = <Home />
  const powerPage = <PowerIndicator />
  const plannerPage = <Planner />
  const appPage = <AppLauncher />

  const wallpaperPage = <WallpaperSelector />
  const pomodoroPage = <Pomodoro />

  stack.add_named(homePage, "page1")
  stack.add_named(plannerPage, "page2")
  stack.add_named(pomodoroPage, "page3")
  stack.add_named(appPage, "page4")
  stack.add_named(wallpaperPage, "page5")
  stack.add_named(powerPage, "page6")
  stack.set_visible_child_name("page1")
  stack.show_all()

  // Register stack using the stable monitor name
  setSidebarStack(monitorName, stack)

  return (
    <box name="sidebar-bg" vertical>
      {/* Tab bar */}
      <box name="tab-bar">
        {tabs.map((tab) => (
          <button
            name="tab-btn"
            class={activePage.as((p) => p === tab.id ? "active" : "")}
            onClicked={() => setPage(monitorName, tab.id)}
          >
            <box vertical>
              <label name="tab-icon" label={tab.icon} />
              <label name="tab-label" label={tab.id === "page3"
                ? secondsRemaining.as((s) => {
                    const p = phase.get()
                    if (p === "idle") return "POMO"
                    const m = Math.floor(s / 60)
                    const sec = s % 60
                    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
                  })
                : tab.label
              } />
            </box>
          </button>
        ))}
      </box>
      {/* Page content */}
      {stack}
    </box>
  )
}

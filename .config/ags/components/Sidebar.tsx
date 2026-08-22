import Gtk from "gi://Gtk?version=3.0"
import { setSidebarStack, getPageState, setPage, focusedPage, toggleFocusedPage } from "../state"
import { PAGES } from "../pages"
import Home from "./Home"
import Planner from "./Planner"
import AppLauncher from "./AppLauncher"
import PowerIndicator from "./PowerIndicator"
import WallpaperSelector from "./WallpaperSelector"
import Pomodoro, { secondsRemaining, phase } from "./Pomodoro"

// Page id -> component. Page order/labels live in pages.ts.
function buildPage(id: string): Gtk.Widget {
  switch (id) {
    case "home": {
      const homeScroll = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.EXTERNAL,
      })
      homeScroll.add(<Home />)
      homeScroll.set_name("home-page-scroll")
      return homeScroll
    }
    case "planner": return <Planner />
    case "pomodoro": return <Pomodoro />
    case "apps": return <AppLauncher />
    case "core": return <WallpaperSelector />
    case "power": return <PowerIndicator />
    default: return <box />
  }
}

export default function Sidebar({ monitorName }: { monitorName: string }) {
  // Use shared state so cycling and clicking stay in sync
  const [activePage] = getPageState(monitorName)

  const stack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.SLIDE_RIGHT,
    transition_duration: 300,
  })

  PAGES.forEach((page) => stack.add_named(buildPage(page.id), page.id))
  stack.set_visible_child_name(PAGES[0].id)
  stack.show_all()

  // Register stack using the stable monitor name
  setSidebarStack(monitorName, stack)

  return (
    <box name="sidebar-bg" vertical>
      {/* Tab bar */}
      <box name="tab-bar">
        {PAGES.map((tab) => (
          <box vertical>
            <button
              name="tab-btn"
              class={activePage.as((p) => p === tab.id ? "active" : "")}
              onClicked={() => setPage(monitorName, tab.id)}
            >
              <box vertical>
                <label name="tab-icon" label={tab.icon} />
                <label name="tab-label" label={tab.id === "pomodoro"
                  ? secondsRemaining.as((s) => {
                      const p = phase.get()
                      if (p === "idle") return tab.label
                      const m = Math.floor(s / 60)
                      const sec = s % 60
                      return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
                    })
                  : tab.label
                } />
              </box>
            </button>
            <button
              name="tab-focus-btn"
              class={focusedPage.as((p) => p === tab.id ? "focused" : "")}
              onClicked={() => toggleFocusedPage(tab.id)}
            >
              <label label="FOCUS" />
            </button>
          </box>
        ))}
      </box>
      {/* Page content */}
      {stack}
    </box>
  )
}

import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { exec, execAsync } from "ags/process"
import { createState } from "ags"
import { createPoll } from "../utils/poll"
import AstalHyprland from "gi://AstalHyprland"
import Sidebar, { toggleSidebar, showPage, sidebarVisible, sidebarPage, setSidebarVisible, setSidebarPage } from "./Sidebar"
import AudioControls from "./AudioControls"
import Calendar from "./Calendar"

const hyprland = AstalHyprland.get_default()

const [barVisible, setBarVisible] = createState(false)

export function toggleBar() {
  const isVisible = barVisible.get()
  setBarVisible(!isVisible)

  // When closing the bar, also close the sidebar
  if (isVisible) {
    setSidebarVisible(false)
    setSidebarPage("home")
  }
}

export function cycleSidebarPage() {
  const pages = ["home", "applauncher", "wallpapers", "pomodoro"] as const
  const currentPage = sidebarPage.get()
  const currentIndex = pages.indexOf(currentPage)
  const nextIndex = (currentIndex + 1) % pages.length

  setSidebarVisible(true)
  setSidebarPage(pages[nextIndex])
}

function Workspaces() {
  const workspaces = Array.from({ length: 7 }, (_, i) => i + 1)

  return (
    <box class="workspaces" vertical spacing={4}>
      {workspaces.map((id) => (
        <button
          class="workspace"
          halign={Gtk.Align.CENTER}
          onClicked={() => hyprland.dispatch("workspace", id.toString())}
          $={(self) => {
            self.connect("realize", () => {
              const updateActive = () => {
                const isActive = hyprland.get_focused_workspace()?.get_id() === id
                self.toggleClassName("active", isActive)
              }
              hyprland.connect("notify::focused-workspace", updateActive)
              updateActive()
            })
          }}
        >
          <label label=" " />
        </button>
      ))}
    </box>
  )
}

function TimeIndicator() {
  const [calendarVisible, setCalendarVisible] = createState(false)

  const time = createPoll("", 1000, () => {
    const date = new Date()
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    return `${hours}\n${minutes}`
  })

  return (
    <box vertical>
      <button
        class="time-indicator"
        halign={Gtk.Align.CENTER}
        onClicked={() => setCalendarVisible(!calendarVisible.get())}
      >
        <label label={time} />
      </button>
      <box visible={calendarVisible}>
        <Calendar />
      </box>
    </box>
  )
}

function AudioControl() {
  const [menuVisible, setMenuVisible] = createState(false)

  return (
    <box vertical>
      <button
        class="audio-control-button"
        onClicked={() => setMenuVisible(!menuVisible.get())}
      >
        <label label="󰋎" />
      </button>
      <box visible={menuVisible}>
        <AudioControls />
      </box>
    </box>
  )
}

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor

  // Capture keyboard when sidebar is open with app launcher/wallpapers/pomodoro
  const keymode = sidebarVisible((visible) => {
    if (!visible) return "none"
    const page = sidebarPage.get()
    if (page === "applauncher" || page === "wallpapers" || page === "pomodoro") {
      return "exclusive"
    }
    return "none"
  })

  return (
    <window
      class="Bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={TOP | LEFT | BOTTOM}
      application={app}
      keymode={keymode}
    >
      <box>
        <Sidebar />
        <revealer
          revealChild={barVisible}
          transitionType="slide_right"
          transitionDuration={300}
        >
          <box class="bar" vertical>
            <box class="start" valign={Gtk.Align.START} vertical spacing={4}>
              <button
                class="sidebar-button"
                onClicked={() => toggleSidebar()}
              >
                <box css={`background-image: url("/home/${exec("whoami")}/.face.icon"); background-size: cover; min-width: 32px; min-height: 32px; border-radius: 50%;`} />
              </button>
              <box class="divider" />
              <button
                class="search-button"
                onClicked={() => showPage("applauncher")}
              >
                <label label="" />
              </button>
              <button
                class="wallpaper-button"
                onClicked={() => showPage("wallpapers")}
              >
                <label label="󰸉" />
              </button>
              <button
                class="pomodoro-button"
                onClicked={() => showPage("pomodoro")}
              >
                <label label="" />
              </button>
            </box>

            <box class="center" valign={Gtk.Align.CENTER} vertical>
              <Workspaces />
            </box>

            <box class="end" valign={Gtk.Align.END} vertical spacing={4}>
              <box class="controls" halign={Gtk.Align.CENTER} vertical>
                <AudioControl />
                <button class="system-control-button">
                  <label label="" />
                </button>
                <button
                  class="screenshot-button"
                  onClicked={() => execAsync("bash -c ~/.config/hypr/scripts/screenshot.sh p")}
                >
                  <label label="󰄄" />
                </button>
              </box>
              <TimeIndicator />
            </box>
          </box>
        </revealer>
        <eventbox onButtonPressEvent={() => toggleBar()}>
          <box class="bar-edge" />
        </eventbox>
      </box>
    </window>
  )
}

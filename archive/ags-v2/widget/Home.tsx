import { Gtk } from "ags/gtk3"
import { exec, execAsync } from "ags/process"
import { createPoll } from "../utils/poll"
import { createState, createBinding } from "ags"
import MusicPlayer from "./MusicPlayer"
import NotificationCenter from "./NotificationCenter"
import AstalWp from "gi://AstalWp"

const audio = AstalWp.get_default()

function UserHeader() {
  const username = exec("whoami")
  const [powerMenuVisible, setPowerMenuVisible] = createState(false)

  const PowerMenuButton = (icon: string, action: () => void) => (
    <button
      onClicked={() => {
        setPowerMenuVisible(false)
        action()
      }}
    >
      <icon icon={icon} css="font-size: 18px;" />
    </button>
  )

  return (
    <box class="user_box" spacing={12}>
      <box
        class="face"
        css={`background-image: url("/home/${username}/.face.icon");`}
      />
      <box class="details" vertical valign={Gtk.Align.CENTER} spacing={2}>
        <label class="username" label={username} xalign={0} />
        <label class="wm" label="HYPRLAND" xalign={0} />
      </box>
      <box hexpand halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
        <button
          class="shutdown_button"
          onClicked={() => setPowerMenuVisible(!powerMenuVisible.get())}
        >
          <label label="󰐥" />
        </button>
        <box class="power_menu" spacing={8} visible={powerMenuVisible((v) => v)}>
          {PowerMenuButton("system-shutdown-symbolic", () =>
            execAsync("systemctl poweroff")
          )}
          {PowerMenuButton("view-refresh-symbolic", () =>
            execAsync("systemctl reboot")
          )}
          {PowerMenuButton("weather-clear-night-symbolic", () =>
            execAsync("systemctl suspend && hyprlock")
          )}
          {PowerMenuButton("application-exit-symbolic", () =>
            execAsync("pkill Hyprland")
          )}
        </box>
      </box>
    </box>
  )
}

function DesktopControls() {
  const speaker = audio?.get_default_speaker()

  if (!speaker) return null

  const volume = createBinding(speaker, "volume")

  return (
    <box class="desktop_controls" vertical spacing={12}>
      <box class="sliders" vertical spacing={8}>
        <box class="slider_row" spacing={12}>
          <label class="icon" label="󰕾" />
          <slider
            class="slider"
            hexpand
            drawValue={false}
            min={0}
            max={1}
            value={volume}
            onDragged={({ value }) => (speaker.volume = value)}
          />
        </box>
      </box>
    </box>
  )
}

function TimeCard() {
  const time = createPoll("", 1000, () => {
    const now = new Date()
    return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  })

  const date = createPoll("", 60000, () => {
    const now = new Date()
    return now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  })

  return (
    <box class="time_card" vertical>
      <label class="time" label={time((t) => t)} />
      <label class="date" label={date((d) => d)} />
    </box>
  )
}

export default function Home() {
  return (
    <box class="home" vertical>
      <UserHeader />
      <DesktopControls />
      <TimeCard />
      <MusicPlayer />
      <NotificationCenter />
    </box>
  )
}

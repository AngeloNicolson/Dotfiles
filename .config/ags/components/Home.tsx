import { createPoll } from "ags/time"
import { createState, type State } from "ags"
import { execAsync } from "ags/process"
import { createBinding, type Accessor } from "gnim"
import Network from "gi://AstalNetwork"
import Gtk from "gi://Gtk?version=3.0"
import Bluetooth from "gi://AstalBluetooth"
import Wp from "gi://AstalWp"
import { togglePeriodicTable, sidebarPinned, setSidebarPinned } from "../state"
import AudioEQ, { toggleHwMute, localMuted } from "./AudioEQ"
import DisplayEQ from "./DisplayEQ"

// System toggle button - Star Citizen style
function SystemToggle({
  active,
  label,
  onClick,
}: {
  active: Accessor<boolean> | State<boolean>,
  label: string,
  onClick: () => void,
}) {
  return (
    <button
      name="sys-toggle"
      class={active.as((a) => a ? "active" : "")}
      onClicked={onClick}
    >
      <label name="sys-toggle-label" label={label} />
    </button>
  )
}

// Time display - styled as main panel
function Clock() {
  const localTime = createPoll("00:00", 1000, () => {
    const now = new Date()
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Pacific/Auckland",
    })
  })

  const date = createPoll("", 60000, () => {
    const now = new Date()
    return now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).toUpperCase()
  })

  const tennesseeTime = createPoll("00:00", 1000, () => {
    const now = new Date()
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Chicago",
    })
  })

  return (
    <box name="clock-panel" vertical>
      <label name="clock-time" label={localTime} />
      <label name="clock-date" label={date} />
      <box name="clock-secondary">
        <label name="clock-alt-label" label="NSH" />
        <box hexpand />
        <label name="clock-alt-time" label={tennesseeTime} />
      </box>
    </box>
  )
}

// WiFi toggle
function WiFiToggle() {
  const network = Network.get_default()
  const wifi = network?.wifi
  const [wifiOn, setWifiOn] = createState(wifi?.enabled ?? false)

  return (
    <SystemToggle
      active={wifiOn}
      label="WIFI"
      onClick={() => {
        if (wifi) {
          const newState = !wifiOn.get()
          setWifiOn(newState)
          wifi.enabled = newState
        }
      }}
    />
  )
}

// Bluetooth toggle
function BluetoothToggle() {
  const bluetooth = Bluetooth.get_default()
  const adapter = bluetooth?.adapter
  const [btOn, setBtOn] = createState(adapter?.powered ?? false)

  return (
    <SystemToggle
      active={btOn}
      label="BT"
      onClick={() => {
        const newState = !btOn.get()
        setBtOn(newState)
        execAsync(`bluetoothctl power ${newState ? "on" : "off"}`).catch(() => {
          setBtOn(!newState)
        })
      }}
    />
  )
}

// DND toggle
function DNDToggle() {
  const [dndOn, setDndOn] = createState(false)
  execAsync("dunstctl is-paused")
    .then((out) => setDndOn(out.trim() === "true"))
    .catch(() => {})

  return (
    <SystemToggle
      active={dndOn}
      label="DND"
      onClick={() => {
        execAsync("dunstctl set-paused toggle").catch(() => {})
        setDndOn(!dndOn.get())
      }}
    />
  )
}

// Night Light toggle
function NightLightToggle() {
  const [nightOn, setNightOn] = createState(false)
  execAsync("pgrep gammastep").then(() => setNightOn(true)).catch(() => {})

  return (
    <SystemToggle
      active={nightOn}
      label="NITE"
      onClick={() => {
        if (nightOn.get()) {
          execAsync("pkill gammastep")
          setNightOn(false)
        } else {
          execAsync(["bash", "-c", "gammastep -O 4500 &"])
          setNightOn(true)
        }
      }}
    />
  )
}


// Tool button for launching popups
function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: string,
  label: string,
  onClick: () => void,
}) {
  return (
    <button name="tool-btn" onClicked={onClick}>
      <box vertical>
        <label name="tool-btn-icon" label={icon} />
        <label name="tool-btn-label" label={label} />
      </box>
    </button>
  )
}

export default function Home() {
  return (
    <box vertical name="home-page">
      {/* Section header */}
      <label name="section-header" label="//SYSTEMS" />

      {/* System toggles row */}
      <box name="sys-toggles-row" $={(self) => {
        const flow = new Gtk.FlowBox({
          selection_mode: Gtk.SelectionMode.NONE,
          homogeneous: true,
          row_spacing: 4,
          column_spacing: 4,
          max_children_per_line: 5,
          min_children_per_line: 3,
        })
        const toggles = [
          <SystemToggle
            active={sidebarPinned}
            label="DOCK"
            onClick={() => setSidebarPinned(!sidebarPinned.get())}
          />,
          <WiFiToggle />,
          <BluetoothToggle />,
          <DNDToggle />,
          <NightLightToggle />,
          <SystemToggle
            active={localMuted}
            label="MUTE"
            onClick={toggleHwMute}
          />,
        ]
        for (const t of toggles) flow.add(t)
        flow.show_all()
        self.pack_start(flow, true, true, 0)
      }} />

      {/* Clock panel */}
      <Clock />

      {/* EQ control panels */}
      <AudioEQ />
      <DisplayEQ />

      {/* Tools section */}
      <label name="section-header" label="//TOOLS" />
      <box name="tools-row">
        <ToolButton icon="" label="PTABLE" onClick={togglePeriodicTable} />
      </box>

    </box>
  )
}

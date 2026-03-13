import { createPoll } from "ags/time"
import { createState, type State } from "ags"
import { execAsync } from "ags/process"
import { createBinding, type Accessor } from "gnim"
import Network from "gi://AstalNetwork"
import Gtk from "gi://Gtk?version=3.0"
import Bluetooth from "gi://AstalBluetooth"
import Wp from "gi://AstalWp"
import { sidebarPinned, setSidebarPinned } from "../state"
import AudioEQ, { toggleHwMute, localMuted } from "./AudioEQ"
import DisplayEQ, { applyProfile, activeProfile } from "./DisplayEQ"
import VoiceControl, { toggleMicMute, micMuted } from "./VoiceControl"

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
          if (newState) {
            // Reconnect to last known WiFi network after radio comes up
            execAsync(["bash", "-c", "sleep 2 && nmcli -t -f NAME,TYPE connection show --order recent | grep ':802-11-wireless$' | head -1 | cut -d: -f1"])
              .then((name) => {
                const ssid = name.trim()
                if (ssid) execAsync(["nmcli", "connection", "up", ssid]).catch(() => {})
              })
              .catch(() => {})
          }
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

// Night Light toggle — uses DisplayEQ "night" profile
function NightLightToggle() {
  const nightOn = activeProfile.as((p) => p === "night")

  return (
    <SystemToggle
      active={nightOn}
      label="NITE"
      onClick={() => {
        if (activeProfile.get() === "night") {
          applyProfile("default")
        } else {
          applyProfile("night")
        }
      }}
    />
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
          <SystemToggle
            active={micMuted}
            label="MIC"
            onClick={toggleMicMute}
          />,
        ]
        for (const t of toggles) flow.add(t)
        flow.show_all()
        self.pack_start(flow, true, true, 0)
      }} />

      {/* Clock panel */}
      <Clock />

      {/* Audio/Voice toggle panel */}
      {(() => {
        const [showVoice, setShowVoice] = createState(false)
        const audioPanel = <AudioEQ />
        const voicePanel = <VoiceControl />
        const stack = new Gtk.Stack({
          transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
          transition_duration: 200,
        })
        stack.add_named(audioPanel, "audio")
        stack.add_named(voicePanel, "voice")
        stack.set_visible_child_name("audio")
        stack.show_all()

        return (
          <box vertical>
            <box name="eq-tab-bar">
              <button name="eq-tab-btn" hexpand
                class={showVoice.as((v) => v ? "" : "active")}
                onClicked={() => { setShowVoice(false); stack.set_visible_child_name("audio") }}
              >
                <label name="eq-tab-label" label="AUDIO" />
              </button>
              <button name="eq-tab-btn" hexpand
                class={showVoice.as((v) => v ? "active" : "")}
                onClicked={() => { setShowVoice(true); stack.set_visible_child_name("voice") }}
              >
                <label name="eq-tab-label" label="VOICE" />
              </button>
            </box>
            {stack}
          </box>
        )
      })()}
      <DisplayEQ />

    </box>
  )
}

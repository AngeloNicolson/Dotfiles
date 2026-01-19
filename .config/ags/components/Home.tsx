import { createPoll } from "ags/time"
import { createState, type State } from "ags"
import { execAsync } from "ags/process"
import { createBinding, type Accessor } from "gnim"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import Wp from "gi://AstalWp"

// System toggle button - Star Citizen style
function SystemToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: Accessor<boolean> | State<boolean>,
  icon: string,
  label: string,
  onClick: () => void,
}) {
  return (
    <button
      name="sys-toggle"
      class={active.as((a) => a ? "active" : "")}
      onClicked={onClick}
    >
      <box vertical>
        <label name="sys-toggle-icon" label={icon} />
        <label name="sys-toggle-label" label={label} />
      </box>
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
      icon=""
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
      icon=""
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
      icon=""
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
      icon=""
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

// Volume control bar
function VolumeControl() {
  const wp = Wp.get_default()
  const speaker = wp?.audio?.defaultSpeaker

  if (!speaker) {
    return (
      <box name="control-panel" vertical>
        <box name="control-header">
          <label name="control-label" label="//AUDIO" />
          <box hexpand />
          <label name="control-value" label="--%" />
        </box>
        <box name="control-bar">
          <box name="control-bar-fill" hexpand={false} />
        </box>
      </box>
    )
  }

  const muted = createBinding(speaker, "mute")
  const volume = createBinding(speaker, "volume")

  return (
    <box name="control-panel" vertical>
      <box name="control-header">
        <button
          name="control-icon-btn"
          onClicked={() => { speaker.mute = !speaker.mute }}
        >
          <label name="control-icon" label={muted.as((m) => m ? "" : "")} />
        </button>
        <label name="control-label" label="AUDIO" />
        <box hexpand />
        <label name="control-value" label={volume.as((v) => `${Math.round(v * 100)}%`)} />
      </box>
      <box name="control-bar-container">
        {Array(20).fill(0).map((_, i) => (
          <button
            name="control-segment"
            class={volume.as((v) => i < Math.round(v * 20) ? "lit" : "unlit")}
            onClicked={() => { speaker.volume = (i + 1) / 20 }}
          />
        ))}
      </box>
    </box>
  )
}

// Brightness control bar
function BrightnessControl() {
  const brightness = createPoll(1, 1000, () => {
    return execAsync("brightnessctl -d intel_backlight get")
      .then((current) => {
        return execAsync("brightnessctl -d intel_backlight max").then((max) => {
          return parseInt(current) / parseInt(max)
        })
      })
      .catch(() => 1)
  })

  const setBrightness = (val: number) => {
    const percent = Math.round(val * 100)
    execAsync(`brightnessctl -d intel_backlight set ${percent}%`).catch(() => {})
  }

  return (
    <box name="control-panel" vertical>
      <box name="control-header">
        <label name="control-icon" label="" />
        <label name="control-label" label="DISPLAY" />
        <box hexpand />
        <label name="control-value" label={brightness.as((b) => `${Math.round(b * 100)}%`)} />
      </box>
      <box name="control-bar-container">
        {Array(20).fill(0).map((_, i) => (
          <button
            name="control-segment"
            class={brightness.as((b) => i < Math.round(b * 20) ? "lit" : "unlit")}
            onClicked={() => setBrightness((i + 1) / 20)}
          />
        ))}
      </box>
    </box>
  )
}

// Battery status panel
function BatteryPanel() {
  const batteryLevel = createPoll(100, 5000, () => {
    return execAsync("cat /sys/class/power_supply/BAT0/capacity")
      .then((out) => parseInt(out.trim()))
      .catch(() => 100)
  })

  const batteryStatus = createPoll("Unknown", 5000, () => {
    return execAsync("cat /sys/class/power_supply/BAT0/status")
      .then((out) => out.trim())
      .catch(() => "Unknown")
  })

  return (
    <box name="status-panel">
      <label name="status-icon" label={batteryStatus.as((s) => s === "Charging" ? "" : "")} />
      <label name="status-label" label="PWR" />
      <box hexpand />
      <label name="status-value" label={batteryLevel.as((l) => `${l}%`)} />
      <label
        name="status-indicator"
        label={batteryStatus.as((s) => s === "Charging" ? "CHG" : s === "Discharging" ? "ACT" : "RDY")}
      />
    </box>
  )
}

export default function Home() {
  return (
    <box vertical name="home-page">
      {/* Section header */}
      <label name="section-header" label="//SYSTEMS" />

      {/* System toggles row */}
      <box name="sys-toggles-row">
        <WiFiToggle />
        <BluetoothToggle />
        <DNDToggle />
        <NightLightToggle />
      </box>

      {/* Clock panel */}
      <Clock />

      {/* Control bars */}
      <BrightnessControl />
      <VolumeControl />

      {/* Status bar */}
      <BatteryPanel />
    </box>
  )
}

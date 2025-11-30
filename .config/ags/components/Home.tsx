import { createPoll } from "ags/time"
import { createState, type State } from "ags"
import { execAsync } from "ags/process"
import { createBinding, type Accessor } from "gnim"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import Wp from "gi://AstalWp"
import Astal from "gi://Astal?version=3.0"
import Gtk from "gi://Gtk?version=3.0"

// Helper to create a circular toggle button with label underneath
function ToggleButton({
  active,
  icon,
  label,
  onClick,
  onLabelClick
}: {
  active: Accessor<boolean> | State<boolean>,
  icon: string,
  label: string,
  onClick: () => void,
  onLabelClick?: () => void
}) {
  return (
    <box name="toggle-container" vertical>
      <button
        name="quick-toggle"
        class={active.as((a) => a ? "active" : "")}
        onClicked={onClick}
      >
        <icon name="toggle-icon" icon={icon} />
      </button>
      {onLabelClick ? (
        <button name="toggle-label-btn" onClicked={onLabelClick}>
          <label name="toggle-label" label={label} />
        </button>
      ) : (
        <label name="toggle-label" label={label} />
      )}
    </box>
  )
}

// Time display
function Clock() {
  const localTime = createPoll("00:00", 1000, () => {
    const now = new Date()
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Pacific/Auckland", // NZ
    })
  })

  const tennesseeTime = createPoll("00:00", 1000, () => {
    const now = new Date()
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Chicago", // Nashville, TN
    })
  })

  const date = createPoll("", 60000, () => {
    const now = new Date()
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
  })

  return (
    <box vertical>
      <label name="clock" label={localTime} />
      <label name="date" label={date} />
      <box vertical name="secondary-clock-box">
        <label name="clock-secondary" label={tennesseeTime} />
        <label name="clock-location" label="Nashville" />
      </box>
    </box>
  )
}

// WiFi toggle
function WiFiToggle() {
  const network = Network.get_default()
  const wifi = network?.wifi

  if (!wifi) {
    return (
      <button name="quick-toggle" onClicked={() => {}}>
        <box>
          <label name="toggle-icon" label="" />
          <label name="toggle-label" label="No WiFi" />
        </box>
      </button>
    )
  }

  const ssid = wifi.ssid || "WiFi"
  const [wifiOn, setWifiOn] = createState(wifi.enabled)

  return (
    <ToggleButton
      active={wifiOn}
      icon="network-wireless-symbolic"
      label={ssid}
      onClick={() => {
        const newState = !wifiOn.get()
        setWifiOn(newState)
        wifi.enabled = newState
      }}
      onLabelClick={() => {
        execAsync("nm-connection-editor").catch(() => {})
      }}
    />
  )
}

// Bluetooth toggle
function BluetoothToggle() {
  const bluetooth = Bluetooth.get_default()
  const adapter = bluetooth?.adapter

  if (!adapter) {
    return (
      <button name="quick-toggle" onClicked={() => {}}>
        <box>
          <label name="toggle-icon" label="" />
          <label name="toggle-label" label="No BT" />
        </box>
      </button>
    )
  }

  const [btOn, setBtOn] = createState(adapter.powered)

  return (
    <ToggleButton
      active={btOn}
      icon="bluetooth-symbolic"
      label="Bluetooth"
      onClick={() => {
        const newState = !btOn.get()
        setBtOn(newState)
        execAsync(`bluetoothctl power ${newState ? "on" : "off"}`).catch(() => {
          setBtOn(!newState)
        })
      }}
      onLabelClick={() => {
        execAsync("blueberry").catch(() => {})
      }}
    />
  )
}

// Volume slider with reactive binding
function VolumeSlider() {
  const wp = Wp.get_default()
  const speaker = wp?.audio?.defaultSpeaker

  if (!speaker) {
    return (
      <box name="slider-box">
        <label name="slider-icon" label="" />
        <label label="No audio" />
      </box>
    )
  }

  const muted = createBinding(speaker, "mute")
  const volume = createBinding(speaker, "volume")

  // Create mute button with class toggling
  const muteBtn = new Astal.Button({
    name: "slider-icon-btn",
    visible: true,
  })

  const ctx = muteBtn.get_style_context()
  muted.subscribe((m: boolean) => {
    if (m) ctx.add_class("active")
    else ctx.remove_class("active")
  })
  if (muted.get()) ctx.add_class("active")

  muteBtn.connect("clicked", () => { speaker.mute = !speaker.mute })

  return (
    <box name="slider-box">
      {muteBtn}
      <label
        name="slider-icon"
        label={muted.as((m) => m ? "" : "")}
      />
      <slider
        name="volume-slider"
        hexpand
        value={volume}
        onDragged={(self) => {
          speaker.volume = self.value
        }}
      />
    </box>
  )
}

// Brightness slider
function BrightnessSlider() {
  const brightness = createPoll(1, 1000, () => {
    return execAsync("brightnessctl get")
      .then((current) => {
        return execAsync("brightnessctl max").then((max) => {
          return parseInt(current) / parseInt(max)
        })
      })
      .catch(() => 1)
  })

  return (
    <box name="slider-box">
      <label name="slider-icon" label="" />
      <slider
        name="brightness-slider"
        hexpand
        value={brightness}
        onDragged={(self) => {
          const percent = Math.round(self.value * 100)
          execAsync(`brightnessctl set ${percent}%`).catch(() => {})
        }}
      />
    </box>
  )
}

// DND toggle
function DNDToggle() {
  const [dndOn, setDndOn] = createState(false)

  // Check initial state once
  execAsync("dunstctl is-paused")
    .then((out) => setDndOn(out.trim() === "true"))
    .catch(() => {})

  return (
    <ToggleButton
      active={dndOn}
      icon="notifications-disabled-symbolic"
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

  // Check initial state once
  execAsync("pgrep gammastep").then(() => setNightOn(true)).catch(() => {})

  return (
    <ToggleButton
      active={nightOn}
      icon="night-light-symbolic"
      label="Night Light"
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

export default function Home() {
  return (
    <box vertical name="page-box">
      <Clock />
      <box name="quick-toggles-row">
        <WiFiToggle />
        <BluetoothToggle />
      </box>
      <box name="quick-toggles-row">
        <DNDToggle />
        <NightLightToggle />
      </box>
      <box vertical name="sliders-box">
        <VolumeSlider />
        <BrightnessSlider />
      </box>
    </box>
  )
}

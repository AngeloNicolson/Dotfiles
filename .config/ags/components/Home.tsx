import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { createBinding } from "gnim"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import Wp from "gi://AstalWp"

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

  const enabled = createBinding(wifi, "enabled")
  const ssid = createBinding(wifi, "ssid")

  return (
    <button
      name="quick-toggle"
      css={enabled.as((e) => e ? "background: #d79921;" : "")}
      onClicked={() => {
        wifi.enabled = !wifi.enabled
      }}
    >
      <box>
        <label name="toggle-icon" label={enabled.as((e) => e ? "" : "")} />
        <label name="toggle-label" label={ssid.as((s) => s || "WiFi")} />
      </box>
    </button>
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

  const powered = createBinding(adapter, "powered")

  return (
    <button
      name="quick-toggle"
      css={powered.as((p) => p ? "background: #d79921;" : "")}
      onClicked={() => {
        adapter.powered = !adapter.powered
      }}
    >
      <box>
        <label name="toggle-icon" label="" />
        <label name="toggle-label" label="Bluetooth" />
      </box>
    </button>
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

  return (
    <box name="slider-box">
      <button
        name="slider-icon-btn"
        css={muted.as((m) => m ? "background: #d79921; border-radius: 4px;" : "background: transparent;")}
        onClicked={() => {
          speaker.mute = !speaker.mute
        }}
      >
        <label
          name="slider-icon"
          label={muted.as((m) => m ? "" : "")}
        />
      </button>
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

// DND toggle - polls dunst state
function DNDToggle() {
  const dndState = createPoll(false, 2000, () => {
    return execAsync("dunstctl is-paused")
      .then((out) => out.trim() === "true")
      .catch(() => false)
  })

  return (
    <button
      name="quick-toggle"
      css={dndState.as((on) => on ? "background: #d79921;" : "")}
      onClicked={() => {
        execAsync("dunstctl set-paused toggle").catch(() => {})
      }}
    >
      <box>
        <label name="toggle-icon" label="" />
        <label name="toggle-label" label="DND" />
      </box>
    </button>
  )
}

// Night Light toggle - checks if gammastep is running
function NightLightToggle() {
  const nightState = createPoll(false, 2000, () => {
    return execAsync("pgrep gammastep")
      .then(() => true)
      .catch(() => false)
  })

  return (
    <button
      name="quick-toggle"
      css={nightState.as((on) => on ? "background: #d79921;" : "")}
      onClicked={() => {
        execAsync("pgrep gammastep")
          .then(() => execAsync("pkill gammastep"))
          .catch(() => execAsync("gammastep &"))
      }}
    >
      <box>
        <label name="toggle-icon" label="" />
        <label name="toggle-label" label="Night Light" />
      </box>
    </button>
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

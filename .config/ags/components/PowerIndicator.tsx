import { createPoll } from "ags/time"
import { execAsync } from "ags/process"

export default function PowerIndicator() {
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

  const acPlugged = createPoll(false, 5000, () => {
    return execAsync("cat /sys/class/power_supply/AC/online")
      .then((out) => out.trim() === "1")
      .catch(() => false)
  })

  const powerProfile = createPoll("balanced", 5000, () => {
    return execAsync("powerprofilesctl get")
      .then((out) => out.trim())
      .catch(() => "balanced")
  })

  const batteryHealth = createPoll(100, 60000, () => {
    return Promise.all([
      execAsync("cat /sys/class/power_supply/BAT0/charge_full"),
      execAsync("cat /sys/class/power_supply/BAT0/charge_full_design")
    ]).then(([full, design]) => {
      const health = Math.round((parseInt(full) / parseInt(design)) * 100)
      return health
    }).catch(() => 100)
  })

  const cycleCount = createPoll(0, 60000, () => {
    return execAsync("cat /sys/class/power_supply/BAT0/cycle_count")
      .then((out) => parseInt(out.trim()))
      .catch(() => 0)
  })

  return (
    <box name="power-page" vertical>
      <box name="power-panel" vertical>
        {/* Header */}
        <box name="power-panel-header">
          <label name="power-panel-title" label="POWER // INDICATOR" />
          <box hexpand />
          <label name="power-panel-data" label={batteryHealth.as((h) => `H:${h}%`)} />
        </box>

        {/* Main vertical bar container - centered */}
        <box hexpand>
          <box hexpand />
          <box name="power-bar-container">
            {/* Scale markers on the side */}
            <box name="power-scale" vertical>
              <label name="power-scale-mark" label="100" />
              <box vexpand />
              <label name="power-scale-mark" label="50" />
              <box vexpand />
              <label name="power-scale-mark" label="0" />
            </box>

            {/* Vertical bar with segments */}
            <box name="power-bar-frame" vertical>
              <box name="power-segments" vertical>
                {Array(10).fill(0).map((_, i) => {
                  const segmentIndex = 9 - i
                  return (
                    <box
                      name="power-segment"
                      class={batteryLevel.as((l) => {
                        const threshold = (segmentIndex + 1) * 10
                        return l >= threshold ? "lit" : "unlit"
                      })}
                      vexpand
                      hexpand
                    />
                  )
                })}
              </box>
            </box>

            {/* Right side indicators */}
            <box name="power-indicators" vertical>
              <label
                name="power-indicator"
                label={acPlugged.as((p) => p ? "▶ AC" : "● BAT")}
              />
              <box vexpand />
              <label
                name="power-indicator"
                label={powerProfile.as((p) => p === "performance" ? "PERF" : p === "power-saver" ? "SAVE" : "BAL")}
              />
              <box vexpand />
              <label
                name="power-indicator"
                label={cycleCount.as((c) => `C:${c}`)}
              />
            </box>
          </box>
          <box hexpand />
        </box>

        {/* Large percentage display */}
        <label
          name="power-big-percent"
          label={batteryLevel.as((l) => `${l}%`)}
        />

        {/* Bottom data row */}
        <box name="power-panel-footer">
          <label name="power-footer-data" label={batteryStatus.as((s) =>
            s === "Charging" ? "CHARGING" : s === "Discharging" ? "ACTIVE" : "STANDBY"
          )} />
          <box hexpand />
          <label name="power-footer-data" label="PWR-01" />
        </box>
      </box>
    </box>
  )
}

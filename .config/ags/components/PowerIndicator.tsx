import { createPoll } from "ags/time"
import { execAsync, createSubprocess } from "ags/process"

export default function PowerIndicator() {
  const bat = createSubprocess(
    { level: 100, status: "Unknown", ac: false, health: 100, cycles: 0, watts: "--W", time: "--" },
    ["bash", "-c", 'while true; do read -r cap < /sys/class/power_supply/BAT0/capacity; read -r st < /sys/class/power_supply/BAT0/status; read -r ac < /sys/class/power_supply/AC/online; read -r vo < /sys/class/power_supply/BAT0/voltage_now; read -r cu < /sys/class/power_supply/BAT0/current_now; read -r cn < /sys/class/power_supply/BAT0/charge_now; read -r cf < /sys/class/power_supply/BAT0/charge_full; read -r cfd < /sys/class/power_supply/BAT0/charge_full_design; read -r cc < /sys/class/power_supply/BAT0/cycle_count; echo "$cap|$st|$ac|$vo|$cu|$cn|$cf|$cfd|$cc"; sleep 5; done'],
    (line) => {
      const [cap, st, ac, vo, cu, cn, cf, cfd, cc] = line.split("|")
      const level = parseInt(cap) || 0
      const status = st || "Unknown"
      const v = parseInt(vo) || 0
      const c = parseInt(cu) || 0
      const watts = (v * c) / 1e12
      let time = "--"
      if (c > 0) {
        let hours = 0
        if (status === "Discharging") hours = parseInt(cn) / c
        else if (status === "Charging") hours = (parseInt(cf) - parseInt(cn)) / c
        if (hours > 0) {
          const h = Math.floor(hours)
          const m = Math.round((hours - h) * 60)
          time = `${h}h${m.toString().padStart(2, "0")}m`
        }
      }
      return {
        level,
        status,
        ac: ac === "1",
        health: Math.round((parseInt(cf) / parseInt(cfd)) * 100) || 100,
        cycles: parseInt(cc) || 0,
        watts: watts > 0 ? `${watts.toFixed(1)}W` : "0W",
        time,
      }
    },
  )

  const powerProfile = createPoll("balanced", 5000, () => {
    return execAsync("powerprofilesctl get")
      .then((out) => out.trim())
      .catch(() => "balanced")
  })

  return (
    <box name="power-page" vertical>
      <box name="power-panel" vertical>
        {/* Header */}
        <box name="power-panel-header">
          <label name="power-panel-title" label="POWER // INDICATOR" />
          <box hexpand />
          <label name="power-panel-data" label={bat.as((d) => `H:${d.health}%`)} />
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
                      class={bat.as((d) => {
                        const threshold = (segmentIndex + 1) * 10
                        return d.level >= threshold ? "lit" : "unlit"
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
                label={bat.as((d) => d.ac ? "▶ AC" : "● BAT")}
              />
              <box vexpand />
              <label
                name="power-indicator"
                label={powerProfile.as((p) => p === "performance" ? "PERF" : p === "power-saver" ? "SAVE" : "BAL")}
              />
              <box vexpand />
              <label
                name="power-indicator"
                label={bat.as((d) => `C:${d.cycles}`)}
              />
            </box>
          </box>
          <box hexpand />
        </box>

        {/* Large percentage display */}
        <label
          name="power-big-percent"
          label={bat.as((d) => `${d.level}%`)}
        />

        {/* Bottom data row */}
        <box name="power-panel-footer">
          <label name="power-footer-data" label={bat.as((d) =>
            d.status === "Charging" ? "CHARGING" : d.status === "Discharging" ? "ACTIVE" : "STANDBY"
          )} />
          <box hexpand />
          <label name="power-footer-data" label={bat.as((d) => d.watts)} />
          <label name="power-footer-data" label={bat.as((d) => d.time !== "--" ? `ETA:${d.time}` : "")} />
        </box>
      </box>

      {/* Compact status bar */}
      <box name="status-panel">
        <label name="status-icon" label={bat.as((d) => d.status === "Charging" ? "" : "")} />
        <label name="status-label" label="PWR" />
        <box hexpand />
        <label name="status-value" label={bat.as((d) => d.watts)} />
        <label name="status-value" label={bat.as((d) => `${d.level}%`)} />
        <label name="status-value" label={bat.as((d) => d.time !== "--" ? d.time : "")} />
        <label
          name="status-indicator"
          label={bat.as((d) => d.status === "Charging" ? "CHG" : d.status === "Discharging" ? "ACT" : "RDY")}
        />
      </box>
    </box>
  )
}

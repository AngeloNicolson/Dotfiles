import { createPoll } from "ags/time"
import { execAsync, createSubprocess } from "ags/process"

export default function PowerIndicator() {
  const bat = createSubprocess(
    { level: 100, status: "Unknown", ac: false, cycles: 0, watts: "--W", time: "--" },
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
        {/* Header — title, watts, time, badge */}
        <box name="power-panel-header">
          <label name="power-panel-title" label="POWER // CORE" />
          <box hexpand />
          <label name="power-header-stat" label={bat.as((d) => d.watts)} />
          <label name="power-header-stat" label={bat.as((d) => d.time !== "--" ? d.time : "")} />
          <label
            name="power-status-badge"
            css={bat.as((d) => d.status === "Charging"
              ? "background: #2a2e0a; border-color: #6e7116; color: #b8bb26;"
              : d.status === "Discharging"
              ? "background: #2e0a0a; border-color: #992222; color: #cc4444;"
              : "background: #3c3836; border-color: #504945; color: #a89984;")}
            label={bat.as((d) => d.status === "Charging" ? "CHG" : d.status === "Discharging" ? "ACT" : "RDY")}
          />
        </box>

        {/* Battery bar */}
        <box hexpand>
          <box hexpand />
          <box name="power-bar-container">
            <box name="power-scale" vertical>
              <label name="power-scale-mark" label="100" />
              <box vexpand />
              <label name="power-scale-mark" label="50" />
              <box vexpand />
              <label name="power-scale-mark" label="0" />
            </box>

            <box name="power-bar-frame" vertical>
              <box name="power-segments" vertical>
                {Array(10).fill(0).map((_, i) => {
                  const segmentIndex = 9 - i
                  return (
                    <box
                      name="power-segment"
                      class={bat.as((d) => {
                        const threshold = (segmentIndex + 1) * 10
                        if (d.level >= threshold) {
                          return d.status === "Discharging" ? "discharge" : "lit"
                        }
                        return "unlit"
                      })}
                      vexpand
                      hexpand
                    />
                  )
                })}
              </box>
            </box>

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

        {/* Big percentage */}
        <label
          name="power-big-percent"
          label={bat.as((d) => `${d.level}%`)}
        />
      </box>
    </box>
  )
}

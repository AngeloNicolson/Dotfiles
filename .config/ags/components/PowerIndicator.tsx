import { createState } from "ags"
import { createPoll } from "ags/time"
import { execAsync, createSubprocess } from "ags/process"

const gpuModes = [
  { label: "ECO", watts: 50 },
  { label: "BAL", watts: 95 },
  { label: "MAX", watts: 150 },
]

const sysModes = [
  { label: "SAVE", profile: "power-saver" },
  { label: "BAL", profile: "balanced" },
  { label: "PERF", profile: "performance" },
]

export default function PowerIndicator() {
  const gpu = createPoll(
    { power: 0, temp: 0, limit: 95 },
    3000,
    () => execAsync("nvidia-smi --query-gpu=power.draw,temperature.gpu,enforced.power.limit --format=csv,noheader,nounits")
      .then((out) => {
        const [p, t, l] = out.split(",").map((s) => parseFloat(s.trim()))
        return { power: p || 0, temp: t || 0, limit: l || 95 }
      })
      .catch(() => ({ power: 0, temp: 0, limit: 95 })),
  )

  const setGpuPower = (watts: number) => {
    execAsync(`pkexec nvidia-smi -pl ${watts}`).catch((e) => console.error("GPU power set failed:", e))
  }

  const cpu = createPoll(
    { temp: 0, freq: 0 },
    3000,
    () => execAsync("bash -c \"cat /sys/class/thermal/thermal_zone0/temp && cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq\"")
      .then((out) => {
        const lines = out.trim().split("\n")
        return { temp: Math.round(parseInt(lines[0]) / 1000), freq: (parseInt(lines[1]) / 1000000).toFixed(1) }
      })
      .catch(() => ({ temp: 0, freq: 0 })),
  )

  const setSysProfile = (profile: string) => {
    execAsync(`powerprofilesctl set ${profile}`).catch((e) => console.error("Profile set failed:", e))
  }
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

      {/* System Power Profile */}
      <box name="gpu-panel" vertical>
        <box name="gpu-panel-header">
          <label name="power-panel-title" label="SYS // i9 275HX" />
          <box hexpand />
          <label name="power-header-stat" label={cpu.as((c) => `${c.freq}GHz`)} />
          <label name="power-header-stat" label={cpu.as((c) => `${c.temp}°C`)} />
        </box>

        <box name="gpu-mode-buttons" homogeneous>
          {sysModes.map((mode) => (
            <button
              name="gpu-mode-btn"
              class={powerProfile.as((p) => p === mode.profile ? "active" : "")}
              onClicked={() => setSysProfile(mode.profile)}
            >
              <box vertical>
                <label name="gpu-mode-label" label={mode.label} />
                <label name="gpu-mode-watts" label={mode.profile} />
              </box>
            </button>
          ))}
        </box>
      </box>

      {/* GPU Power Mode */}
      <box name="gpu-panel" vertical>
        <box name="gpu-panel-header">
          <label name="power-panel-title" label="GPU // RTX 5090" />
          <box hexpand />
          <label name="power-header-stat" label={gpu.as((g) => `${g.power.toFixed(0)}W`)} />
          <label name="power-header-stat" label={gpu.as((g) => `${g.temp}°C`)} />
        </box>

        <box name="gpu-mode-buttons" homogeneous>
          {gpuModes.map((mode) => (
            <button
              name="gpu-mode-btn"
              class={gpu.as((g) => Math.abs(g.limit - mode.watts) < 5 ? "active" : "")}
              onClicked={() => setGpuPower(mode.watts)}
            >
              <box vertical>
                <label name="gpu-mode-label" label={mode.label} />
                <label name="gpu-mode-watts" label={`${mode.watts}W`} />
              </box>
            </button>
          ))}
        </box>
      </box>
    </box>
  )
}

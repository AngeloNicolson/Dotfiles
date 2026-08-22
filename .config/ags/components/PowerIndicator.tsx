import { createState } from "ags"
import { createPoll } from "ags/time"
import { execAsync, createSubprocess } from "ags/process"
import caps, { readSysfs } from "../capabilities"

// Rough draw of everything RAPL+nvidia-smi can't see (display, RAM, NVMe,
// fans, board). Marks the OUT-while-charging figure as an estimate.
const SYS_BASE_W = 8

const gpuModes = [
  { label: "ECO", watts: 95, boost: false },
  { label: "BOOST", watts: 175, boost: true },
]

const sysModes = [
  { label: "SAVE", profile: "power-saver" },
  { label: "BAL", profile: "balanced" },
  { label: "PERF", profile: "performance" },
]

interface BatSample {
  level: number
  status: string
  ac: boolean
  usbc: boolean
  cycles: number
  watts: string
  time: string
}

// Poll battery + power-source state. Paths come from capability probing so any
// BAT*/AC-name layout works; `rd` tolerates missing attributes (e.g. desktops,
// or charge_* vs energy_* batteries). USB-C PD input is detected via the UCSI
// source supplies: online=1 on a port means power is coming in over that USB-C
// port right now.
function batteryScript(): string {
  const bat = caps.battery ?? ""
  const ac = caps.mains ?? ""
  const ucsi = caps.usbcSources.map((p) => `${p}/online`).join(" ")
  return `
    rd() { [ -f "$1" ] && cat "$1" 2>/dev/null || echo 0; }
    while true; do
      cap=$(rd "${bat}/capacity"); st=$(cat "${bat}/status" 2>/dev/null || echo Unknown)
      ac=$(rd "${ac}/online")
      usbc=0
      for u in ${ucsi}; do [ "$(rd "$u")" = "1" ] && usbc=1; done
      if [ -f "${bat}/charge_now" ]; then
        mode=charge
        vo=$(rd "${bat}/voltage_now"); cu=$(rd "${bat}/current_now")
        cn=$(rd "${bat}/charge_now"); cf=$(rd "${bat}/charge_full")
      else
        mode=energy
        vo=0; cu=$(rd "${bat}/power_now")
        cn=$(rd "${bat}/energy_now"); cf=$(rd "${bat}/energy_full")
      fi
      cc=$(rd "${bat}/cycle_count")
      echo "$cap|$st|$ac|$usbc|$mode|$vo|$cu|$cn|$cf|$cc"
      sleep 5
    done`
}

function parseBatLine(line: string): BatSample {
  const [cap, st, ac, usbc, mode, vo, cu, cn, cf, cc] = line.split("|")
  const level = parseInt(cap) || 0
  const status = st || "Unknown"
  const c = parseInt(cu) || 0
  // charge mode: µV * µA -> W;  energy mode: power_now is µW -> W
  const watts = mode === "charge" ? ((parseInt(vo) || 0) * c) / 1e12 : c / 1e6
  let time = "--"
  if (c > 0) {
    // Same ratio works for both modes: µAh/µA or µWh/µW = hours.
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
    usbc: usbc === "1",
    cycles: parseInt(cc) || 0,
    watts: watts > 0 ? `${watts.toFixed(1)}W` : "0W",
    time,
  }
}

function powerSourceLabel(d: BatSample): string {
  if (d.usbc) return "▶ USB-C"
  if (d.ac) return "▶ AC"
  return "● BAT"
}

export default function PowerIndicator() {
  let gpuWatts = 0
  const gpu = createPoll(
    { power: 0, temp: 0, limit: 95 },
    3000,
    () => caps.nvidia
      ? execAsync("nvidia-smi --query-gpu=power.draw,temperature.gpu,enforced.power.limit --format=csv,noheader,nounits")
          .then((out) => {
            const [p, t, l] = out.split(",").map((s) => parseFloat(s.trim()))
            gpuWatts = p || 0
            return { power: p || 0, temp: t || 0, limit: l || 95 }
          })
          .catch(() => ({ power: 0, temp: 0, limit: 95 }))
      : Promise.resolve({ power: 0, temp: 0, limit: 95 }),
  )

  // CPU package power from the RAPL energy counter (µJ), sampled as a delta
  // each poll. Reads fail silently while energy_uj is root-only and start
  // working the moment permissions open up — no restart needed.
  let lastRapl: { t: number; uj: number } | null = null
  const cpuWatts = createPoll(0, 3000, () => {
    if (!caps.rapl) return 0
    const uj = parseInt(readSysfs(`${caps.rapl}/energy_uj`))
    if (!isFinite(uj)) { lastRapl = null; return 0 }
    const t = Date.now()
    let w = 0
    if (lastRapl && uj >= lastRapl.uj && t > lastRapl.t) {
      w = (uj - lastRapl.uj) / ((t - lastRapl.t) * 1000)
    }
    lastRapl = { t, uj }
    return w
  })

  const [gpuName, setGpuName] = createState("GPU")
  if (caps.nvidia) {
    execAsync("nvidia-smi --query-gpu=name --format=csv,noheader")
      // "NVIDIA GeForce RTX 5090 Laptop GPU" -> "RTX 5090"
      .then((out) => setGpuName(out.trim().replace(/NVIDIA|GeForce|Laptop GPU/g, "").trim() || "GPU"))
      .catch(() => {})
  }

  const setGpuPower = (mode: typeof gpuModes[number]) => {
    if (!mode.boost) {
      // ECO: stop nvidia-powerd, GPU falls back to 95W default
      execAsync("sudo systemctl stop nvidia-powerd").catch((e) => console.error("GPU power set failed:", e))
    } else {
      // BAL/MAX: ensure nvidia-powerd is running for dynamic boost
      execAsync("sudo systemctl start nvidia-powerd").catch((e) => console.error("GPU power set failed:", e))
    }
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
    { level: 100, status: "Unknown", ac: false, usbc: false, cycles: 0, watts: "--W", time: "--" } as BatSample,
    ["bash", "-c", batteryScript()],
    parseBatLine,
  )

  const powerProfile = createPoll("balanced", 5000, () => {
    return caps.powerProfiles
      ? execAsync("powerprofilesctl get").then((out) => out.trim()).catch(() => "balanced")
      : Promise.resolve("balanced")
  })

  return (
    <box name="power-page" vertical>
      {caps.battery && (
        <box name="power-panel" vertical>
          {/* Header — title, watts, time, badge */}
          <box name="power-panel-header">
            <label name="power-panel-title" label="POWER // CORE" />
            <box hexpand />
            {/* Battery power flow: IN = charging watts, OUT = discharge draw */}
            <label name="power-header-stat" label={bat.as((d) =>
              d.status === "Charging" ? `IN ${d.watts}`
              : d.status === "Discharging" ? `OUT ${d.watts}`
              : d.watts)} />
            {/* While charging the battery-side OUT is ~0, so show what the
                system itself is drawing: CPU pkg (RAPL) + GPU + base. Hidden
                until RAPL is readable. */}
            <label name="power-header-stat" label={cpuWatts.as((cw) => {
              const d = bat.get()
              if (d.status !== "Charging" || cw <= 0) return ""
              return `OUT ~${(cw + gpuWatts + SYS_BASE_W).toFixed(0)}W`
            })} />
            {/* Time to full when charging, time to empty when draining */}
            <label name="power-header-stat" label={bat.as((d) =>
              d.time === "--" ? ""
              : d.status === "Charging" ? `FULL ${d.time}`
              : d.status === "Discharging" ? `LEFT ${d.time}`
              : "")} />
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
                  label={bat.as(powerSourceLabel)}
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
      )}

      {/* System Power Profile */}
      {caps.powerProfiles && (
        <box name="gpu-panel" vertical>
          <box name="gpu-panel-header">
            <label name="power-panel-title" label={`SYS // ${caps.cpuName}`} />
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
      )}

      {/* GPU Power Mode */}
      {caps.nvidia && (
        <box name="gpu-panel" vertical>
          <box name="gpu-panel-header">
            <label name="power-panel-title" label={gpuName.as((n) => `GPU // ${n}`)} />
            <box hexpand />
            <label name="power-header-stat" label={gpu.as((g) => `${g.power.toFixed(0)}W`)} />
            <label name="power-header-stat" label={gpu.as((g) => `${g.temp}°C`)} />
          </box>

          <box name="gpu-mode-buttons" homogeneous>
            {gpuModes.map((mode) => (
              <button
                name="gpu-mode-btn"
                class={gpu.as((g) => {
                  if (!mode.boost) return g.limit <= 96 ? "active" : ""
                  return g.limit > 96 ? "active" : ""
                })}
                onClicked={() => setGpuPower(mode)}
              >
                <box vertical>
                  <label name="gpu-mode-label" label={mode.label} />
                  <label name="gpu-mode-watts" label={`${mode.watts}W`} />
                </box>
              </button>
            ))}
          </box>
        </box>
      )}
    </box>
  )
}

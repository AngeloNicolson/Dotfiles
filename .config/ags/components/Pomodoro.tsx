import { createPoll } from "ags/time"
import { createState } from "ags"
import { execAsync } from "ags/process"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import { breakPopupVisible, setBreakPopupVisible, pomoMaintainFocus, setPomoMaintainFocus } from "../state"

// === Timer State ===
type Phase = "idle" | "work" | "break"

export const [phase, setPhase] = createState<Phase>("idle")
const [running, setRunning] = createState(false)
export const [secondsRemaining, setSecondsRemaining] = createState(0)
const [totalSeconds, setTotalSeconds] = createState(0)
const [workMinutes, setWorkMinutes] = createState(25)
const [breakMinutes, setBreakMinutes] = createState(5)
export const [studyBlockMode, setStudyBlockMode] = createState(false)
export const [totalBlocks, setTotalBlocks] = createState(4)
export const [currentBlock, setCurrentBlock] = createState(0)
const [audioEnabled, setAudioEnabled] = createState(true)
const [volume, setVolume] = createState(0.5)
const [audioThemeIndex, setAudioThemeIndex] = createState(0)
const [focusIndex, setFocusIndex] = createState(-1)

const MPV_SOCKET = "/tmp/ags-pomodoro-mpv-socket"
const MUSIC_DIR = `${GLib.get_home_dir()}/.config/ags/assets/music-themes`

// === Audio Helpers ===
function getThemeNames(): string[] {
  try {
    const result = GLib.Dir.open(MUSIC_DIR, 0)
    const names: string[] = []
    let name: string | null
    while ((name = result.read_name()) !== null) {
      names.push(name)
    }
    return names.sort()
  } catch {
    return []
  }
}

function getMusicFiles(themeName: string, subdir: string): string[] {
  const dir = `${MUSIC_DIR}/${themeName}/${subdir}`
  try {
    const result = GLib.Dir.open(dir, 0)
    const files: string[] = []
    let name: string | null
    while ((name = result.read_name()) !== null) {
      if (name.endsWith(".mp3") || name.endsWith(".ogg") || name.endsWith(".flac") || name.endsWith(".wav")) {
        files.push(`${dir}/${name}`)
      }
    }
    return files.sort()
  } catch {
    return []
  }
}

function killMpv() {
  execAsync(`pkill -f "mpv.*${MPV_SOCKET}"`).catch(() => {})
}

function playMusic(subdir: string) {
  if (!audioEnabled.get()) return
  const themes = getThemeNames()
  if (themes.length === 0) return
  const idx = audioThemeIndex.get() % themes.length
  const files = getMusicFiles(themes[idx], subdir)
  if (files.length === 0) return

  killMpv()
  const file = files[Math.floor(Math.random() * files.length)]
  const vol = Math.round(volume.get() * 100)
  execAsync([
    "mpv", "--no-video", "--loop=inf",
    `--volume=${vol}`,
    `--input-ipc-server=${MPV_SOCKET}`,
    file,
  ]).catch(() => {})
}

function playNotification(name: string) {
  if (!audioEnabled.get()) return
  const themes = getThemeNames()
  if (themes.length === 0) return
  const idx = audioThemeIndex.get() % themes.length
  const dir = `${MUSIC_DIR}/${themes[idx]}/notifications`
  const file = `${dir}/${name}`
  if (!GLib.file_test(file, GLib.FileTest.EXISTS)) return
  const vol = Math.round(volume.get() * 100)
  execAsync(["mpv", "--no-video", `--volume=${vol}`, file]).catch(() => {})
}

function setMpvVolume(vol: number) {
  const pct = Math.round(vol * 100)
  execAsync(["bash", "-c", `echo '{ "command": ["set_property", "volume", ${pct}] }' | socat - ${MPV_SOCKET}`]).catch(() => {})
}

// === Timer Logic ===
function startWork() {
  const secs = workMinutes.get() * 60
  setTotalSeconds(secs)
  setSecondsRemaining(secs)
  setPhase("work")
  setRunning(true)
  playNotification("session_started.mp3")
  playMusic("work")
}

function startBreak() {
  const secs = breakMinutes.get() * 60
  setTotalSeconds(secs)
  setSecondsRemaining(secs)
  setPhase("break")
  setRunning(true)
  setBreakPopupVisible(true)
  playNotification("session_end.mp3")
  killMpv()
  // Small delay then play break music
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
    if (phase.get() === "break") playMusic("break")
    return GLib.SOURCE_REMOVE
  })
}

function stopTimer() {
  setPhase("idle")
  setRunning(false)
  setSecondsRemaining(0)
  setTotalSeconds(0)
  setCurrentBlock(0)
  setBreakPopupVisible(false)
  killMpv()
}

function onTimerComplete() {
  if (phase.get() === "work") {
    if (studyBlockMode.get()) {
      const next = currentBlock.get() + 1
      setCurrentBlock(next)
      if (next >= totalBlocks.get()) {
        // All blocks complete
        playNotification("break_end.mp3")
        stopTimer()
        return
      }
    }
    startBreak()
  } else if (phase.get() === "break") {
    setBreakPopupVisible(false)
    playNotification("break_end.mp3")
    killMpv()
    if (studyBlockMode.get()) {
      // Start next work block
      startWork()
    } else {
      stopTimer()
    }
  }
}

// Timer tick — decrements every second when running
const _tick = createPoll(0, 1000, () => {
  if (!running.get()) return 0
  const rem = secondsRemaining.get()
  if (rem <= 1) {
    setSecondsRemaining(0)
    setRunning(false)
    onTimerComplete()
    return 0
  }
  setSecondsRemaining(rem - 1)
  return rem - 1
})

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

// Ratio presets
const PRESETS = [
  { work: 25, brk: 5, label: "25/5" },
  { work: 50, brk: 10, label: "50/10" },
  { work: 45, brk: 15, label: "45/15" },
  { work: 90, brk: 30, label: "90/30" },
]

// Focusable element IDs for vim navigation
const FOCUSABLE = [
  "mode-single", "mode-block",
  "preset-0", "preset-1", "preset-2", "preset-3",
  "work-minus", "work-plus", "break-minus", "break-plus",
  "btn-start", "btn-stop",
  "audio-toggle", "theme-prev", "theme-next",
  "vol-bar",
]

export default function Pomodoro() {
  return (
    <eventbox
      onKeyPressEvent={(_, event) => {
        const keyval = event.get_keyval()[1]
        const idx = focusIndex.get()

        if (keyval === Gdk.KEY_j || keyval === Gdk.KEY_Down) {
          setFocusIndex(Math.min(idx + 1, FOCUSABLE.length - 1))
          return true
        }
        if (keyval === Gdk.KEY_k || keyval === Gdk.KEY_Up) {
          setFocusIndex(Math.max(idx - 1, 0))
          return true
        }
        if (keyval === Gdk.KEY_h || keyval === Gdk.KEY_Left) {
          // Adjust volume down when on vol-bar
          if (FOCUSABLE[idx] === "vol-bar") {
            const v = Math.max(0, volume.get() - 0.05)
            setVolume(v)
            setMpvVolume(v)
          }
          return true
        }
        if (keyval === Gdk.KEY_l || keyval === Gdk.KEY_Right) {
          if (FOCUSABLE[idx] === "vol-bar") {
            const v = Math.min(1, volume.get() + 0.05)
            setVolume(v)
            setMpvVolume(v)
          }
          return true
        }
        if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_space) {
          const id = FOCUSABLE[idx]
          if (id === "mode-single") setStudyBlockMode(false)
          else if (id === "mode-block") setStudyBlockMode(true)
          else if (id?.startsWith("preset-")) {
            const pi = parseInt(id.split("-")[1])
            setWorkMinutes(PRESETS[pi].work)
            setBreakMinutes(PRESETS[pi].brk)
          }
          else if (id === "work-minus") setWorkMinutes(Math.max(1, workMinutes.get() - 5))
          else if (id === "work-plus") setWorkMinutes(workMinutes.get() + 5)
          else if (id === "break-minus") setBreakMinutes(Math.max(1, breakMinutes.get() - 1))
          else if (id === "break-plus") setBreakMinutes(breakMinutes.get() + 1)
          else if (id === "btn-start") {
            if (phase.get() === "idle") startWork()
            else setRunning(!running.get())
          }
          else if (id === "btn-stop") stopTimer()
          else if (id === "audio-toggle") setAudioEnabled(!audioEnabled.get())
          else if (id === "theme-prev") setAudioThemeIndex(Math.max(0, audioThemeIndex.get() - 1))
          else if (id === "theme-next") setAudioThemeIndex(audioThemeIndex.get() + 1)
          return true
        }
        return false
      }}
      canFocus
    >
      <box vertical name="pomo-page">
        {/* Section header */}
        <label name="section-header" label="//POMODORO" />

        {/* Timer display panel */}
        <box name="pomo-timer-panel" vertical>
          <label
            name="pomo-phase-label"
            label={phase.as((p) => p === "work" ? "WORK SESSION" : p === "break" ? "BREAK TIME" : "READY")}
          />
          <label
            name="pomo-time-display"
            label={secondsRemaining.as((s) => {
              if (phase.get() === "idle") return formatTime(workMinutes.get() * 60)
              return formatTime(s)
            })}
          />
          {/* 20-segment progress bar */}
          <box name="pomo-progress-bar" vertical>
            {Array(20).fill(0).map((_, i) => (
              <box
                name="control-segment"
                hexpand
                class={secondsRemaining.as(() => {
                  const tot = totalSeconds.get()
                  const rem = secondsRemaining.get()
                  if (tot === 0) return "unlit"
                  const progress = 1 - (rem / tot)
                  return (19 - i) < Math.round(progress * 20) ? "lit" : "unlit"
                })}
              />
            ))}
          </box>
        </box>

        {/* Mode toggle */}
        <box name="pomo-mode-row">
          <button
            name="sys-toggle"
            class={studyBlockMode.as((b) => !b ? "active" : "")}

            onClicked={() => setStudyBlockMode(false)}
          >
            <label name="pomo-mode-label" label="SINGLE" />
          </button>
          <button
            name="sys-toggle"
            class={studyBlockMode.as((b) => b ? "active" : "")}

            onClicked={() => setStudyBlockMode(true)}
          >
            <label name="pomo-mode-label" label="BLOCK" />
          </button>
        </box>

        {/* Ratio presets */}
        <box name="pomo-presets-row">
          {PRESETS.map((p, i) => (
            <button
              name="pomo-preset-btn"
              class={workMinutes.as((wm) => wm === p.work && breakMinutes.get() === p.brk ? "active" : "")}

              onClicked={() => {
                setWorkMinutes(p.work)
                setBreakMinutes(p.brk)
              }}
            >
              <label label={p.label} />
            </button>
          ))}
        </box>

        {/* Time adjusters */}
        <box name="pomo-adjusters" vertical>
          <box name="pomo-adjuster-row">
            <label name="pomo-adj-label" label="WORK" />
            <box hexpand />
            <button
              name="pomo-adj-btn"

              onClicked={() => setWorkMinutes(Math.max(1, workMinutes.get() - 5))}
            >
              <label label="-" />
            </button>
            <label name="pomo-adj-value" label={workMinutes.as((m) => `${m}m`)} />
            <button
              name="pomo-adj-btn"

              onClicked={() => setWorkMinutes(workMinutes.get() + 5)}
            >
              <label label="+" />
            </button>
          </box>
          <box name="pomo-adjuster-row">
            <label name="pomo-adj-label" label="BREAK" />
            <box hexpand />
            <button
              name="pomo-adj-btn"

              onClicked={() => setBreakMinutes(Math.max(1, breakMinutes.get() - 1))}
            >
              <label label="-" />
            </button>
            <label name="pomo-adj-value" label={breakMinutes.as((m) => `${m}m`)} />
            <button
              name="pomo-adj-btn"

              onClicked={() => setBreakMinutes(breakMinutes.get() + 1)}
            >
              <label label="+" />
            </button>
          </box>
        </box>

        {/* Study block progress dots */}
        <box
          name="pomo-blocks-row"
          visible={studyBlockMode}
        >
          {Array(8).fill(0).map((_, i) => (
            <box
              name="pomo-block-dot"
              class={currentBlock.as((cb) => {
                const tot = totalBlocks.get()
                if (i >= tot) return "hidden"
                return i < cb ? "completed" : "pending"
              })}
            />
          ))}
        </box>

        {/* Control buttons */}
        <box name="pomo-controls-row">
          <button
            name="pomo-start-btn"
            class={running.as((r) => r ? "running" : "")}

            onClicked={() => {
              if (phase.get() === "idle") {
                startWork()
              } else {
                if (running.get()) {
                  setRunning(false)
                  killMpv()
                } else {
                  setRunning(true)
                  if (phase.get() === "work") playMusic("work")
                  else if (phase.get() === "break") playMusic("break")
                }
              }
            }}
          >
            <label label={running.as((r) => {
              if (phase.get() === "idle") return "▶ START"
              return r ? "⏸ PAUSE" : "▶ RESUME"
            })} />
          </button>
          <button
            name="pomo-stop-btn"

            onClicked={() => stopTimer()}
          >
            <label label="⏹ STOP" />
          </button>
        </box>

        {/* Maintain focus toggle */}
        <box name="pomo-focus-row">
          <button
            name="sys-toggle"
            class={pomoMaintainFocus.as((m) => m ? "active" : "")}
            onClicked={() => setPomoMaintainFocus(!pomoMaintainFocus.get())}
          >
            <label name="pomo-mode-label" label="⏼ PANE FOCUS" />
          </button>
        </box>

        {/* Audio section */}
        <label name="section-header" label="//AUDIO" />

        {/* Audio theme selector */}
        <box name="pomo-audio-row">
          <button
            name="pomo-adj-btn"

            onClicked={() => {
              const next = !audioEnabled.get()
              setAudioEnabled(next)
              if (!next) killMpv()
            }}
          >
            <label label={audioEnabled.as((a) => a ? "" : "")} />
          </button>
          <button
            name="pomo-adj-btn"

            onClicked={() => setAudioThemeIndex(Math.max(0, audioThemeIndex.get() - 1))}
          >
            <label label="◀" />
          </button>
          <label
            name="pomo-theme-name"
            label={audioThemeIndex.as((i) => {
              const themes = getThemeNames()
              if (themes.length === 0) return "NO THEMES"
              return themes[i % themes.length].toUpperCase()
            })}
          />
          <button
            name="pomo-adj-btn"

            onClicked={() => setAudioThemeIndex(audioThemeIndex.get() + 1)}
          >
            <label label="▶" />
          </button>
        </box>

        {/* Volume bar */}
        <box name="pomo-volume-panel" vertical>
          <box name="control-header">
            <label name="control-icon" label="" />
            <label name="control-label" label="VOL" />
            <box hexpand />
            <label name="control-value" label={volume.as((v) => `${Math.round(v * 100)}%`)} />
          </box>
          <box name="control-bar-container" vertical>
            {Array(20).fill(0).map((_, i) => (
              <button
                name="control-segment"
                hexpand
                class={volume.as((v) => (19 - i) < Math.round(v * 20) ? "lit" : "unlit")}
                onClicked={() => {
                  const v = (20 - i) / 20
                  setVolume(v)
                  setMpvVolume(v)
                }}
              />
            ))}
          </box>
        </box>
      </box>
    </eventbox>
  )
}

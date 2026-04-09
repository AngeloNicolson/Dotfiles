import { createState } from "ags"
import { execAsync } from "ags/process"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=3.0"
import { breakPopupVisible, setBreakPopupVisible, focusedPage, toggleFocusedPage } from "../state"

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
const [showCustom, setShowCustom] = createState(false)
const [audioEnabled, setAudioEnabled] = createState(true)
const [musicPaused, setMusicPaused] = createState(false)
const [volume, setVolume] = createState(0.5)
const [audioThemeIndex, setAudioThemeIndex] = createState(0)
const [focusIndex, setFocusIndex] = createState(-1)

const MPV_SOCKET = "/tmp/ags-pomodoro-mpv-socket"
const MUSIC_DIR = `${GLib.get_home_dir()}/.config/ags/assets/music-themes`
let fadeToken = 0
let effectiveVolume = 0
let endNotificationPlayed = false

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

function killMpvProcess() {
  effectiveVolume = 0
  execAsync(`pkill -f "mpv.*${MPV_SOCKET}"`).catch(() => {})
}

function killMpv() {
  fadeToken++
  killMpvProcess()
}

function playMusic(subdir: string) {
  if (!audioEnabled.get()) return
  const themes = getThemeNames()
  if (themes.length === 0) return
  const idx = audioThemeIndex.get() % themes.length
  const files = getMusicFiles(themes[idx], subdir)
  if (files.length === 0) return

  killMpv()
  setMusicPaused(false)
  const file = files[Math.floor(Math.random() * files.length)]
  execAsync([
    "mpv", "--no-video", "--loop=inf",
    "--volume=0",
    `--input-ipc-server=${MPV_SOCKET}`,
    file,
  ]).catch(() => {})
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
    fadeInMpv()
    return GLib.SOURCE_REMOVE
  })
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

const FADE_SECONDS = 7
const FADE_FLOOR = 0.3

function setMpvVolume(vol: number) {
  effectiveVolume = vol
  const pct = (vol * 100).toFixed(1)
  execAsync(["bash", "-c", `echo '{ "command": ["set_property", "volume", ${pct}] }' | socat - ${MPV_SOCKET}`]).catch(() => {})
}

const FADE_IN_STEPS = 40
const FADE_IN_DURATION = 2000

function applyFade(remaining: number) {
  if (!audioEnabled.get()) return
  if (remaining > FADE_SECONDS) return
  const baseVol = volume.get()
  const progress = remaining / FADE_SECONDS
  const vol = baseVol * (FADE_FLOOR + (1 - FADE_FLOOR) * progress)
  setMpvVolume(vol)
}

function fadeInMpv() {
  fadeToken++
  const token = fadeToken
  const targetVol = volume.get()
  let step = 0
  const interval = FADE_IN_DURATION / FADE_IN_STEPS
  const tick = () => {
    if (token !== fadeToken) return
    step++
    setMpvVolume((step / FADE_IN_STEPS) * targetVol)
    if (step < FADE_IN_STEPS) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => { tick(); return GLib.SOURCE_REMOVE })
    }
  }
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => { tick(); return GLib.SOURCE_REMOVE })
}

function fadeOutMpv(durationMs: number, onDone?: () => void) {
  fadeToken++
  const token = fadeToken
  const startVol = effectiveVolume
  if (startVol <= 0) {
    killMpvProcess()
    onDone?.()
    return
  }
  const steps = 30
  let step = 0
  const interval = durationMs / steps
  const tick = () => {
    if (token !== fadeToken) return
    step++
    setMpvVolume((1 - step / steps) * startVol)
    if (step >= steps) {
      killMpvProcess()
      onDone?.()
    } else {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => { tick(); return GLib.SOURCE_REMOVE })
    }
  }
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => { tick(); return GLib.SOURCE_REMOVE })
}

function seekMpv(seconds: number) {
  execAsync(["bash", "-c", `echo '{ "command": ["seek", ${seconds}, "relative"] }' | socat - ${MPV_SOCKET}`]).catch(() => {})
}

function skipTrack() {
  const p = phase.get()
  if (p === "work" || p === "break") {
    fadeOutMpv(400, () => playMusic(p))
  }
}

function switchAudioTheme(newIndex: number) {
  setAudioThemeIndex(newIndex)
  if (running.get() && audioEnabled.get()) {
    const p = phase.get()
    if (p === "work" || p === "break") {
      fadeOutMpv(600, () => playMusic(p))
    }
  }
}

// === Circular Progress Ring ===
import { s } from "../scale"
const RING_SEGMENTS = 60
const RING_SIZE = s(270)
const DIM = [0.12, 0.15, 0.18, 0.5]
const WORK_COLOR = [0.83, 0.66, 0.26, 1.0]
const BREAK_COLOR = [0.85, 0.90, 0.92, 1.0]
const OVERFLOW_COLOR = [0.85, 0.25, 0.20, 1.0]

function drawRingSegments(
  cr: any, cx: number, cy: number,
  r1: number, r2: number,
  litCount: number, color: number[],
  segCount: number = RING_SEGMENTS,
) {
  const segAngle = (2 * Math.PI) / RING_SEGMENTS
  const gap = segAngle * 0.18

  for (let i = 0; i < segCount; i++) {
    const a0 = -Math.PI / 2 + i * segAngle + gap / 2
    const a1 = a0 + segAngle - gap
    const c = i < litCount ? color : DIM
    cr.setSourceRGBA(c[0], c[1], c[2], c[3])
    cr.moveTo(cx + r1 * Math.cos(a0), cy + r1 * Math.sin(a0))
    cr.arc(cx, cy, r1, a0, a1)
    cr.arcNegative(cx, cy, r2, a1, a0)
    cr.closePath()
    cr.fill()
  }
}

function drawProgressRing(cr: any, width: number, height: number) {
  const cx = width / 2
  const cy = height / 2
  const remaining = secondsRemaining.get()
  const total = totalSeconds.get()

  // Calculate minutes for current phase (or configured work time when idle)
  const totalMin = total > 0 ? Math.ceil(total / 60) : workMinutes.get()
  const minutesRem = total > 0 ? Math.ceil(remaining / 60) : totalMin

  // Overflow ring (red, thin outer edge) — for timers > 60 min
  const edge = Math.min(cx, cy) - 2
  const overflowTotal = Math.min(Math.max(0, totalMin - 60), 60)
  const overflowR1 = edge
  const overflowR2 = edge - 5
  if (overflowTotal > 0) {
    const overflowLit = Math.max(0, minutesRem - 60)
    drawRingSegments(cr, cx, cy, overflowR1, overflowR2, overflowLit, OVERFLOW_COLOR, overflowTotal)
  }

  // Minutes ring (yellow) — 1 segment per minute, max 60
  const mr1 = overflowR2 - 1
  const mr2 = mr1 - 16
  const mainLit = Math.min(minutesRem, 60)
  const mainTotal = Math.min(totalMin, 60)
  drawRingSegments(cr, cx, cy, mr1, mr2, mainLit, WORK_COLOR, mainTotal)

  // Seconds ring (white) — ticks down each second within the minute
  const sr1 = mr2 - 3
  const sr2 = sr1 - 12
  const secondSegs = total > 0
    ? (remaining > 0 ? ((remaining - 1) % 60) + 1 : 0)
    : RING_SEGMENTS
  drawRingSegments(cr, cx, cy, sr1, sr2, secondSegs, BREAK_COLOR)
}

// === Timer Logic ===
let isFirstSession = true

function startWork() {
  endNotificationPlayed = false
  const secs = workMinutes.get() * 60
  setTotalSeconds(secs)
  setSecondsRemaining(secs)
  setPhase("work")
  setRunning(true)
  if (isFirstSession) {
    playNotification("session_started.mp3")
    isFirstSession = false
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      if (phase.get() === "work") playMusic("work")
      return GLib.SOURCE_REMOVE
    })
  } else {
    playMusic("work")
  }
}

function startBreak() {
  endNotificationPlayed = false
  const secs = breakMinutes.get() * 60
  setTotalSeconds(secs)
  setSecondsRemaining(secs)
  setPhase("break")
  setRunning(true)
  setBreakPopupVisible(true)
  // Fade out work music → break music
  fadeOutMpv(800, () => {
    if (phase.get() === "break") playMusic("break")
  })
}

function stopTimer() {
  setPhase("idle")
  setRunning(false)
  setSecondsRemaining(0)
  setTotalSeconds(0)
  setCurrentBlock(0)
  setBreakPopupVisible(false)
  fadeOutMpv(500)
  isFirstSession = true
}

function onTimerComplete() {
  if (phase.get() === "work") {
    if (studyBlockMode.get()) {
      const next = currentBlock.get() + 1
      setCurrentBlock(next)
      if (next >= totalBlocks.get()) {
        // All blocks complete — go idle, fade out
        setPhase("idle")
        setSecondsRemaining(0)
        setTotalSeconds(0)
        setCurrentBlock(0)
        isFirstSession = true
        fadeOutMpv(800)
        return
      }
    }
    startBreak()
  } else if (phase.get() === "break") {
    setBreakPopupVisible(false)
    if (studyBlockMode.get()) {
      // Fade out break music → start next work block
      fadeOutMpv(800, () => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
          startWork()
          return GLib.SOURCE_REMOVE
        })
      })
    } else {
      // Session done — go idle, fade out
      setPhase("idle")
      setSecondsRemaining(0)
      setTotalSeconds(0)
      setCurrentBlock(0)
      isFirstSession = true
      fadeOutMpv(800)
    }
  }
}

// Timer tick — decrements every second when running
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
  if (running.get()) {
    const rem = secondsRemaining.get()
    if (rem <= 1) {
      setSecondsRemaining(0)
      setRunning(false)
      endNotificationPlayed = false
      onTimerComplete()
    } else {
      setSecondsRemaining(rem - 1)
      applyFade(rem - 1)
      // Play end notification 3 seconds before timer completes
      if (rem - 1 === 3 && !endNotificationPlayed) {
        endNotificationPlayed = true
        const p = phase.get()
        if (p === "work") {
          playNotification("session_end.mp3")
        } else if (p === "break") {
          playNotification("break_end.mp3")
        }
      }
    }
  }
  return GLib.SOURCE_CONTINUE
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
  "seek-back", "skip-track", "seek-fwd",
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
          else if (id === "work-minus") {
            const cur = workMinutes.get()
            setWorkMinutes(cur <= 5 ? 1 : Math.floor((cur - 1) / 5) * 5)
          }
          else if (id === "work-plus") {
            const cur = workMinutes.get()
            setWorkMinutes(Math.min(90, cur < 5 ? 5 : Math.ceil((cur + 1) / 5) * 5))
          }
          else if (id === "break-minus") setBreakMinutes(Math.max(1, breakMinutes.get() - 1))
          else if (id === "break-plus") setBreakMinutes(breakMinutes.get() + 1)
          else if (id === "btn-start") {
            if (phase.get() === "idle") startWork()
            else setRunning(!running.get())
          }
          else if (id === "btn-stop") stopTimer()
          else if (id === "audio-toggle") setAudioEnabled(!audioEnabled.get())
          else if (id === "theme-prev") switchAudioTheme(Math.max(0, audioThemeIndex.get() - 1))
          else if (id === "theme-next") switchAudioTheme(audioThemeIndex.get() + 1)
          else if (id === "seek-back") seekMpv(-30)
          else if (id === "skip-track") skipTrack()
          else if (id === "seek-fwd") seekMpv(30)
          return true
        }
        return false
      }}
      canFocus
    >
      <box vertical name="pomo-page">
        {/* Section header */}
        <label name="section-header" label="//POMODORO" />

        {/* Circular timer with progress ring */}
        <box name="pomo-timer-panel" $={(self) => {
          self.set_halign(Gtk.Align.CENTER)

          const da = new Gtk.DrawingArea()
          da.set_size_request(RING_SIZE, RING_SIZE)

          da.connect("draw", (_: any, cr: any) => {
            drawProgressRing(cr, da.get_allocated_width(), da.get_allocated_height())
            return false
          })

          const overlay = new Gtk.Overlay()
          overlay.add(da)

          const labelBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
          labelBox.set_valign(Gtk.Align.CENTER)
          labelBox.set_halign(Gtk.Align.CENTER)

          const phaseLabel = new Gtk.Label()
          phaseLabel.set_name("pomo-phase-label")
          const timeLabel = new Gtk.Label()
          timeLabel.set_name("pomo-time-display")

          const timeCss = new Gtk.CssProvider()
          timeCss.load_from_data(`#pomo-time-display { font-size: ${s(56)}px; color: #f0f2f4; font-weight: 700; letter-spacing: ${s(4)}px; }`)
          timeLabel.get_style_context().add_provider(timeCss, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

          const phaseCss = new Gtk.CssProvider()
          phaseCss.load_from_data(`#pomo-phase-label { font-size: ${s(9)}px; color: #5090a0; font-weight: 700; letter-spacing: 2px; margin-top: 2px; }`)
          phaseLabel.get_style_context().add_provider(phaseCss, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

          labelBox.pack_start(timeLabel, false, false, 0)
          labelBox.pack_start(phaseLabel, false, false, 0)
          overlay.add_overlay(labelBox)

          self.pack_start(overlay, false, false, 0)
          overlay.show_all()

          const update = () => {
            const p = phase.get()
            const phaseText = p === "work" ? "WORK SESSION" : p === "break" ? "BREAK TIME" : "READY"
            phaseLabel.set_markup(`<span font_size="9000" weight="bold" color="#5090a0" letter_spacing="2048">${phaseText}</span>`)
            const s = secondsRemaining.get()
            const timeText = p === "idle" ? formatTime(workMinutes.get() * 60) : formatTime(s)
            timeLabel.set_markup(`<span font_size="38000" weight="bold" color="#f0f2f4" letter_spacing="4096">${timeText}</span>`)
            da.queue_draw()
          }

          secondsRemaining.subscribe(update)
          totalSeconds.subscribe(update)
          phase.subscribe(update)
          workMinutes.subscribe(update)
          update()
        }} />

        {/* Mode toggle */}
        <box name="pomo-mode-row" $={(self) => self.set_halign(Gtk.Align.CENTER)}>
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

        {/* Study block dots — click to set total, completed blocks fade out during session */}
        <box
          name="pomo-blocks-row"
          css={studyBlockMode.as((v) => `opacity: ${v ? 1 : 0};`)}
          $={(self) => self.set_halign(Gtk.Align.CENTER)}
        >
          {Array(16).fill(0).map((_, i) => (
            <button
              name="pomo-block-dot-btn"
              $={(self) => {
                const sc = self.get_style_context()
                const update = () => {
                  const tot = totalBlocks.get()
                  const cb = currentBlock.get()
                  sc.remove_class("selected")
                  sc.remove_class("completed")
                  if (i < cb) sc.add_class("completed")
                  else if (i < tot) sc.add_class("selected")
                }
                totalBlocks.subscribe(update)
                currentBlock.subscribe(update)
                update()
              }}
              onClicked={() => setTotalBlocks(i + 1)}
            >
              <box name="pomo-block-dot" />
            </button>
          ))}
        </box>

        {/* Ratio presets */}
        <box name="pomo-presets-row" $={(self) => self.set_halign(Gtk.Align.CENTER)}>
          {PRESETS.map((p, i) => (
            <button
              name="pomo-preset-btn"
              $={(self) => {
                const sc = self.get_style_context()
                const update = () => {
                  const isMatch = workMinutes.get() === p.work && breakMinutes.get() === p.brk
                  if (isMatch && !showCustom.get()) sc.add_class("active")
                  else sc.remove_class("active")
                }
                workMinutes.subscribe(update)
                breakMinutes.subscribe(update)
                showCustom.subscribe(update)
                update()
              }}

              onClicked={() => {
                setWorkMinutes(p.work)
                setBreakMinutes(p.brk)
                setShowCustom(false)
              }}
            >
              <label label={p.label} />
            </button>
          ))}
          <button
            name="pomo-preset-btn"
            class={showCustom.as((c) => c ? "active" : "")}
            onClicked={() => setShowCustom(!showCustom.get())}
          >
            <label label="CUST" />
          </button>
        </box>

        {/* Time adjusters (visible only in custom mode) */}
        <box name="pomo-adjusters" vertical
          css={showCustom.as((v) => `opacity: ${v ? 1 : 0};`)}
        >
            <box name="pomo-adjuster-row">
              <label name="pomo-adj-label" label="WORK" />
              <box hexpand />
              <button
                name="pomo-adj-btn"

                onClicked={() => {
                  const cur = workMinutes.get()
                  setWorkMinutes(cur <= 5 ? 1 : Math.floor((cur - 1) / 5) * 5)
                }}
              >
                <label label="-" />
              </button>
              <label name="pomo-adj-value" label={workMinutes.as((m) => `${m}m`)} />
              <button
                name="pomo-adj-btn"

                onClicked={() => {
                  const cur = workMinutes.get()
                  setWorkMinutes(Math.min(90, cur < 5 ? 5 : Math.ceil((cur + 1) / 5) * 5))
                }}
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

{/* block dots moved to after mode toggle */}

        {/* Control buttons */}
        <box name="pomo-controls-row" $={(self) => self.set_halign(Gtk.Align.CENTER)}>
          <button
            name="pomo-start-btn"
            class={running.as((r) => r ? "running" : "")}

            onClicked={() => {
              if (phase.get() === "idle") {
                startWork()
              } else {
                if (running.get()) {
                  setRunning(false)
                  fadeOutMpv(1000)
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
            class={focusedPage.as((p) => p === "page3" ? "active" : "")}
            onClicked={() => toggleFocusedPage("page3")}
          >
            <label name="pomo-mode-label" label="⏼ PANE FOCUS" />
          </button>
        </box>

        {/* Audio section */}
        <label name="section-header" label="//AUDIO" />

        {/* Audio theme selector */}
        <box name="pomo-audio-row" $={(self) => self.set_halign(Gtk.Align.CENTER)}>
          <button
            name="pomo-adj-btn"
            onClicked={() => switchAudioTheme(Math.max(0, audioThemeIndex.get() - 1))}
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
            onClicked={() => switchAudioTheme(audioThemeIndex.get() + 1)}
          >
            <label label="▶" />
          </button>
        </box>

        {/* Playback controls */}
        <box name="pomo-audio-row" $={(self) => self.set_halign(Gtk.Align.CENTER)}>
          <button name="pomo-adj-btn" onClicked={() => skipTrack()}>
            <label label="⏮" />
          </button>
          <button name="pomo-adj-btn" onClicked={() => seekMpv(-30)}>
            <label label="⏪" />
          </button>
          <button name="pomo-adj-btn" onClicked={() => {
            execAsync(["bash", "-c", `echo '{ "command": ["cycle", "pause"] }' | socat - ${MPV_SOCKET}`]).catch(() => {})
            setMusicPaused(!musicPaused.get())
          }}>
            <label label={musicPaused.as((p) => p ? "▶" : "⏸")} />
          </button>
          <button name="pomo-adj-btn" onClicked={() => seekMpv(30)}>
            <label label="⏩" />
          </button>
          <button name="pomo-adj-btn" onClicked={() => skipTrack()}>
            <label label="⏭" />
          </button>
        </box>

        {/* Volume bar */}
        <box name="eq-panel" vertical>
          <box name="control-header">
            <button name="control-icon-btn" onClicked={() => {
              const next = !audioEnabled.get()
              setAudioEnabled(next)
              if (!next) killMpv()
              else if (running.get()) {
                const p = phase.get()
                if (p === "work") playMusic("work")
                else if (p === "break") playMusic("break")
              }
            }}>
              <label name="control-icon" label={audioEnabled.as((a) => a ? "" : "")} />
            </button>
            <label name="control-label" label="VOL" />
            <box hexpand />
            <label name="control-value" label={volume.as((v) => `${Math.round(v * 100)}%`)} />
          </box>
          {(() => {
            const eb = new Gtk.EventBox({ visible: true })
            let dragging = false
            let lastY = 0
            eb.add_events(
              Gdk.EventMask.BUTTON_PRESS_MASK |
              Gdk.EventMask.BUTTON_RELEASE_MASK |
              Gdk.EventMask.POINTER_MOTION_MASK |
              Gdk.EventMask.SCROLL_MASK
            )
            eb.connect("button-press-event", (_w: any, event: any) => {
              dragging = true
              eb.grab_add()
              const [, x, y] = event.get_coords()
              lastY = y
              const w = eb.get_allocated_width()
              const v = Math.max(0, Math.min(1, x / w))
              setVolume(v)
              setMpvVolume(v)
              return true
            })
            eb.connect("button-release-event", () => {
              dragging = false
              eb.grab_remove()
              return true
            })
            eb.connect("motion-notify-event", (_w: any, event: any) => {
              if (!dragging) return false
              const [, x, y] = event.get_coords()
              const w = eb.get_allocated_width()
              const h = eb.get_allocated_height()
              const dy = lastY - y
              lastY = y
              let v: number
              if (Math.abs(dy) > 1) {
                v = volume.get() + dy / (h * 3)
              } else {
                v = x / w
              }
              v = Math.max(0, Math.min(1, v))
              setVolume(v)
              setMpvVolume(v)
              return true
            })
            eb.connect("scroll-event", (_w: any, event: any) => {
              const dir = event.get_scroll_direction()[1]
              const cur = volume.get()
              let v = cur
              if (dir === Gdk.ScrollDirection.UP) v = cur + 0.05
              else if (dir === Gdk.ScrollDirection.DOWN) v = cur - 0.05
              v = Math.max(0, Math.min(1, v))
              setVolume(v)
              setMpvVolume(v)
              return true
            })
            const hbar = (
              <box name="eq-hbar">
                {Array(16).fill(0).map((_, i) => (
                  <box name="eq-hseg" hexpand
                    class={volume.as((v) => i < Math.round(v * 16) ? "lit" : "unlit")}
                  />
                ))}
              </box>
            )
            eb.add(hbar)
            return eb
          })()}
        </box>
      </box>
    </eventbox>
  )
}

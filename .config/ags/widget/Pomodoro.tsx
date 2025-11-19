import { Gtk } from "ags/gtk3"
import { createState } from "ags"
import { createPoll } from "../utils/poll"
import { execAsync } from "ags/process"
import { musicPlayer } from "../utils/music"

const WORK_DEFAULT = 50
const BREAK_DEFAULT = 10

type Mode = "work" | "break"
type State = "stopped" | "running" | "paused"
type SessionMode = "single" | "block"

// Pomodoro state management
const [mode, setMode] = createState<Mode>("work")
const [state, setState] = createState<State>("stopped")
const [sessionMode, setSessionMode] = createState<SessionMode>("single")
const [workTime, setWorkTime] = createState(WORK_DEFAULT)
const [breakTime, setBreakTime] = createState(BREAK_DEFAULT)
const [timeLeft, setTimeLeft] = createState(WORK_DEFAULT * 60)
const [startTime, setStartTime] = createState(0)
const [pausedTime, setPausedTime] = createState(0)

// Study block state
const [studyBlockActive, setStudyBlockActive] = createState(false)
const [studyBlockTotal, setStudyBlockTotal] = createState(0)
const [studyBlockCompleted, setStudyBlockCompleted] = createState(0)
const [studyHours, setStudyHours] = createState(0)
const [selectedRatio, setSelectedRatio] = createState("50-10")

// Audio state
const [audioEnabled, setAudioEnabled] = createState(true)
const [volume, setVolume] = createState(60)

const ratios: Record<string, { work: number; break: number; label: string }> = {
  "25-5": { work: 25, break: 5, label: "25/5" },
  "50-10": { work: 50, break: 10, label: "50/10" },
  "45-15": { work: 45, break: 15, label: "45/15" },
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

const currentDuration = () => {
  return mode.get() === "work" ? workTime.get() * 60 : breakTime.get() * 60
}

const start = () => {
  setStartTime(Date.now())
  setState("running")
  if (audioEnabled.get()) {
    musicPlayer.playNotification("session_started")
    setTimeout(() => {
      musicPlayer.fadeIn(mode.get() === "work")
    }, 1000) // Wait 1 second after notification
  }
}

const pause = () => {
  if (state.get() === "running") {
    setPausedTime(pausedTime.get() + Math.floor((Date.now() - startTime.get()) / 1000))
    if (audioEnabled.get()) {
      musicPlayer.fadeOutFast()
    }
  }
  setState(state.get() === "running" ? "paused" : "running")
  if (state.get() === "running") {
    setStartTime(Date.now())
    if (audioEnabled.get()) {
      musicPlayer.fadeIn(mode.get() === "work")
    }
  }
}

const reset = () => {
  setState("stopped")
  setMode("work")
  setPausedTime(0)
  setTimeLeft(workTime.get() * 60)
  setStudyBlockActive(false)
  setStudyBlockCompleted(0)
  setStudyBlockTotal(0)
  musicPlayer.stop()
}

const startStudyBlock = (totalPomodoros: number) => {
  setStudyBlockActive(true)
  setStudyBlockTotal(totalPomodoros)
  setStudyBlockCompleted(0)
  setMode("work")
  setTimeLeft(workTime.get() * 60)
  setPausedTime(0)

  setStartTime(Date.now())
  setState("running")
  if (audioEnabled.get()) {
    musicPlayer.playNotification("study_block_started")
    setTimeout(() => {
      musicPlayer.fadeIn(true)
    }, 2000) // Wait 2 seconds for study block notification
  }
}

const stopStudyBlock = () => {
  setStudyBlockActive(false)
  setStudyBlockCompleted(0)
  setStudyBlockTotal(0)
  reset()
}

function TimeDisplay() {
  return (
    <box class="timer-display" vertical spacing={4}>
      <label
        class="timer-text"
        label={timeLeft((t) => formatTime(t))}
        halign={Gtk.Align.CENTER}
      />
      <label
        class="mode-text"
        label={mode((m) => m === "work" ? "Work Session" : "Break Time")}
        halign={Gtk.Align.CENTER}
      />
    </box>
  )
}

function ModeSelector() {
  return (
    <box class="mode-selector" spacing={8} homogeneous>
      <button
        class="mode-button"
        onClicked={() => setSessionMode("single")}
        $={(self) => {
          self.connect("realize", () => {
            const updateClass = () => {
              const context = self.get_style_context()
              const isActive = sessionMode.get() === "single"
              if (isActive) {
                context.add_class("active")
              } else {
                context.remove_class("active")
              }
            }
            sessionMode.subscribe(updateClass)
            updateClass()
          })
        }}
      >
        <label label="Single Session" />
      </button>
      <button
        class="mode-button"
        onClicked={() => setSessionMode("block")}
        $={(self) => {
          self.connect("realize", () => {
            const updateClass = () => {
              const context = self.get_style_context()
              const isActive = sessionMode.get() === "block"
              if (isActive) {
                context.add_class("active")
              } else {
                context.remove_class("active")
              }
            }
            sessionMode.subscribe(updateClass)
            updateClass()
          })
        }}
      >
        <label label="Study Block" />
      </button>
    </box>
  )
}

function SingleSessionControls() {
  return (
    <box class="single-session" vertical spacing={8}>
      <box class="time-selector" vertical spacing={8}>
        <box class="slider-row" spacing={8}>
          <label class="slider-label" label="Work:" />
          <slider
            class="slider"
            hexpand
            drawValue={false}
            min={25}
            max={90}
            value={workTime((v) => v)}
            onDragged={({ value }) => {
              const newTime = Math.round(value)
              setWorkTime(newTime)
              // Update timer display if stopped and in work mode
              if (state.get() === "stopped" && mode.get() === "work") {
                setTimeLeft(newTime * 60)
              }
            }}
          />
          <label class="slider-value" label={workTime((v) => `${v}m`)} />
        </box>
        <box class="slider-row" spacing={8}>
          <label class="slider-label" label="Break:" />
          <slider
            class="slider"
            hexpand
            drawValue={false}
            min={5}
            max={30}
            value={breakTime((v) => v)}
            onDragged={({ value }) => {
              const newTime = Math.round(value)
              setBreakTime(newTime)
              // Update timer display if stopped and in break mode
              if (state.get() === "stopped" && mode.get() === "break") {
                setTimeLeft(newTime * 60)
              }
            }}
          />
          <label class="slider-value" label={breakTime((v) => `${v}m`)} />
        </box>
      </box>
    </box>
  )
}

function StudyBlockControls() {
  const calculatePomodoros = (hours: number, ratio: string) => {
    const totalMinutes = hours * 60
    const r = ratios[ratio]
    const cycleTime = r.work + r.break
    return Math.floor(totalMinutes / cycleTime)
  }

  const updateRatio = (ratio: string) => {
    setSelectedRatio(ratio)
    const r = ratios[ratio]
    setWorkTime(r.work)
    setBreakTime(r.break)
    // Update timer display if stopped
    if (state.get() === "stopped") {
      if (mode.get() === "work") {
        setTimeLeft(r.work * 60)
      } else {
        setTimeLeft(r.break * 60)
      }
    }
  }

  return (
    <box class="study-block" vertical spacing={8}>
      <box class="ratio-selector" spacing={6} homogeneous>
        {Object.entries(ratios).map(([key, ratio]) => (
          <button
            class="ratio-button"
            onClicked={() => updateRatio(key)}
            $={(self) => {
              self.connect("realize", () => {
                const updateClass = () => {
                  const context = self.get_style_context()
                  const isActive = selectedRatio.get() === key
                  if (isActive) {
                    context.add_class("active")
                  } else {
                    context.remove_class("active")
                  }
                }
                selectedRatio.subscribe(updateClass)
                updateClass()
              })
            }}
          >
            <label label={ratio.label} />
          </button>
        ))}
      </box>
      <box class="slider-row" spacing={8}>
        <label class="slider-label" label="Hours:" />
        <slider
          class="slider"
          hexpand
          drawValue={false}
          min={0}
          max={8}
          step={0.5}
          value={studyHours((v) => v)}
          onDragged={({ value }) => setStudyHours(Math.round(value * 2) / 2)}
        />
        <label class="slider-value" label={studyHours((v) => v === 0 ? "--" : `${v}h`)} />
      </box>
      <label
        class="study-summary"
        label={studyHours((hours) => {
          if (hours === 0) return ""
          const now = new Date()
          const totalMinutes = hours * 60
          const finishTime = new Date(now.getTime() + totalMinutes * 60000)
          const h = finishTime.getHours().toString().padStart(2, "0")
          const m = finishTime.getMinutes().toString().padStart(2, "0")
          return `Finish at ${h}:${m}`
        })}
        halign={Gtk.Align.CENTER}
      />
    </box>
  )
}

function StudyBlockProgress() {
  return (
    <box
      class="study-block-progress"
      vertical
      spacing={4}
      visible={studyBlockActive}
    >
      <label
        class="progress-label"
        label={studyBlockCompleted((c) => `${c} / ${studyBlockTotal.get()}`)}
        halign={Gtk.Align.CENTER}
      />
      <box class="progress-bar-container" vertical halign={Gtk.Align.CENTER}>
        {Array.from({ length: 12 }).map((_, i) => (
          <box
            class="progress-segment"
            $={(self) => {
              self.connect("realize", () => {
                const update = () => {
                  const completed = studyBlockCompleted.get()
                  const total = studyBlockTotal.get()
                  const segmentIndex = total - 1 - i

                  self.visible = segmentIndex < total
                  const context = self.get_style_context()
                  const isCompleted = segmentIndex < completed
                  const isActive = segmentIndex === completed && mode.get() === "work"

                  if (isCompleted) {
                    context.add_class("completed")
                  } else {
                    context.remove_class("completed")
                  }

                  if (isActive) {
                    context.add_class("active")
                  } else {
                    context.remove_class("active")
                  }
                }
                studyBlockCompleted.subscribe(update)
                studyBlockTotal.subscribe(update)
                mode.subscribe(update)
                update()
              })
            }}
          />
        ))}
      </box>
    </box>
  )
}

function Controls() {
  return (
    <box
      class="controls"
      vertical
      spacing={8}
      $={(self) => {
        self.connect("realize", () => {
          const updateControls = () => {
            const currentState = state.get()
            const blockActive = studyBlockActive.get()
            const hours = studyHours.get()
            const mode = sessionMode.get()

            self.get_children().forEach((child: any) => child.destroy())

            if (currentState === "stopped") {
              self.add(
                <button
                  class="control-button start-pause"
                  hexpand
                  sensitive={mode === "single" || hours > 0}
                  onClicked={() => {
                    if (mode === "block" && hours > 0) {
                      const totalPomodoros = Math.floor((hours * 60) / (workTime.get() + breakTime.get()))
                      startStudyBlock(totalPomodoros)
                    } else {
                      start()
                    }
                  }}
                >
                  <label label={mode === "block" && hours > 0 ? ` Start Block (${hours}h)` : " Start"} />
                </button>
              )
            } else if (currentState === "running") {
              self.add(
                <box spacing={8}>
                  <button
                    class="control-button start-pause"
                    hexpand
                    onClicked={pause}
                  >
                    <label label="󰏤 Pause" />
                  </button>
                  <button
                    class="control-button reset"
                    hexpand
                    onClicked={() => blockActive ? stopStudyBlock() : reset()}
                  >
                    <label label={blockActive ? " Stop Block" : " Stop"} />
                  </button>
                </box>
              )
            } else {
              self.add(
                <box spacing={8}>
                  <button
                    class="control-button start-pause"
                    hexpand
                    onClicked={pause}
                  >
                    <label label=" Resume" />
                  </button>
                  <button
                    class="control-button reset"
                    hexpand
                    onClicked={() => blockActive ? stopStudyBlock() : reset()}
                  >
                    <label label={blockActive ? " Stop Block" : " Stop"} />
                  </button>
                </box>
              )
            }
            self.show_all()
          }

          state.subscribe(updateControls)
          studyBlockActive.subscribe(updateControls)
          studyHours.subscribe(updateControls)
          sessionMode.subscribe(updateControls)
          updateControls()
        })
      }}
    />
  )
}

function AudioControls() {
  return (
    <box class="audio-controls" vertical spacing={8}>
      <box class="audio-toggle" spacing={8} halign={Gtk.Align.CENTER}>
        <switch
          active={audioEnabled}
          onActivate={({ active }) => setAudioEnabled(active)}
        />
        <label label="Pomodoro Music" />
      </box>
      <box class="slider-row" spacing={8}>
        <label class="slider-label" label="Volume:" />
        <slider
          class="slider"
          hexpand
          drawValue={false}
          min={0}
          max={100}
          step={5}
          value={volume((v) => v)}
          onDragged={({ value }) => {
            const newVolume = Math.round(value)
            setVolume(newVolume)
            musicPlayer.setTargetVolume(newVolume)
          }}
        />
        <label class="slider-value" label={volume((v) => `${v}%`)} />
      </box>
    </box>
  )
}

export default function Pomodoro({ onClose }: { onClose: () => void }) {
  // Timer poll - keep reference to prevent optimization
  const _poll = createPoll(0, 1000, () => {
    if (state.get() !== "running") return timeLeft.get()

    const now = Date.now()
    const elapsed = Math.floor((now - startTime.get()) / 1000)
    const remaining = currentDuration() - elapsed - pausedTime.get()

    if (remaining <= 0) {
      // Timer finished
      const currentMode = mode.get()

      if (studyBlockActive.get()) {
        if (currentMode === "work") {
          // Work session done, start break
          const newCompleted = studyBlockCompleted.get() + 1
          setStudyBlockCompleted(newCompleted)

          if (audioEnabled.get()) {
            musicPlayer.fadeOut(() => {
              musicPlayer.playNotification("session_end")
              setTimeout(() => {
                if (newCompleted >= studyBlockTotal.get()) {
                  // Study block complete - don't start break music
                  stopStudyBlock()
                } else {
                  musicPlayer.fadeIn(false) // Start break music
                }
              }, 1000)
            })
          }

          if (newCompleted >= studyBlockTotal.get()) {
            // Study block complete
            if (!audioEnabled.get()) stopStudyBlock()
          } else {
            setMode("break")
            setTimeLeft(breakTime.get() * 60)
            setPausedTime(0)
            setStartTime(Date.now())
          }
        } else {
          // Break done, start next work session
          if (audioEnabled.get()) {
            musicPlayer.fadeOut(() => {
              musicPlayer.playNotification("break_end")
              setTimeout(() => {
                musicPlayer.fadeIn(true) // Start work music
              }, 1000)
            })
          }

          setMode("work")
          setTimeLeft(workTime.get() * 60)
          setPausedTime(0)
          setStartTime(Date.now())
        }
      } else {
        // Single session done
        if (audioEnabled.get()) {
          const wasWork = currentMode === "work"
          musicPlayer.fadeOut(() => {
            musicPlayer.playNotification(wasWork ? "session_end" : "break_end")
          })
        }

        setState("stopped")
        setMode(currentMode === "work" ? "break" : "work")
        setTimeLeft(currentDuration())
        setPausedTime(0)
      }

      return 0
    }

    setTimeLeft(remaining)
    return remaining
  })
  // Reference poll to ensure it's not tree-shaken
  void _poll

  return (
    <box class="pomodoro" vertical spacing={16}>
      <label class="header" label="Pomodoro Timer" />
      <TimeDisplay />
      <StudyBlockProgress />
      <ModeSelector />
      <box
        vertical
        spacing={8}
        visible={sessionMode((m) => m === "single")}
      >
        <SingleSessionControls />
      </box>
      <box
        vertical
        spacing={8}
        visible={sessionMode((m) => m === "block")}
      >
        <StudyBlockControls />
      </box>
      <Controls />
      <AudioControls />
      <button
        class="close-button"
        onClicked={onClose}
        halign={Gtk.Align.CENTER}
      >
        <label label="Close" />
      </button>
    </box>
  )
}

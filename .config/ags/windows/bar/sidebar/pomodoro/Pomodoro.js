import Pomodoro from '../../../../services/Pomodoro.js'
import { breakPopupEnabled } from '../../../../shared/vars.js'

function TimerDisplay() {
  return Widget.Box({
    className: 'timer_display',
    vertical: true,
    hpack: 'center',
    children: [
      Widget.Label({
        className: 'timer_text',
        label: Pomodoro.bind('time_remaining').transform(() => Pomodoro.formatTime()),
      }),
      Widget.Label({
        className: 'mode_text',
        label: Pomodoro.bind('mode').transform((mode) => {
          if (mode === 'work') return 'Work Session'
          if (mode === 'short-break') return 'Short Break'
          if (mode === 'long-break') return 'Long Break'
          return ''
        }),
      }).hook(Pomodoro, (self) => {
        const mode = Pomodoro.mode
        self.toggleClassName('work', mode === 'work')
        self.toggleClassName('break', mode === 'short-break' || mode === 'long-break')
      }, 'timer-changed'),
    ],
  })
}

function Controls() {
  const StartPauseButton = Widget.Button({
    className: 'control_button start_pause',
    hexpand: true,
    child: Widget.Label({
      label: Pomodoro.bind('state').transform((state) => {
        if (state === 'running') return '󰏤 Pause'
        if (state === 'paused') return ' Resume'
        return ' Start'
      }),
      setup: (self) => {
        const state = Pomodoro.state
        if (state === 'running') self.label = '󰏤 Pause'
        else if (state === 'paused') self.label = ' Resume'
        else self.label = ' Start'
      },
    }),
    onPrimaryClick: () => Pomodoro.toggle(),
  })

  const ResetButton = Widget.Button({
    className: 'control_button reset',
    hexpand: true,
    child: Widget.Label(' Reset'),
    onPrimaryClick: () => Pomodoro.reset(),
  })

  return Widget.Box({
    className: 'controls',
    spacing: 8,
    children: [StartPauseButton, ResetButton],
  })
}

function TimeSelector(onManualChange, studyHours) {
  return Widget.Box({
    className: 'time_selector',
    vertical: true,
    spacing: 8,
    children: [
      Widget.Box({
        className: 'slider_row',
        spacing: 12,
        children: [
          Widget.Label({
            className: 'slider_icon',
            label: '',
          }),
          Widget.Box({
            vertical: true,
            spacing: 2,
            children: [
              Widget.Label({
                className: 'slider_label',
                label: 'Work Time',
                hpack: 'start',
              }),
              Widget.Slider({
                className: 'slider',
                drawValue: false,
                min: 1,
                max: 90,
                step: 1,
                value: Pomodoro.getWorkTime(),
                onChange: ({ value }) => {
                  Pomodoro.setWorkTime(Math.round(value))
                  if (onManualChange) onManualChange()
                },
                setup: (self) => {
                  self.value = Pomodoro.getWorkTime()
                  self.sensitive = Pomodoro.state === 'stopped'
                },
              }).hook(Pomodoro, (self) => {
                self.sensitive = Pomodoro.state === 'stopped'
              }, 'state-changed').hook(Pomodoro, (self) => {
                self.value = Pomodoro.getWorkTime()
              }, 'timer-changed'),
            ],
          }),
          Widget.Label({
            className: 'slider_value',
            label: `${Pomodoro.getWorkTime()}m`,
          }).hook(Pomodoro, (self) => {
            self.label = `${Pomodoro.getWorkTime()}m`
          }, 'timer-changed'),
        ],
      }),
      Widget.Box({
        className: 'slider_row',
        spacing: 12,
        children: [
          Widget.Label({
            className: 'slider_icon',
            label: '',
          }),
          Widget.Box({
            vertical: true,
            spacing: 2,
            children: [
              Widget.Label({
                className: 'slider_label',
                label: 'Break Time',
                hpack: 'start',
              }),
              Widget.Slider({
                className: 'slider',
                drawValue: false,
                min: 1,
                max: 30,
                step: 1,
                value: Pomodoro.getBreakTime(),
                onChange: ({ value }) => {
                  Pomodoro.setBreakTime(Math.round(value))
                  if (onManualChange) onManualChange()
                },
                setup: (self) => {
                  self.value = Pomodoro.getBreakTime()
                  self.sensitive = Pomodoro.state === 'stopped'
                },
              }).hook(Pomodoro, (self) => {
                self.sensitive = Pomodoro.state === 'stopped'
              }, 'state-changed').hook(Pomodoro, (self) => {
                self.value = Pomodoro.getBreakTime()
              }, 'timer-changed'),
            ],
          }),
          Widget.Label({
            className: 'slider_value',
            label: `${Pomodoro.getBreakTime()}m`,
          }).hook(Pomodoro, (self) => {
            self.label = `${Pomodoro.getBreakTime()}m`
          }, 'timer-changed'),
        ],
      }),
      Widget.Slider({
        drawValue: false,
        min: 0,
        max: 4,
        step: 1,
        value: studyHours.bind(),
        onChange: ({ value }) => {
          studyHours.value = Math.round(value)
        },
      }),
    ],
  })
}

function SessionInfo() {
  return Widget.Box({
    className: 'session_info',
    vertical: true,
    spacing: 8,
    children: [
      Widget.Label({
        className: 'info_label',
        label: 'Pomodoro Timer',
        hpack: 'center',
      }),
      Widget.Box({
        className: 'popup_toggle',
        spacing: 8,
        hpack: 'center',
        children: [
          Widget.Switch({
            active: breakPopupEnabled.bind(),
            onActivate: ({ active }) => {
              breakPopupEnabled.value = active
            },
          }),
          Widget.Label({
            className: 'toggle_label',
            label: 'Break Popup',
          }),
        ],
      }),
    ],
  })
}

function StudyBlockControl(studyHours) {
  print('StudyBlockControl called')
  const selectedRatio = Variable('50-10')
  const isStudyMode = Variable(false)

  const ratios = {
    '25-5': { work: 25, break: 5, label: '25/5' },
    '50-10': { work: 50, break: 10, label: '50/10' },
    '45-15': { work: 45, break: 15, label: '45/15' },
  }

  const calculatePomodoros = (hours, ratioKey) => {
    const totalMinutes = hours * 60
    const ratio = ratios[ratioKey]
    const cycleTime = ratio.work + ratio.break
    return Math.floor(totalMinutes / cycleTime)
  }

  const pomodoroCount = Variable(0)

  // Initialize study mode based on current hours value
  if (studyHours.value >= 1) {
    isStudyMode.value = true
    const ratio = ratios[selectedRatio.value]
    Pomodoro.setWorkTime(ratio.work)
    Pomodoro.setBreakTime(ratio.break)
    pomodoroCount.value = calculatePomodoros(studyHours.value, selectedRatio.value)
  }

  studyHours.connect('changed', ({ value }) => {
    if (value >= 1) {
      isStudyMode.value = true
      const ratio = ratios[selectedRatio.value]
      Pomodoro.setWorkTime(ratio.work)
      Pomodoro.setBreakTime(ratio.break)
      pomodoroCount.value = calculatePomodoros(value, selectedRatio.value)
    } else {
      isStudyMode.value = false
      pomodoroCount.value = 0
    }
  })

  selectedRatio.connect('changed', ({ value }) => {
    if (studyHours.value >= 1) {
      const ratio = ratios[value]
      Pomodoro.setWorkTime(ratio.work)
      Pomodoro.setBreakTime(ratio.break)
      pomodoroCount.value = calculatePomodoros(studyHours.value, value)
    }
  })

  return Widget.Box({
    className: 'study_block_control',
    vertical: true,
    spacing: 8,
    children: [
      Widget.Label({
        className: 'study_label',
        label: 'Study Block',
        hpack: 'start',
      }),
      Widget.Box({
        className: 'ratio_selector',
        spacing: 6,
        homogeneous: true,
        visible: isStudyMode.bind(),
        children: Object.entries(ratios).map(([key, ratio]) =>
          Widget.Button({
            className: 'ratio_button',
            label: ratio.label,
            onClicked: () => {
              selectedRatio.value = key
            },
            setup: (self) => {
              self.hook(selectedRatio, () => {
                self.toggleClassName('active', selectedRatio.value === key)
              })
            },
          })
        ),
      }),
      Widget.Label({
        className: 'study_summary',
        visible: isStudyMode.bind(),
        label: pomodoroCount.bind().as(count => {
          const ratio = ratios[selectedRatio.value]
          return `${count} × (${ratio.work}min + ${ratio.break}min)`
        }),
        hpack: 'center',
      }),
      Widget.Button({
        className: 'study_block_button',
        hexpand: true,
        sensitive: isStudyMode.bind(),
        child: Widget.Label({
          label: Pomodoro.bind('study_block_active').as(active =>
            active ? ' Stop Block' : ' Start Block'
          ),
        }),
        onClicked: () => {
          if (Pomodoro.study_block_active) {
            Pomodoro.stopStudyBlock()
          } else {
            Pomodoro.startStudyBlock(pomodoroCount.value)
          }
        },
      }),
    ],
  })
}

function StudyBlockProgress() {
  return Widget.Box({
    className: 'study_block_progress',
    vertical: true,
    spacing: 8,
    visible: Pomodoro.bind('study_block_active'),
    children: [
      Widget.Label({
        className: 'progress_label',
        hpack: 'center',
        setup: (self) => {
          self.hook(Pomodoro, () => {
            const completed = Pomodoro.study_block_completed
            const total = Pomodoro.study_block_total
            self.label = `${completed} / ${total}`
          }, 'study-block-changed')
        },
      }),
      Widget.Box({
        className: 'progress_bar_container',
        vertical: true,
        hpack: 'center',
        children: Array.from({ length: 12 }).map((_, i) =>
          Widget.Box({
            className: 'progress_segment',
            setup: (self) => {
              self.hook(Pomodoro, () => {
                const completed = Pomodoro.study_block_completed
                const total = Pomodoro.study_block_total
                const segmentIndex = total - 1 - i // Reverse order (bottom to top)

                self.visible = segmentIndex < total
                self.toggleClassName('completed', segmentIndex < completed)
                self.toggleClassName('active', segmentIndex === completed && Pomodoro.mode === 'work')
              }, 'study-block-changed')
            },
          })
        ),
      }),
    ],
  })
}

export default function() {
  const studyHours = Variable(0)

  return Widget.Box({
    className: 'pomodoro',
    vertical: true,
    children: [
      Widget.Box({
        vertical: true,
        spacing: 20,
        children: [
          SessionInfo(),
          TimeSelector(() => {
            // Reset study hours when manual time adjustment is made
            studyHours.value = 0
          }, studyHours),
          TimerDisplay(),
          Controls(),
          Widget.Separator(),
          StudyBlockControl(studyHours),
        ],
      }),
      Widget.Box({
        spacing: 16,
        children: [
          StudyBlockProgress(),
          Widget.Box({ hexpand: true }),
        ],
      }),
    ],
  })
}

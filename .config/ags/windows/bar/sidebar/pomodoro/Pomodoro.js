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

function HoursSlider(studyHours) {
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
                label: 'Hours',
                hpack: 'start',
              }),
              Widget.Slider({
                className: 'slider',
                drawValue: false,
                min: 0,
                max: 8,
                step: 1,
                value: studyHours.bind(),
                onChange: ({ value }) => {
                  studyHours.value = Math.round(value)
                },
              }),
            ],
          }),
          Widget.Label({
            className: 'slider_value',
            label: studyHours.bind().as(v => v === 0 ? '--' : `${v}h`),
          }),
        ],
      }),
    ],
  })
}

function Controls(studyHours, currentMode) {
  return Widget.Box({
    className: 'controls',
    vertical: true,
    spacing: 8,
    setup: (self) => {
      const updateControls = () => {
        const state = Pomodoro.state
        const blockActive = Pomodoro.study_block_active
        const hours = studyHours.value
        const mode = currentMode.value

        if (state === 'stopped') {
          // Show single Start button
          self.children = [
            Widget.Button({
              className: 'control_button start_pause',
              hexpand: true,
              sensitive: mode === 'single' || hours > 0,
              child: Widget.Label(mode === 'block' && hours > 0 ? ` Start Block (${hours}h)` : ' Start'),
              onPrimaryClick: () => {
                if (mode === 'block' && hours > 0) {
                  const ratio = { work: 50, break: 10 }
                  const totalMinutes = hours * 60
                  const cycleTime = ratio.work + ratio.break
                  const totalPomodoros = Math.floor(totalMinutes / cycleTime)
                  Pomodoro.startStudyBlock(totalPomodoros)
                } else {
                  Pomodoro.start()
                }
              },
            }),
          ]
        } else if (state === 'running') {
          // Show Pause and Stop
          self.children = [
            Widget.Box({
              spacing: 8,
              children: [
                Widget.Button({
                  className: 'control_button start_pause',
                  hexpand: true,
                  child: Widget.Label('󰏤 Pause'),
                  onPrimaryClick: () => Pomodoro.pause(),
                }),
                Widget.Button({
                  className: 'control_button reset',
                  hexpand: true,
                  child: Widget.Label(blockActive ? ' Stop Block' : ' Stop'),
                  onPrimaryClick: () => {
                    if (blockActive) {
                      Pomodoro.stopStudyBlock()
                    } else {
                      Pomodoro.reset()
                    }
                  },
                }),
              ],
            }),
          ]
        } else {
          // Paused - show Resume and Stop
          self.children = [
            Widget.Box({
              spacing: 8,
              children: [
                Widget.Button({
                  className: 'control_button start_pause',
                  hexpand: true,
                  child: Widget.Label(' Resume'),
                  onPrimaryClick: () => Pomodoro.start(),
                }),
                Widget.Button({
                  className: 'control_button reset',
                  hexpand: true,
                  child: Widget.Label(blockActive ? ' Stop Block' : ' Stop'),
                  onPrimaryClick: () => {
                    if (blockActive) {
                      Pomodoro.stopStudyBlock()
                    } else {
                      Pomodoro.reset()
                    }
                  },
                }),
              ],
            }),
          ]
        }
      }

      // Initial update
      updateControls()

      // Hook for updates
      self.hook(Pomodoro, updateControls, 'state-changed')
      self.hook(Pomodoro, updateControls, 'study-block-changed')
      studyHours.connect('changed', updateControls)
      currentMode.connect('changed', updateControls)
    },
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
            hexpand: true,
            children: [
              Widget.Box({
                spacing: 4,
                children: [
                  Widget.Label({
                    className: 'slider_label',
                    label: 'Work Time:',
                    hpack: 'start',
                  }),
                  Widget.Label({
                    className: 'slider_label',
                    label: Pomodoro.bind('time_remaining').transform(() => `${Pomodoro.getWorkTime()}m`),
                    hpack: 'start',
                  }).hook(Pomodoro, (self) => {
                    self.label = `${Pomodoro.getWorkTime()}m`
                  }, 'timer-changed'),
                ],
              }),
              Widget.Slider({
                className: 'slider',
                drawValue: false,
                min: 0,
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
            hexpand: true,
            children: [
              Widget.Box({
                spacing: 4,
                children: [
                  Widget.Label({
                    className: 'slider_label',
                    label: 'Break Time:',
                    hpack: 'start',
                  }),
                  Widget.Label({
                    className: 'slider_label',
                    label: Pomodoro.bind('time_remaining').transform(() => `${Pomodoro.getBreakTime()}m`),
                    hpack: 'start',
                  }).hook(Pomodoro, (self) => {
                    self.label = `${Pomodoro.getBreakTime()}m`
                  }, 'timer-changed'),
                ],
              }),
              Widget.Slider({
                className: 'slider',
                drawValue: false,
                min: 0,
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
        ],
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
      Widget.Box({
        className: 'popup_toggle',
        spacing: 8,
        hpack: 'center',
        children: [
          Widget.Switch({
            setup: (self) => {
              self.active = Pomodoro.audio_enabled
              self.hook(Pomodoro, () => {
                self.active = Pomodoro.audio_enabled
              }, 'notify::audio-enabled')
            },
            onActivate: ({ active }) => {
              Pomodoro.toggleAudio()
            },
          }),
          Widget.Label({
            className: 'toggle_label',
            label: 'Audio',
          }),
        ],
      }),
      Widget.Box({
        className: 'volume_control',
        vertical: true,
        spacing: 4,
        children: [
          Widget.Box({
            spacing: 8,
            children: [
              Widget.Label({
                className: 'volume_icon',
                label: '󰕾',
              }),
              Widget.Label({
                className: 'volume_label',
                label: 'Volume',
                hexpand: true,
                hpack: 'start',
              }),
              Widget.Label({
                className: 'volume_value',
                setup: (self) => {
                  self.label = `${Pomodoro.getTargetVolume()}%`
                  self.hook(Pomodoro, () => {
                    self.label = `${Pomodoro.getTargetVolume()}%`
                  }, 'notify::target-volume')
                },
              }),
            ],
          }),
          Widget.Slider({
            className: 'volume_slider',
            drawValue: false,
            min: 0,
            max: 100,
            step: 5,
            value: Pomodoro.getTargetVolume(),
            onChange: ({ value }) => {
              Pomodoro.setTargetVolume(Math.round(value))
            },
            setup: (self) => {
              self.hook(Pomodoro, () => {
                self.value = Pomodoro.getTargetVolume()
              }, 'notify::target-volume')
            },
          }),
        ],
      }),
    ],
  })
}

function StudyBlockControl(studyHours) {
  print('StudyBlockControl called')
  const selectedRatio = Variable('50-10')

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

  // Initialize with default ratio
  const ratio = ratios[selectedRatio.value]
  Pomodoro.setWorkTime(ratio.work)
  Pomodoro.setBreakTime(ratio.break)
  pomodoroCount.value = calculatePomodoros(studyHours.value, selectedRatio.value)

  studyHours.connect('changed', ({ value }) => {
    const ratio = ratios[selectedRatio.value]
    Pomodoro.setWorkTime(ratio.work)
    Pomodoro.setBreakTime(ratio.break)
    pomodoroCount.value = calculatePomodoros(value, selectedRatio.value)
  })

  selectedRatio.connect('changed', ({ value }) => {
    const ratio = ratios[value]
    Pomodoro.setWorkTime(ratio.work)
    Pomodoro.setBreakTime(ratio.break)
    pomodoroCount.value = calculatePomodoros(studyHours.value, value)
  })

  return Widget.Box({
    className: 'study_block_control',
    vertical: true,
    spacing: 8,
    children: [
      Widget.Box({
        className: 'ratio_selector',
        spacing: 6,
        homogeneous: true,
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
      Widget.Box({
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
                hexpand: true,
                children: [
                  Widget.Box({
                    spacing: 4,
                    children: [
                      Widget.Label({
                        className: 'slider_label',
                        label: 'Hours:',
                        hpack: 'start',
                      }),
                      Widget.Label({
                        className: 'slider_label',
                        label: studyHours.bind().as(v => v === 0 ? '--' : `${v}h`),
                        hpack: 'start',
                      }),
                    ],
                  }),
                  Widget.Slider({
                    className: 'slider',
                    drawValue: false,
                    min: 0,
                    max: 8,
                    step: 1,
                    value: studyHours.bind(),
                    onChange: ({ value }) => {
                      studyHours.value = Math.round(value)
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      Widget.Label({
        className: 'study_summary',
        label: studyHours.bind().as(hours => {
          if (hours === 0) return ''
          const now = new Date()
          const totalMinutes = hours * 60
          const finishTime = new Date(now.getTime() + totalMinutes * 60000)
          const hoursStr = finishTime.getHours().toString().padStart(2, '0')
          const minutesStr = finishTime.getMinutes().toString().padStart(2, '0')
          return `Finish at ${hoursStr}:${minutesStr}`
        }),
        hpack: 'center',
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

function ModeSelector(currentMode) {
  return Widget.Box({
    className: 'mode_selector',
    spacing: 8,
    homogeneous: true,
    children: [
      Widget.Button({
        className: 'mode_button',
        label: 'Single Session',
        onClicked: () => {
          currentMode.value = 'single'
        },
        setup: (self) => {
          self.hook(currentMode, () => {
            self.toggleClassName('active', currentMode.value === 'single')
          })
        },
      }),
      Widget.Button({
        className: 'mode_button',
        label: 'Study Block',
        onClicked: () => {
          currentMode.value = 'block'
        },
        setup: (self) => {
          self.hook(currentMode, () => {
            self.toggleClassName('active', currentMode.value === 'block')
          })
        },
      }),
    ],
  })
}

export default function() {
  const studyHours = Variable(0)
  const currentMode = Variable('single')

  return Widget.Box({
    className: 'pomodoro',
    vertical: true,
    children: [
      SessionInfo(),
      TimerDisplay(),
      Widget.Box({
        vexpand: true,
        vpack: 'end',
        vertical: true,
        spacing: 20,
        children: [
          ModeSelector(currentMode),
          Widget.Box({
            className: 'mode_content_container',
            vertical: true,
            spacing: 20,
            children: [
              Widget.Box({
                vertical: true,
                spacing: 20,
                setup: (self) => {
                  const updateContent = () => {
                    if (currentMode.value === 'single') {
                      self.children = [
                        TimeSelector(() => {
                          studyHours.value = 0
                        }, studyHours),
                      ]
                    } else {
                      self.children = [
                        StudyBlockControl(studyHours),
                      ]
                    }
                  }
                  updateContent()
                  currentMode.connect('changed', updateContent)
                },
              }),
            ],
          }),
          Widget.Box({
            spacing: 16,
            children: [
              StudyBlockProgress(),
              Widget.Box({ hexpand: true }),
            ],
          }),
          Controls(studyHours, currentMode),
        ],
      }),
    ],
  })
}

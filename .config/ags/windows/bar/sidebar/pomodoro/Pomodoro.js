import Pomodoro from '../../../../services/Pomodoro.js'
import { breakPopupEnabled, sidebarShown, revealSideBar } from '../../../../shared/vars.js'

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

function Controls(studyHours, currentMode, selectedIndex) {
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
        const startIdx = mode === 'block' ? 6 : 2
        const resetIdx = mode === 'block' ? 7 : 3

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
              setup: (btn) => {
                btn.hook(selectedIndex, () => {
                  btn.toggleClassName('selected', selectedIndex.value === startIdx)
                })
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
                  setup: (btn) => {
                    btn.hook(selectedIndex, () => {
                      btn.toggleClassName('selected', selectedIndex.value === startIdx)
                    })
                  },
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
                  setup: (btn) => {
                    btn.hook(selectedIndex, () => {
                      btn.toggleClassName('selected', selectedIndex.value === resetIdx)
                    })
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
                  setup: (btn) => {
                    btn.hook(selectedIndex, () => {
                      btn.toggleClassName('selected', selectedIndex.value === startIdx)
                    })
                  },
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
                  setup: (btn) => {
                    btn.hook(selectedIndex, () => {
                      btn.toggleClassName('selected', selectedIndex.value === resetIdx)
                    })
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
      selectedIndex.connect('changed', updateControls)
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
        className: 'audio_theme_container',
        vertical: true,
        spacing: 8,
        children: [
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
                    label: '󰕾',
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
                            label: 'Volume:',
                            hpack: 'start',
                          }),
                          Widget.Label({
                            className: 'slider_label',
                            setup: (self) => {
                              self.label = `${Pomodoro.getTargetVolume()}%`
                              self.hook(Pomodoro, () => {
                                self.label = `${Pomodoro.getTargetVolume()}%`
                              }, 'notify::target-volume')
                            },
                            hpack: 'start',
                          }),
                        ],
                      }),
                      Widget.Slider({
                        className: 'slider',
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
              }),
            ],
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
                        className: 'theme_selector',
                        spacing: 8,
                        children: [
                          Widget.Button({
                            className: 'theme_nav_button',
                            child: Widget.Box({
                              hpack: 'center',
                              vpack: 'center',
                              child: Widget.Label('◀'),
                            }),
                            onClicked: () => {
                              const themes = Pomodoro.available_themes
                              const currentTheme = Pomodoro.current_theme
                              const currentIndex = themes.indexOf(currentTheme)
                              const prevIndex = (currentIndex - 1 + themes.length) % themes.length
                              Pomodoro.setTheme(themes[prevIndex])
                            },
                            setup: (self) => {
                              self.sensitive = Pomodoro.available_themes.length > 1
                              self.hook(Pomodoro, () => {
                                self.sensitive = Pomodoro.available_themes.length > 1
                              }, 'notify::available-themes')
                            },
                          }),
                          Widget.Label({
                            className: 'theme_label',
                            hexpand: true,
                            setup: (self) => {
                              self.label = Pomodoro.current_theme || 'No themes'
                              self.hook(Pomodoro, () => {
                                self.label = Pomodoro.current_theme || 'No themes'
                              }, 'notify::current-theme')
                            },
                          }),
                          Widget.Button({
                            className: 'theme_nav_button',
                            child: Widget.Box({
                              hpack: 'center',
                              vpack: 'center',
                              child: Widget.Label('▶'),
                            }),
                            onClicked: () => {
                              const themes = Pomodoro.available_themes
                              const currentTheme = Pomodoro.current_theme
                              const currentIndex = themes.indexOf(currentTheme)
                              const nextIndex = (currentIndex + 1) % themes.length
                              Pomodoro.setTheme(themes[nextIndex])
                            },
                            setup: (self) => {
                              self.sensitive = Pomodoro.available_themes.length > 1
                              self.hook(Pomodoro, () => {
                                self.sensitive = Pomodoro.available_themes.length > 1
                              }, 'notify::available-themes')
                            },
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

function StudyBlockControl(studyHours, selectedIndex, selectedRatio) {
  print('StudyBlockControl called')

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

  const getStepSize = (ratioKey) => {
    return ratioKey === '25-5' ? 0.5 : 1
  }

  selectedRatio.connect('changed', ({ value }) => {
    const ratio = ratios[value]
    Pomodoro.setWorkTime(ratio.work)
    Pomodoro.setBreakTime(ratio.break)
    pomodoroCount.value = calculatePomodoros(studyHours.value, value)
  })

  const ratioKeys = ['25-5', '50-10', '45-15']

  return Widget.Box({
    className: 'study_block_control',
    vertical: true,
    spacing: 8,
    children: [
      Widget.Box({
        className: 'ratio_selector',
        spacing: 6,
        homogeneous: true,
        children: Object.entries(ratios).map(([key, ratio], index) =>
          Widget.Button({
            className: 'ratio_button',
            label: ratio.label,
            onClicked: () => {
              selectedRatio.value = key
            },
            setup: (self) => {
              self.sensitive = Pomodoro.state === 'stopped'
              self.hook(selectedRatio, () => {
                self.toggleClassName('active', selectedRatio.value === key)
              })
              self.hook(selectedIndex, () => {
                self.toggleClassName('selected', selectedIndex.value === index + 2)
              })
            },
          }).hook(Pomodoro, (self) => {
            self.sensitive = Pomodoro.state === 'stopped'
          }, 'state-changed')
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
            setup: (self) => {
              self.hook(selectedIndex, () => {
                self.toggleClassName('selected', selectedIndex.value === 5)
              })
            },
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
                        label: studyHours.bind().as(v => {
                          if (v === 0) return '--'
                          return v % 1 === 0 ? `${v}h` : `${v}h`
                        }),
                        hpack: 'start',
                      }),
                    ],
                  }),
                  Widget.Slider({
                    className: 'slider',
                    drawValue: false,
                    min: 0,
                    max: 8,
                    step: getStepSize(selectedRatio.value),
                    value: studyHours.bind(),
                    onChange: ({ value }) => {
                      const step = getStepSize(selectedRatio.value)
                      studyHours.value = Math.round(value / step) * step
                    },
                    setup: (self) => {
                      self.sensitive = Pomodoro.state === 'stopped'
                      self.hook(selectedRatio, () => {
                        self.step = getStepSize(selectedRatio.value)
                        // Snap current value to new step size
                        const step = getStepSize(selectedRatio.value)
                        studyHours.value = Math.round(studyHours.value / step) * step
                      })
                    },
                  }).hook(Pomodoro, (self) => {
                    self.sensitive = Pomodoro.state === 'stopped'
                  }, 'state-changed'),
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

function ModeSelector(currentMode, selectedIndex) {
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
          self.hook(selectedIndex, () => {
            self.toggleClassName('selected', selectedIndex.value === 0)
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
          self.hook(selectedIndex, () => {
            self.toggleClassName('selected', selectedIndex.value === 1)
          })
        },
      }),
    ],
  })
}

export default function() {
  const studyHours = Variable(0)
  const currentMode = Variable('single')
  const selectedIndex = Variable(0)
  const selectedRatio = Variable('50-10')

  // Store widget references for navigation
  const controlRefs = {
    modeButtons: [],
    ratioButtons: [],
    controlButtons: []
  }

  // Hidden entry to capture keyboard input
  const keyboardEntry = Widget.Entry({
    visible: false,
    canFocus: true,
    setup: (self) => {
      // Hook on pane changes
      self.hook(sidebarShown, () => {
        if (sidebarShown.value === 'pomodoro') {
          selectedIndex.value = 0
          Utils.timeout(50, () => self.grab_focus())
        }
      })

      // Also hook on sidebar reveal to handle reopening
      self.hook(revealSideBar, () => {
        if (revealSideBar.value && sidebarShown.value === 'pomodoro') {
          selectedIndex.value = 0
          Utils.timeout(50, () => self.grab_focus())
        }
      })

      // j/k navigation with Enter to activate
      self.on('key-press-event', (widget, event) => {
        const keyval = event.get_keyval()[1]
        const state = Pomodoro.state

        // j - Move down
        if (keyval === 106) {
          const maxIndex = currentMode.value === 'block' ? 6 : 2
          selectedIndex.value = Math.min(maxIndex, selectedIndex.value + 1)
          return true
        }

        // k - Move up
        if (keyval === 107) {
          selectedIndex.value = Math.max(0, selectedIndex.value - 1)
          return true
        }

        // Enter - Activate selected control
        if (keyval === 65293) {
          const idx = selectedIndex.value

          // Mode buttons (0-1)
          if (idx <= 1 && state === 'stopped') {
            currentMode.value = idx === 0 ? 'single' : 'block'
            return true
          }

          // Ratio buttons (2-4) - block mode only
          if (idx >= 2 && idx <= 4 && currentMode.value === 'block' && state === 'stopped') {
            const ratios = ['25-5', '50-10', '45-15']
            selectedRatio.value = ratios[idx - 2]
            return true
          }

          // Hours slider (5) - use h/l to adjust
          if (idx === 5 && currentMode.value === 'block') {
            // Just highlight, use h/l to adjust
            return true
          }

          // Start/Pause button (6 in block, 2 in single)
          const startIdx = currentMode.value === 'block' ? 6 : 2
          if (idx === startIdx) {
            if (state === 'stopped') {
              if (currentMode.value === 'block' && studyHours.value > 0) {
                const ratioMap = {
                  '25-5': { work: 25, break: 5 },
                  '50-10': { work: 50, break: 10 },
                  '45-15': { work: 45, break: 15 }
                }
                const ratio = ratioMap[selectedRatio.value]
                const totalMinutes = studyHours.value * 60
                const cycleTime = ratio.work + ratio.break
                const totalPomodoros = Math.floor(totalMinutes / cycleTime)
                Pomodoro.startStudyBlock(totalPomodoros)
              } else {
                Pomodoro.start()
              }
            } else if (state === 'paused') {
              Pomodoro.start()
            } else if (state === 'running') {
              Pomodoro.pause()
            }
            return true
          }

          // Reset button (7 in block, 3 in single) - only when running/paused
          const resetIdx = currentMode.value === 'block' ? 7 : 3
          if (idx === resetIdx && state !== 'stopped') {
            if (Pomodoro.study_block_active) {
              Pomodoro.stopStudyBlock()
            } else {
              Pomodoro.reset()
            }
            return true
          }

          return true
        }

        // h - Decrease hours (when hours slider is selected)
        if (keyval === 104) {
          if (selectedIndex.value === 5 && currentMode.value === 'block' && state === 'stopped') {
            studyHours.value = Math.max(0, studyHours.value - 1)
          }
          return true
        }

        // l - Increase hours (when hours slider is selected)
        if (keyval === 108) {
          if (selectedIndex.value === 5 && currentMode.value === 'block' && state === 'stopped') {
            studyHours.value = Math.min(8, studyHours.value + 1)
          }
          return true
        }

        return true
      })
    }
  })

  return Widget.Box({
    className: 'pomodoro',
    vertical: true,
    children: [
      keyboardEntry,
      SessionInfo(),
      TimerDisplay(),
      Widget.Box({
        vexpand: true,
        vpack: 'end',
        vertical: true,
        spacing: 20,
        children: [
          ModeSelector(currentMode, selectedIndex),
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
                        StudyBlockControl(studyHours, selectedIndex, selectedRatio),
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
          Controls(studyHours, currentMode, selectedIndex),
        ],
      }),
    ],
  })
}

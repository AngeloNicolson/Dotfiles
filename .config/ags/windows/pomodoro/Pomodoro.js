import Pomodoro from '../../services/Pomodoro.js';
import { breakPopupEnabled, breakPopupVisible, revealSideBar } from '../../shared/vars.js';

function Header() {
  return Widget.Box({
    className: 'header',
    children: [
      Widget.Label({
        className: 'title',
        label: 'Break Time!',
        hpack: 'start',
        hexpand: true,
      }),
      Widget.Button({
        className: 'close_button',
        child: Widget.Label(''),
        tooltipText: 'Close (break continues in background)',
        onClicked: () => {
          breakPopupVisible.value = false
        },
      }),
    ],
  });
}

function SessionInfo() {
  return Widget.Box({
    className: 'session_info',
    vertical: true,
    spacing: 4,
    children: [
      Widget.Label({
        className: 'info_label',
        label: Pomodoro.bind('mode').transform((mode) => {
          if (mode === 'work') return 'Work Session'
          if (mode === 'short-break') return 'Short Break'
          if (mode === 'long-break') return 'Long Break'
          return 'Work Session'
        }),
        justification: 'center',
      }),
    ],
  });
}

function TimerDisplay() {
  return Widget.Box({
    className: 'timer_display',
    vertical: true,
    hpack: 'center',
    children: [
      Widget.Label({
        className: 'timer_text',
        label: Pomodoro.bind('time_remaining').transform(() =>
          Pomodoro.formatTime(),
        ),
      }),
    ],
  });
}

function BreakMessage() {
  return Widget.Label({
    className: 'break_message',
    label: Pomodoro.bind('mode').transform((mode) => {
      if (mode === 'short-break') return 'Take a short break and relax'
      if (mode === 'long-break') return 'Time for a longer break!'
      return 'Enjoy your break'
    }),
    wrap: true,
    justification: 'center',
  })
}

function PomodoroWidget() {
  return Widget.Box({
    className: 'pomodoro_window',
    vertical: true,
    spacing: 20,
    children: [Header(), SessionInfo(), TimerDisplay(), BreakMessage()],
  });
}

export default (monitor = 0) => Widget.Window({
  name: `pomodoro${monitor}`,
  monitor,
  layer: 'overlay',
  anchor: ['top', 'bottom', 'left', 'right'],
  keymode: monitor === 0 ? 'exclusive' : 'none',
  visible: breakPopupVisible.bind(),
  child: Widget.Overlay({
    child: Widget.Box({
      css: 'background-color: rgba(0, 0, 0, 0.5);',
    }),
    overlays: [
      Widget.Box({
        vpack: 'center',
        hpack: 'center',
        child: monitor === 0 ? PomodoroWidget() : Widget.Box(),
      }),
    ],
  }),
  setup: (self) => {
    if (monitor === 0) {
      self.keybind('Escape', () => {
        breakPopupVisible.value = false
      })

      // Auto-show on break start if break popup is enabled
      self.hook(Pomodoro, () => {
        if (breakPopupEnabled.value && Pomodoro.state === 'running') {
          // Close sidebar before showing break popup
          revealSideBar.value = false

          // Show break popup
          breakPopupVisible.value = true
        }
      }, 'break-started')

      // Auto-hide on break end
      self.hook(Pomodoro, () => {
        breakPopupVisible.value = false
      }, 'break-ended')
    }
  },
});

import Pomodoro from '../../services/Pomodoro.js';
import { breakPopupEnabled } from '../../shared/vars.js';

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
        className: 'audio_toggle',
        child: Widget.Label({
          label: Pomodoro.bind('audio_enabled').transform(enabled => enabled ? '󰕾' : '󰖁'),
        }),
        tooltipText: Pomodoro.bind('audio_enabled').transform(enabled => enabled ? 'Disable Audio' : 'Enable Audio'),
        onClicked: () => {
          Pomodoro.toggleAudio()
        },
      }),
      Widget.Button({
        className: 'close_button',
        child: Widget.Label(''),
        tooltipText: 'Close (break continues in background)',
        onClicked: () => {
          showBreakPopup.value = false
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

const showBreakPopup = Variable(false);

export default Widget.Window({
  name: 'pomodoro',
  layer: 'overlay',
  anchor: [],
  keymode: 'exclusive',
  visible: showBreakPopup.bind(),
  child: PomodoroWidget(),
  setup: (self) => {
    // Auto-show on break start if break popup is enabled
    self.hook(Pomodoro, () => {
      if (breakPopupEnabled.value && Pomodoro.state === 'running') {
        showBreakPopup.value = true
      }
    }, 'break-started')

    // Auto-hide on break end
    self.hook(Pomodoro, () => {
      showBreakPopup.value = false
    }, 'break-ended')
  },
});

import BrightnessService from '../../../services/Brightness.js'
import Theme from '../../../services/Theme.js'

export default function() {
  const Brightness = Widget.Box({
    className: 'brightness slider_container',
    vertical: true,
    spacing: 8,
    children: [
      Widget.Slider({
        className: 'slider',
        value: BrightnessService.bind('screen-value'),
        onChange: ({ value }) => BrightnessService.screenValue = value,
        drawValue: false,
        vexpand: true,
        vertical: true,
        inverted: true
      }),
      Widget.Label({
        className: 'icon',
        label: ''
      })
    ]
  })

  const ThemeButton = Widget.Button({
    className: 'theme_button',
    onClicked: () => Theme.nextTheme(),
    child: Widget.Box({
      vertical: true,
      spacing: 4,
      children: [
        Widget.Label({
          className: 'icon',
          label: '󰌁'
        }),
        Widget.Label({
          className: 'label',
          label: Theme.bind('current-theme').as(theme => {
            const names = { 'gruvbox': 'Gruvbox', 'cassette-futurism': 'Cassette' }
            return names[theme] || theme
          })
        })
      ]
    })
  })

  return Widget.Box({
    className: 'system_controls menu',
    spacing: 12,
    children: [
      Brightness,
      ThemeButton
    ]
  })
}

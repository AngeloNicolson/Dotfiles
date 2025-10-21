import Bar from './windows/bar/Bar.js'
import Notifications from './windows/notifications/Notifications.js'
import Pomodoro from './windows/pomodoro/Pomodoro.js'
import Theme from './services/Theme.js'

const monitors = JSON.parse(Utils.exec('hyprctl monitors -j')).length

// Compile SCSS to CSS with default theme
const scss = `${App.configDir}/themes/gruvbox-compiled.scss`
const css = `${App.configDir}/out.css`
Utils.exec(`sassc ${scss} ${css}`)

App.config({
  style: css,
  windows: [
    Bar,
    Notifications,
    ...Array.from({ length: monitors }, (_, i) => Pomodoro(i))
  ]
})

// Apply theme class to all windows on startup
Theme.connect('theme-changed', () => {
  // Theme service handles applying classes
})

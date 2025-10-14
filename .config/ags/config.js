import Bar from './windows/bar/Bar.js'
import Notifications from './windows/notifications/Notifications.js'
import Pomodoro from './windows/pomodoro/Pomodoro.js'

const monitors = JSON.parse(Utils.exec('hyprctl monitors -j')).length

App.config({
  style: App.configDir + '/out.css',
  windows: [
    Bar,
    Notifications,
    ...Array.from({ length: monitors }, (_, i) => Pomodoro(i))
  ]
})

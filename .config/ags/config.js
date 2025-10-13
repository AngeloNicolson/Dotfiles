import Bar from './windows/bar/Bar.js'
import Notifications from './windows/notifications/Notifications.js'
import Pomodoro from './windows/pomodoro/Pomodoro.js'

App.config({
  style: App.configDir + '/out.css',
  windows: [
    Bar,
    Notifications,
    Pomodoro
  ]
})

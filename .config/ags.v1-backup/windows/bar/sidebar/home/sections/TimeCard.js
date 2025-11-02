const currentTime = Variable('', {
  poll: [1000, () => {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }]
})

const currentDate = Variable('', {
  poll: [1000, () => {
    const now = new Date()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const dayName = days[now.getDay()]
    const monthName = months[now.getMonth()]
    const date = now.getDate()
    return `${dayName}, ${monthName} ${date}`
  }]
})

function TimeDisplay() {
  return Widget.Box({
    className: 'time_display',
    vertical: true,
    vpack: 'center',
    hpack: 'center',
    children: [
      Widget.Label({
        className: 'time',
        label: currentTime.bind(),
        justification: 'center',
        hexpand: true
      }),
      Widget.Label({
        className: 'date',
        label: currentDate.bind(),
        justification: 'center',
        hexpand: true
      })
    ]
  })
}

export default function() {
  return Widget.Box({
    className: 'time_card',
    vexpand: false,
    vpack: 'center',
    hpack: 'center',
    children: [
      TimeDisplay()
    ]
  })
}

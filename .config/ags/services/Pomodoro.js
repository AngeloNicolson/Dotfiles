class PomodoroService extends Service {
  static {
    Service.register(
      this,
      {
        'timer-changed': ['int', 'string'], // seconds remaining, mode
        'state-changed': ['string'], // running/paused/stopped
      },
      {
        'time-remaining': ['int', 'r'],
        'mode': ['string', 'r'],
        'state': ['string', 'r'],
      }
    )
  }

  // Pomodoro timings in seconds
  #WORK_TIME = 25 * 60
  #SHORT_BREAK = 5 * 60
  #LONG_BREAK = 15 * 60

  #timeRemaining = 25 * 60
  #mode = 'work' // 'work', 'short-break', 'long-break'
  #state = 'stopped' // 'running', 'paused', 'stopped'
  #interval = null
  #workSessionsCompleted = 0

  get time_remaining() {
    return this.#timeRemaining
  }

  get mode() {
    return this.#mode
  }

  get state() {
    return this.#state
  }

  constructor() {
    super()
  }

  start() {
    if (this.#state === 'stopped') {
      // Starting fresh
      this.#timeRemaining = this.#WORK_TIME
      this.#mode = 'work'
    }

    this.#state = 'running'
    this.emit('state-changed', this.#state)

    if (this.#interval) clearInterval(this.#interval)

    this.#interval = setInterval(() => {
      this.#timeRemaining--

      if (this.#timeRemaining <= 0) {
        this.#onTimerComplete()
      }

      this.emit('timer-changed', this.#timeRemaining, this.#mode)
      this.notify('time-remaining')
    }, 1000)
  }

  pause() {
    if (this.#state !== 'running') return

    this.#state = 'paused'
    this.emit('state-changed', this.#state)

    if (this.#interval) {
      clearInterval(this.#interval)
      this.#interval = null
    }
  }

  reset() {
    this.#state = 'stopped'
    this.#mode = 'work'
    this.#timeRemaining = this.#WORK_TIME
    this.#workSessionsCompleted = 0

    if (this.#interval) {
      clearInterval(this.#interval)
      this.#interval = null
    }

    this.emit('state-changed', this.#state)
    this.emit('timer-changed', this.#timeRemaining, this.#mode)
    this.notify('time-remaining')
  }

  toggle() {
    if (this.#state === 'running') {
      this.pause()
    } else {
      this.start()
    }
  }

  #onTimerComplete() {
    // Play notification sound or show notification
    Utils.execAsync(['notify-send', 'Pomodoro',
      this.#mode === 'work' ? 'Work session complete! Time for a break.' : 'Break complete! Back to work.'])

    if (this.#mode === 'work') {
      this.#workSessionsCompleted++

      // After 4 work sessions, take a long break
      if (this.#workSessionsCompleted % 4 === 0) {
        this.#mode = 'long-break'
        this.#timeRemaining = this.#LONG_BREAK
      } else {
        this.#mode = 'short-break'
        this.#timeRemaining = this.#SHORT_BREAK
      }
    } else {
      // Break is over, back to work
      this.#mode = 'work'
      this.#timeRemaining = this.#WORK_TIME
    }

    // Auto-start next session
    this.emit('timer-changed', this.#timeRemaining, this.#mode)
    this.notify('time-remaining')
  }

  formatTime() {
    const minutes = Math.floor(this.#timeRemaining / 60)
    const seconds = this.#timeRemaining % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  connect(event = 'timer-changed', callback) {
    return super.connect(event, callback)
  }
}

export default new PomodoroService

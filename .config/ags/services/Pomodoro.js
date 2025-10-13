class PomodoroService extends Service {
  static {
    Service.register(
      this,
      {
        'timer-changed': ['int', 'string'], // seconds remaining, mode
        'state-changed': ['string'], // running/paused/stopped
        'break-started': ['string'], // break type: short-break or long-break
        'break-ended': [], // break completed, back to work
        'study-block-changed': ['int', 'int'], // completed, total
      },
      {
        'time-remaining': ['int', 'r'],
        'mode': ['string', 'r'],
        'state': ['string', 'r'],
        'study-block-active': ['boolean', 'r'],
        'study-block-completed': ['int', 'r'],
        'study-block-total': ['int', 'r'],
      }
    )
  }

  // Pomodoro timings in seconds
  #WORK_TIME = 50 * 60
  #SHORT_BREAK = 10 * 60
  #LONG_BREAK = 10 * 60

  #timeRemaining = 50 * 60
  #mode = 'work' // 'work', 'short-break', 'long-break'
  #state = 'stopped' // 'running', 'paused', 'stopped'
  #interval = null
  #workSessionsCompleted = 0

  // Study block tracking
  #studyBlockActive = false
  #studyBlockTotal = 0 // Total pomodoros in the block
  #studyBlockCompleted = 0 // Pomodoros completed in current block

  // Time options in minutes
  static WORK_OPTIONS = [25, 30, 45, 50, 60, 90]
  static BREAK_OPTIONS = [5, 10, 15, 20, 30]

  get time_remaining() {
    return this.#timeRemaining
  }

  get mode() {
    return this.#mode
  }

  get state() {
    return this.#state
  }

  get study_block_active() {
    return this.#studyBlockActive
  }

  get study_block_completed() {
    return this.#studyBlockCompleted
  }

  get study_block_total() {
    return this.#studyBlockTotal
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
    this.notify('state')

    // Write state to cache file for sidebar script
    Utils.execAsync(['bash', '-c', `echo "running" > $HOME/.cache/pomodoro_state`])

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
    this.notify('state')

    // Write state to cache file for sidebar script
    Utils.execAsync(['bash', '-c', `echo "paused" > $HOME/.cache/pomodoro_state`])

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
    this.notify('state')
    this.emit('timer-changed', this.#timeRemaining, this.#mode)
    this.notify('time-remaining')

    // Write state to cache file for sidebar script
    Utils.execAsync(['bash', '-c', `echo "stopped" > $HOME/.cache/pomodoro_state`])
  }

  startStudyBlock(totalPomodoros) {
    this.#studyBlockActive = true
    this.#studyBlockTotal = totalPomodoros
    this.#studyBlockCompleted = 0
    this.emit('study-block-changed', this.#studyBlockCompleted, this.#studyBlockTotal)
    this.notify('study-block-active')
    this.notify('study-block-completed')
    this.notify('study-block-total')

    // Auto-start first work session
    this.start()
  }

  stopStudyBlock() {
    this.#studyBlockActive = false
    this.#studyBlockTotal = 0
    this.#studyBlockCompleted = 0
    this.emit('study-block-changed', this.#studyBlockCompleted, this.#studyBlockTotal)
    this.notify('study-block-active')
    this.notify('study-block-completed')
    this.notify('study-block-total')

    // Reset the timer
    this.reset()
  }

  toggle() {
    if (this.#state === 'running') {
      this.pause()
    } else {
      this.start()
    }
  }

  setWorkTime(minutes) {
    this.#WORK_TIME = minutes * 60
    if (this.#state === 'stopped') {
      this.#timeRemaining = this.#WORK_TIME
      this.emit('timer-changed', this.#timeRemaining, this.#mode)
      this.notify('time-remaining')
    }
  }

  setBreakTime(minutes) {
    this.#SHORT_BREAK = minutes * 60
    this.#LONG_BREAK = minutes * 60
    this.emit('timer-changed', this.#timeRemaining, this.#mode)
    this.notify('time-remaining')
  }

  getWorkTime() {
    return this.#WORK_TIME / 60
  }

  getBreakTime() {
    return this.#SHORT_BREAK / 60
  }

  #onTimerComplete() {
    const wasWorkMode = this.#mode === 'work'

    // Play notification sound or show notification
    Utils.execAsync(['notify-send', 'Pomodoro',
      wasWorkMode ? 'Work session complete! Time for a break.' : 'Break complete! Back to work.'])

    if (wasWorkMode) {
      this.#workSessionsCompleted++

      // After 4 work sessions, take a long break
      if (this.#workSessionsCompleted % 4 === 0) {
        this.#mode = 'long-break'
        this.#timeRemaining = this.#LONG_BREAK
      } else {
        this.#mode = 'short-break'
        this.#timeRemaining = this.#SHORT_BREAK
      }

      // Increment study block progress
      if (this.#studyBlockActive) {
        this.#studyBlockCompleted++
        this.emit('study-block-changed', this.#studyBlockCompleted, this.#studyBlockTotal)
        this.notify('study-block-completed')
      }

      // Emit break-started signal and auto-start break timer
      this.emit('break-started', this.#mode)
      this.emit('timer-changed', this.#timeRemaining, this.#mode)
      this.notify('time-remaining')
      this.notify('mode')

      // Auto-start break timer
      this.start()
    } else {
      // Break is over, back to work
      this.#mode = 'work'
      this.#timeRemaining = this.#WORK_TIME

      // Emit break-ended signal
      this.emit('break-ended')
      this.emit('timer-changed', this.#timeRemaining, this.#mode)
      this.notify('time-remaining')
      this.notify('mode')

      // Check if study block is complete
      if (this.#studyBlockActive && this.#studyBlockCompleted >= this.#studyBlockTotal) {
        // Study block complete! Stop everything
        this.stopStudyBlock()
        Utils.execAsync(['notify-send', 'Pomodoro', `Study block complete! You finished ${this.#studyBlockTotal} pomodoros.`])
      } else if (this.#studyBlockActive) {
        // Continue to next work session automatically
        this.start()
      } else {
        // No study block, pause timer
        this.#state = 'stopped'
        this.emit('state-changed', this.#state)
        this.notify('state')

        // Write state to cache file for sidebar script
        Utils.execAsync(['bash', '-c', `echo "stopped" > $HOME/.cache/pomodoro_state`])

        if (this.#interval) {
          clearInterval(this.#interval)
          this.#interval = null
        }
      }
    }
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

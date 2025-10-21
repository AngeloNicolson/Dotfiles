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
        'current-theme': ['string', 'r'],
        'available-themes': ['jsobject', 'r'],
        'audio-enabled': ['boolean', 'r'],
        'target-volume': ['int', 'r'],
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

  // Audio playback
  #mpvProcess = null
  #fadeInterval = null
  #FADE_DURATION = 7000 // 7 seconds for fade in/out
  #FADE_STEPS = 35
  #targetVolume = 50 // Max volume (50%)
  #currentVolume = 0
  #workPlaylist = []
  #breakPlaylist = []
  #currentTrackIndex = 0
  #isWorkMusic = true
  #currentTheme = 'default'
  #availableThemes = []
  #audioEnabled = true
  #pendingTheme = null

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

  get current_theme() {
    return this.#currentTheme
  }

  get available_themes() {
    return this.#availableThemes
  }

  get audio_enabled() {
    return this.#audioEnabled
  }

  constructor() {
    super()
    this.#initAudio()
  }

  #initAudio() {
    const configDir = App.configDir

    // Discover available themes
    try {
      const themesStr = Utils.exec(`bash -c "cd ${configDir}/assets/music-themes && ls -d */ 2>/dev/null | sed 's|/||g'"`)
      this.#availableThemes = themesStr.trim().split('\n').filter(f => f)
      console.log('Available themes:', this.#availableThemes)
    } catch (e) {
      console.log('No music themes found:', e)
      this.#availableThemes = []
    }

    // Load first available theme
    if (this.#availableThemes.length > 0) {
      this.#currentTheme = this.#availableThemes[0]
      console.log('Selected theme:', this.#currentTheme)
    }

    this.#loadThemePlaylists()
  }

  #loadThemePlaylists() {
    const configDir = App.configDir
    const themePath = `${configDir}/assets/music-themes/${this.#currentTheme}`

    // Load work playlist for current theme
    try {
      const workPlaylistStr = Utils.exec(`bash -c "ls ${themePath}/work/*.mp3 2>/dev/null"`)
      this.#workPlaylist = workPlaylistStr.trim().split('\n').filter(f => f)
      console.log('Work playlist:', this.#workPlaylist)
    } catch (e) {
      console.log(`No work music found for theme: ${this.#currentTheme}`, e)
      this.#workPlaylist = []
    }

    // Load break playlist for current theme
    try {
      const breakPlaylistStr = Utils.exec(`bash -c "ls ${themePath}/break/*.mp3 2>/dev/null"`)
      this.#breakPlaylist = breakPlaylistStr.trim().split('\n').filter(f => f)
      console.log('Break playlist:', this.#breakPlaylist)
    } catch (e) {
      console.log(`No break music found for theme: ${this.#currentTheme}`, e)
      this.#breakPlaylist = []
    }
  }

  #startPlayback() {
    const playlist = this.#isWorkMusic ? this.#workPlaylist : this.#breakPlaylist

    if (playlist.length === 0) {
      console.log('No playlist available for', this.#isWorkMusic ? 'work' : 'break')
      return
    }

    // Stop any existing playback
    if (this.#mpvProcess) {
      Utils.execAsync(['bash', '-c', `pkill -f "mpv.*pomodoro-music"`]).catch(() => {})
    }

    // Pick a random track from the playlist
    const randomTrack = playlist[Math.floor(Math.random() * playlist.length)]
    console.log(`Starting playback: ${randomTrack} at volume ${this.#currentVolume}`)

    // Start mpv with IPC socket for volume control, loop the single track
    const socketPath = '/tmp/ags-pomodoro-mpv-socket'
    Utils.execAsync(['bash', '-c', `mpv --input-ipc-server=${socketPath} --loop --volume=${this.#currentVolume} --no-video --really-quiet --title=pomodoro-music "${randomTrack}" 2>/dev/null &`])
      .catch(e => console.log('MPV playback failed:', e))

    this.#mpvProcess = true
  }

  #stopPlayback() {
    if (this.#mpvProcess) {
      Utils.execAsync(['bash', '-c', `pkill -f "mpv.*pomodoro-music"`]).catch(() => {})
      this.#mpvProcess = null
    }
  }

  #setVolume(volume) {
    this.#currentVolume = Math.max(0, Math.min(100, volume))
    if (this.#mpvProcess) {
      const socketPath = '/tmp/ags-pomodoro-mpv-socket'
      Utils.execAsync(['bash', '-c', `echo '{ "command": ["set_property", "volume", ${this.#currentVolume}] }' | socat - ${socketPath} 2>/dev/null`])
        .catch(() => {})
    }
  }

  #dimMusic() {
    if (!this.#audioEnabled) return

    // Clear any existing fade
    if (this.#fadeInterval) {
      clearInterval(this.#fadeInterval)
    }

    const startVolume = this.#currentVolume
    const targetVolume = this.#targetVolume * 0.4
    const FADE_DURATION = 7000 // 7 seconds
    const FADE_STEPS = 35
    const stepTime = FADE_DURATION / FADE_STEPS
    const volumeStep = (startVolume - targetVolume) / FADE_STEPS
    let currentStep = 0

    this.#fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.max(startVolume - volumeStep * currentStep, targetVolume)
      this.#setVolume(newVolume)

      if (currentStep >= FADE_STEPS) {
        clearInterval(this.#fadeInterval)
        this.#fadeInterval = null
      }
    }, stepTime)
  }

  #playAlert() {
    if (!this.#audioEnabled) return

    // Determine which notification to play based on current mode
    const themePath = `${App.configDir}/assets/music-themes/${this.#currentTheme}/notifications`
    const notificationFile = this.#mode === 'work' ? 'session_end.mp3' : 'break_end.mp3'
    const notificationPath = `${themePath}/${notificationFile}`

    // Use target volume for notification
    const notificationVolume = this.#targetVolume

    try {
      Utils.exec(`test -f ${notificationPath}`)
      Utils.execAsync(['mpv', `--volume=${notificationVolume}`, '--no-video', notificationPath])
        .catch(e => console.log('Notification play failed:', e))
    } catch (e) {
      console.log(`No notification found at: ${notificationPath}`)
    }
  }

  #playStudyBlockStarted(onComplete) {
    if (!this.#audioEnabled) {
      if (onComplete) onComplete()
      return
    }

    const themePath = `${App.configDir}/assets/music-themes/${this.#currentTheme}/notifications`
    const notificationPath = `${themePath}/study_block_started.mp3`

    // Use target volume for notification
    const notificationVolume = this.#targetVolume

    try {
      Utils.exec(`test -f ${notificationPath}`)
      // Wait for notification to complete before calling onComplete
      Utils.execAsync(['bash', '-c', `mpv --volume=${notificationVolume} --no-video "${notificationPath}"`])
        .then(() => {
          if (onComplete) onComplete()
        })
        .catch(e => {
          console.log('Study block notification play failed:', e)
          if (onComplete) onComplete()
        })
    } catch (e) {
      console.log(`No study block notification found at: ${notificationPath}`)
      if (onComplete) onComplete()
    }
  }

  #playSessionStarted() {
    if (!this.#audioEnabled) return

    const themePath = `${App.configDir}/assets/music-themes/${this.#currentTheme}/notifications`
    const notificationPath = `${themePath}/session_started.mp3`

    // Use target volume for notification
    const notificationVolume = this.#targetVolume

    try {
      Utils.exec(`test -f ${notificationPath}`)
      Utils.execAsync(['mpv', `--volume=${notificationVolume}`, '--no-video', notificationPath])
        .catch(e => console.log('Session notification play failed:', e))
    } catch (e) {
      console.log(`No session notification found at: ${notificationPath}`)
    }
  }

  #fadeIn(isWorkMode = true) {
    if (!this.#audioEnabled) {
      console.log('Audio disabled, skipping fade in')
      return
    }

    const playlist = isWorkMode ? this.#workPlaylist : this.#breakPlaylist
    if (playlist.length === 0) {
      console.log('No playlist for fade in')
      return
    }

    this.#isWorkMusic = isWorkMode
    console.log(`Fading in ${isWorkMode ? 'work' : 'break'} music`)

    // Clear any existing fade
    if (this.#fadeInterval) {
      clearInterval(this.#fadeInterval)
    }

    const stepTime = this.#FADE_DURATION / this.#FADE_STEPS
    const volumeStep = this.#targetVolume / this.#FADE_STEPS
    let currentStep = 0

    this.#currentVolume = 0
    this.#startPlayback()

    this.#fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.min(volumeStep * currentStep, this.#targetVolume)
      this.#setVolume(newVolume)

      if (currentStep >= this.#FADE_STEPS) {
        clearInterval(this.#fadeInterval)
        this.#fadeInterval = null
      }
    }, stepTime)
  }

  #fadeOut(onComplete) {
    // Clear any existing fade
    if (this.#fadeInterval) {
      clearInterval(this.#fadeInterval)
    }

    if (!this.#mpvProcess) {
      if (onComplete) onComplete()
      return
    }

    const stepTime = this.#FADE_DURATION / this.#FADE_STEPS
    const volumeStep = this.#currentVolume / this.#FADE_STEPS
    let currentStep = 0

    this.#fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.max(this.#currentVolume - volumeStep, 0)
      this.#setVolume(newVolume)

      if (currentStep >= this.#FADE_STEPS) {
        clearInterval(this.#fadeInterval)
        this.#fadeInterval = null
        this.#stopPlayback()
        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  #fadeOutFast(pauseOnly = false, onComplete) {
    // Clear any existing fade
    if (this.#fadeInterval) {
      clearInterval(this.#fadeInterval)
    }

    if (!this.#mpvProcess) {
      if (onComplete) onComplete()
      return
    }

    const FAST_FADE_DURATION = 1000 // 1 second
    const FAST_FADE_STEPS = 10
    const stepTime = FAST_FADE_DURATION / FAST_FADE_STEPS
    const volumeStep = this.#currentVolume / FAST_FADE_STEPS
    let currentStep = 0

    this.#fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.max(this.#currentVolume - volumeStep, 0)
      this.#setVolume(newVolume)

      if (currentStep >= FAST_FADE_STEPS) {
        clearInterval(this.#fadeInterval)
        this.#fadeInterval = null
        if (pauseOnly) {
          this.#pausePlayback()
        } else {
          this.#stopPlayback()
        }
        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  #pausePlayback() {
    if (this.#mpvProcess) {
      const socketPath = '/tmp/ags-pomodoro-mpv-socket'
      Utils.execAsync(['bash', '-c', `echo '{ "command": ["set_property", "pause", true] }' | socat - ${socketPath} 2>/dev/null`])
        .catch(() => {})
    }
  }

  #resumePlayback() {
    if (this.#mpvProcess) {
      const socketPath = '/tmp/ags-pomodoro-mpv-socket'
      Utils.execAsync(['bash', '-c', `echo '{ "command": ["set_property", "pause", false] }' | socat - ${socketPath} 2>/dev/null`])
        .catch(() => {})
    }
  }

  #resumeAndFadeIn() {
    if (!this.#audioEnabled) {
      console.log('Audio disabled, skipping resume')
      return
    }

    if (!this.#mpvProcess) {
      console.log('No music to resume')
      return
    }

    // Clear any existing fade
    if (this.#fadeInterval) {
      clearInterval(this.#fadeInterval)
    }

    const FAST_FADE_DURATION = 1000 // 1 second
    const FAST_FADE_STEPS = 10
    const stepTime = FAST_FADE_DURATION / FAST_FADE_STEPS
    const volumeStep = this.#targetVolume / FAST_FADE_STEPS
    let currentStep = 0

    this.#currentVolume = 0
    this.#resumePlayback()

    this.#fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.min(volumeStep * currentStep, this.#targetVolume)
      this.#setVolume(newVolume)

      if (currentStep >= FAST_FADE_STEPS) {
        clearInterval(this.#fadeInterval)
        this.#fadeInterval = null
      }
    }, stepTime)
  }

  start() {
    const wasResuming = this.#state === 'paused'
    const wasStartingFresh = this.#state === 'stopped'

    if (this.#state === 'stopped') {
      // Starting fresh
      this.#timeRemaining = this.#WORK_TIME
      this.#mode = 'work'

      // Apply pending theme change if starting fresh
      if (this.#pendingTheme) {
        console.log(`Applying pending theme change on start: ${this.#pendingTheme}`)
        this.#currentTheme = this.#pendingTheme
        this.#pendingTheme = null
        this.#loadThemePlaylists()
        this.notify('current-theme')
        this.notify('available-themes')
      }
    }

    this.#state = 'running'
    this.emit('state-changed', this.#state)
    this.notify('state')

    // Write state to cache file for sidebar script
    Utils.execAsync(['bash', '-c', `echo "running" > $HOME/.cache/pomodoro_state`])

    if (wasResuming) {
      // Resume paused music and fade back in quickly
      this.#resumeAndFadeIn()
    } else {
      // Fade in new music when timer starts
      this.#fadeIn(this.#mode === 'work')

      // Play session started notification for single sessions (not study blocks)
      if (wasStartingFresh && !this.#studyBlockActive) {
        this.#playSessionStarted()
      }
    }

    if (this.#interval) clearInterval(this.#interval)

    this.#interval = setInterval(() => {
      this.#timeRemaining--

      // Different timing for work vs break
      if (this.#mode === 'work') {
        // Work: dim music at 5 seconds, play alert at 1 second
        if (this.#timeRemaining === 5) {
          this.#dimMusic()
        }
        if (this.#timeRemaining === 1) {
          this.#playAlert()
        }
      } else {
        // Break: dim music at 5 seconds, play alert at 1 second
        if (this.#timeRemaining === 5) {
          this.#dimMusic()
        }
        if (this.#timeRemaining === 1) {
          this.#playAlert()
        }
      }

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

    // Fade out music quickly and pause (don't stop)
    this.#fadeOutFast(true)

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

    // Fade out music quickly when stopped
    this.#fadeOutFast(false)

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

    // Start timer immediately
    this.start()

    // Play study block started notification
    this.#playStudyBlockStarted()
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

  setTheme(themeName) {
    if (!this.#availableThemes.includes(themeName)) {
      console.log(`Theme not found: ${themeName}`)
      return false
    }

    // If timer is running, defer the theme change until next session
    if (this.#state === 'running') {
      this.#pendingTheme = themeName
      this.#currentTheme = themeName  // Update UI immediately
      this.notify('current-theme')
      console.log(`Theme change deferred to next session: ${themeName}`)
      Utils.execAsync(['notify-send', 'Pomodoro', `Theme will change to "${themeName}" at next session`])
      return true
    }

    // If stopped or paused, switch immediately
    const wasPlaying = this.#state === 'paused'
    const currentMode = this.#mode

    // Stop current playback if paused
    if (wasPlaying && this.#audioEnabled) {
      this.#fadeOut()
    }

    // Load new theme
    this.#currentTheme = themeName
    this.#pendingTheme = null
    this.#loadThemePlaylists()
    this.notify('current-theme')
    this.notify('available-themes')

    // Resume playback if was paused
    if (wasPlaying && this.#audioEnabled) {
      setTimeout(() => {
        this.#fadeIn(currentMode === 'work')
      }, this.#FADE_DURATION)
    }

    return true
  }

  toggleAudio() {
    this.#audioEnabled = !this.#audioEnabled
    this.notify('audio-enabled')

    // Stop playback if disabling audio
    if (!this.#audioEnabled && this.#mpvProcess) {
      this.#stopPlayback()
    }
    // Start playback if enabling audio and timer is running
    else if (this.#audioEnabled && this.#state === 'running') {
      this.#fadeIn(this.#mode === 'work')
    }

    return this.#audioEnabled
  }

  setTargetVolume(volume) {
    this.#targetVolume = Math.max(0, Math.min(100, volume))
    this.notify('target-volume')

    // Update current volume if music is playing
    if (this.#mpvProcess && this.#state === 'running') {
      this.#currentVolume = this.#targetVolume
      this.#setVolume(this.#targetVolume)
    }
  }

  getTargetVolume() {
    return this.#targetVolume
  }

  #onTimerComplete() {
    const wasWorkMode = this.#mode === 'work'

    // Stop music (alert already played at 5 seconds)
    this.#stopPlayback()

    // Apply pending theme change if there is one
    if (this.#pendingTheme) {
      console.log(`Applying pending theme change: ${this.#pendingTheme}`)
      this.#currentTheme = this.#pendingTheme
      this.#pendingTheme = null
      this.#loadThemePlaylists()
      this.notify('current-theme')
      this.notify('available-themes')
    }

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

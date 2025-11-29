import { execAsync, exec } from "ags/process"

const SOCKET_PATH = "/tmp/ags-pomodoro-mpv-socket"
const FADE_DURATION = 7000 // 7 seconds
const FADE_STEPS = 35
const FAST_FADE_DURATION = 1000 // 1 second
const FAST_FADE_STEPS = 10

class MusicPlayer {
  private mpvProcess: boolean = false
  private fadeInterval: any = null
  private currentVolume: number = 0
  private targetVolume: number = 50
  private workPlaylist: string[] = []
  private breakPlaylist: string[] = []
  private currentTheme: string = "default"
  private availableThemes: string[] = []
  private isWorkMusic: boolean = true

  constructor() {
    this.initAudio()
  }

  private async initAudio() {
    const configDir = "/home/Angel/dotfiles/.config/ags"

    // Discover available themes
    try {
      const themesStr = await execAsync([
        "bash",
        "-c",
        `cd ${configDir}/assets/music-themes && ls -d */ 2>/dev/null | sed 's|/||g'`,
      ])
      this.availableThemes = themesStr
        .trim()
        .split("\n")
        .filter((f) => f)
      console.log("Available themes:", this.availableThemes)
    } catch (e) {
      console.log("No music themes found:", e)
      this.availableThemes = []
    }

    // Load first available theme
    if (this.availableThemes.length > 0) {
      this.currentTheme = this.availableThemes[0]
      console.log("Selected theme:", this.currentTheme)
    }

    await this.loadThemePlaylists()
  }

  private async loadThemePlaylists() {
    const configDir = "/home/Angel/dotfiles/.config/ags"
    const themePath = `${configDir}/assets/music-themes/${this.currentTheme}`

    // Load work playlist
    try {
      const workPlaylistStr = await execAsync([
        "bash",
        "-c",
        `ls ${themePath}/work/*.mp3 2>/dev/null`,
      ])
      this.workPlaylist = workPlaylistStr
        .trim()
        .split("\n")
        .filter((f) => f)
      console.log("Work playlist:", this.workPlaylist)
    } catch (e) {
      console.log(`No work music found for theme: ${this.currentTheme}`, e)
      this.workPlaylist = []
    }

    // Load break playlist
    try {
      const breakPlaylistStr = await execAsync([
        "bash",
        "-c",
        `ls ${themePath}/break/*.mp3 2>/dev/null`,
      ])
      this.breakPlaylist = breakPlaylistStr
        .trim()
        .split("\n")
        .filter((f) => f)
      console.log("Break playlist:", this.breakPlaylist)
    } catch (e) {
      console.log(`No break music found for theme: ${this.currentTheme}`, e)
      this.breakPlaylist = []
    }
  }

  private startPlayback() {
    const playlist = this.isWorkMusic ? this.workPlaylist : this.breakPlaylist

    if (playlist.length === 0) {
      console.log("No playlist available for", this.isWorkMusic ? "work" : "break")
      return
    }

    // Stop any existing playback
    if (this.mpvProcess) {
      execAsync(["bash", "-c", `pkill -f "mpv.*pomodoro-music"`]).catch(() => {})
    }

    // Pick a random track
    const randomTrack = playlist[Math.floor(Math.random() * playlist.length)]
    console.log(`Starting playback: ${randomTrack} at volume ${this.currentVolume}`)

    // Start mpv with IPC socket
    execAsync([
      "bash",
      "-c",
      `mpv --input-ipc-server=${SOCKET_PATH} --loop --volume=${this.currentVolume} --no-video --really-quiet --title=pomodoro-music "${randomTrack}" 2>/dev/null &`,
    ]).catch((e) => console.log("MPV playback failed:", e))

    this.mpvProcess = true
  }

  private stopPlayback() {
    if (this.mpvProcess) {
      execAsync(["bash", "-c", `pkill -f "mpv.*pomodoro-music"`]).catch(() => {})
      this.mpvProcess = null
    }
  }

  private setVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(100, volume))
    if (this.mpvProcess) {
      execAsync([
        "bash",
        "-c",
        `echo '{ "command": ["set_property", "volume", ${this.currentVolume}] }' | socat - ${SOCKET_PATH} 2>/dev/null`,
      ]).catch(() => {})
    }
  }

  public fadeIn(isWorkMode: boolean = true) {
    const playlist = isWorkMode ? this.workPlaylist : this.breakPlaylist
    if (playlist.length === 0) {
      console.log("No playlist for fade in")
      return
    }

    this.isWorkMusic = isWorkMode
    console.log(`Fading in ${isWorkMode ? "work" : "break"} music`)

    // Clear any existing fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
    }

    const stepTime = FADE_DURATION / FADE_STEPS
    const volumeStep = this.targetVolume / FADE_STEPS
    let currentStep = 0

    this.currentVolume = 0
    this.startPlayback()

    this.fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.min(volumeStep * currentStep, this.targetVolume)
      this.setVolume(newVolume)

      if (currentStep >= FADE_STEPS) {
        clearInterval(this.fadeInterval)
        this.fadeInterval = null
      }
    }, stepTime)
  }

  public fadeOut(onComplete?: () => void) {
    // Clear any existing fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
    }

    if (!this.mpvProcess) {
      if (onComplete) onComplete()
      return
    }

    const stepTime = FADE_DURATION / FADE_STEPS
    const volumeStep = this.currentVolume / FADE_STEPS
    let currentStep = 0

    this.fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.max(this.currentVolume - volumeStep, 0)
      this.setVolume(newVolume)

      if (currentStep >= FADE_STEPS) {
        clearInterval(this.fadeInterval)
        this.fadeInterval = null
        this.stopPlayback()
        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  public fadeOutFast(onComplete?: () => void) {
    // Clear any existing fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
    }

    if (!this.mpvProcess) {
      if (onComplete) onComplete()
      return
    }

    const stepTime = FAST_FADE_DURATION / FAST_FADE_STEPS
    const volumeStep = this.currentVolume / FAST_FADE_STEPS
    let currentStep = 0

    this.fadeInterval = setInterval(() => {
      currentStep++
      const newVolume = Math.max(this.currentVolume - volumeStep, 0)
      this.setVolume(newVolume)

      if (currentStep >= FAST_FADE_STEPS) {
        clearInterval(this.fadeInterval)
        this.fadeInterval = null
        this.stopPlayback()
        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  public playNotification(type: "session_started" | "session_end" | "break_end" | "study_block_started") {
    const configDir = "/home/Angel/dotfiles/.config/ags"
    const themePath = `${configDir}/assets/music-themes/${this.currentTheme}/notifications`
    const notificationPath = `${themePath}/${type}.mp3`

    try {
      exec(`test -f ${notificationPath}`)
      execAsync(["mpv", `--volume=${this.targetVolume}`, "--no-video", notificationPath]).catch((e) =>
        console.log("Notification play failed:", e)
      )
    } catch (e) {
      console.log(`No notification found at: ${notificationPath}`)
    }
  }

  public setTargetVolume(volume: number) {
    this.targetVolume = Math.max(0, Math.min(100, volume))
    // If music is playing, adjust current volume proportionally
    if (this.mpvProcess && this.currentVolume > 0) {
      this.setVolume(this.targetVolume)
    }
  }

  public stop() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
      this.fadeInterval = null
    }
    this.stopPlayback()
  }

  public getAvailableThemes(): string[] {
    return this.availableThemes
  }

  public async setTheme(theme: string) {
    if (this.availableThemes.includes(theme)) {
      this.currentTheme = theme
      await this.loadThemePlaylists()
    }
  }
}

// Export singleton instance
export const musicPlayer = new MusicPlayer()

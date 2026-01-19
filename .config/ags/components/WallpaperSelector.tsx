import Gtk from "gi://Gtk?version=3.0"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import { execAsync } from "ags/process"
import { createState } from "ags"

const WALLPAPER_DIR = "/home/Angel/projects/personal/dotfiles/.config/ags/wallpapers"
const SWWW_DIR = GLib.get_home_dir() + "/.config/swww"
const VIDEO_DIR = "/home/Angel/Videos"
const THUMB_CACHE_DIR = GLib.get_home_dir() + "/.cache/ags/video-thumbs"
const CURRENT_LIVE_FILE = "/tmp/mpvpaper-current"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mkv", ".avi", ".mov"]

function ensureThumbCache() {
  try {
    GLib.mkdir_with_parents(THUMB_CACHE_DIR, 0o755)
  } catch {
    // Directory might already exist
  }
}

function getStaticWallpapers(): string[] {
  const wallpapers: string[] = []
  const dirs = [WALLPAPER_DIR, SWWW_DIR]

  for (const dir of dirs) {
    try {
      const gdir = GLib.Dir.open(dir, 0)
      let name: string | null
      while ((name = gdir.read_name()) !== null) {
        const lower = name.toLowerCase()
        if (IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))) {
          wallpapers.push(`${dir}/${name}`)
        }
      }
      gdir.close()
      if (wallpapers.length > 0) break
    } catch {
      // Directory doesn't exist
    }
  }

  return wallpapers.sort()
}

function getLiveWallpapers(): string[] {
  const videos: string[] = []
  const dirs = [VIDEO_DIR, WALLPAPER_DIR]

  for (const dir of dirs) {
    try {
      const gdir = GLib.Dir.open(dir, 0)
      let name: string | null
      while ((name = gdir.read_name()) !== null) {
        const lower = name.toLowerCase()
        if (VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext))) {
          videos.push(`${dir}/${name}`)
        }
      }
      gdir.close()
    } catch {
      // Directory doesn't exist
    }
  }

  return videos.sort()
}

function getVideoThumbnailPath(videoPath: string): string {
  const basename = GLib.path_get_basename(videoPath)
  const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, videoPath, -1)
  return `${THUMB_CACHE_DIR}/${hash}.jpg`
}

async function generateVideoThumbnail(videoPath: string): Promise<string> {
  const thumbPath = getVideoThumbnailPath(videoPath)

  // Check if thumbnail already exists
  if (GLib.file_test(thumbPath, GLib.FileTest.EXISTS)) {
    return thumbPath
  }

  ensureThumbCache()

  // Generate thumbnail at 10 second mark
  try {
    await execAsync([
      "ffmpeg", "-y", "-i", videoPath,
      "-ss", "00:00:10",
      "-vframes", "1",
      "-vf", "scale=280:-1",
      thumbPath
    ])
  } catch {
    // Try at 1 second if 10 seconds fails (short video)
    try {
      await execAsync([
        "ffmpeg", "-y", "-i", videoPath,
        "-ss", "00:00:01",
        "-vframes", "1",
        "-vf", "scale=280:-1",
        thumbPath
      ])
    } catch {
      // Fallback: first frame
      await execAsync([
        "ffmpeg", "-y", "-i", videoPath,
        "-vframes", "1",
        "-vf", "scale=280:-1",
        thumbPath
      ])
    }
  }

  return thumbPath
}

function StaticThumbnail({
  path,
  onSelect
}: {
  path: string
  onSelect: () => void
}) {
  let pixbuf: GdkPixbuf.Pixbuf | null = null
  try {
    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 280, 175, true)
  } catch {
    // Failed to load image
  }

  const image = new Gtk.Image()
  if (pixbuf) {
    image.set_from_pixbuf(pixbuf)
  } else {
    image.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG)
  }

  return (
    <button name="wallpaper-thumb" onClicked={onSelect}>
      {image}
    </button>
  )
}

function VideoThumbnail({
  path,
  onSelect
}: {
  path: string
  onSelect: () => void
}) {
  const image = new Gtk.Image()
  image.set_from_icon_name("video-x-generic", Gtk.IconSize.DIALOG)

  // Load thumbnail asynchronously
  generateVideoThumbnail(path).then((thumbPath) => {
    try {
      const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(thumbPath, 280, 175, true)
      image.set_from_pixbuf(pixbuf)
    } catch {
      // Keep fallback icon
    }
  }).catch(() => {
    // Keep fallback icon
  })

  const basename = GLib.path_get_basename(path)
  const name = basename.substring(0, basename.lastIndexOf('.')) || basename

  const badge = (
    <box name="video-badge" halign={Gtk.Align.END} valign={Gtk.Align.START}>
      <label label="▶" />
    </box>
  ) as Gtk.Widget

  const overlay = new Gtk.Overlay()
  overlay.add(image)
  overlay.add_overlay(badge)
  overlay.show_all()

  return (
    <button name="wallpaper-thumb" onClicked={onSelect}>
      <box vertical>
        {overlay}
        <label name="video-name" label={name.length > 25 ? name.substring(0, 22) + "..." : name} />
      </box>
    </button>
  )
}

export default function WallpaperSelector() {
  const [activeTab, setActiveTab] = createState<"static" | "live">("static")
  const staticWallpapers = getStaticWallpapers()
  const liveWallpapers = getLiveWallpapers()

  const applyStaticWallpaper = async (path: string) => {
    // Force kill any running mpvpaper
    await execAsync(["pkill", "-9", "mpvpaper"]).catch(() => {})
    await execAsync(["pkill", "-9", "mpv"]).catch(() => {})
    // Wait for processes to die
    await new Promise(resolve => setTimeout(resolve, 200))

    // Ensure swww-daemon is running
    try {
      await execAsync(["pgrep", "swww-daemon"])
    } catch {
      // swww-daemon not running, start it
      await execAsync(["swww-daemon"]).catch(() => {})
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    execAsync([
      "swww", "img", path,
      "--transition-type", "wipe",
      "--transition-angle", "30",
      "--transition-duration", "1.5",
      "--transition-fps", "60"
    ]).then(() => {
      execAsync(["rm", "-f", `${SWWW_DIR}/current.set`]).catch(() => {})
      execAsync(["rm", "-f", `${SWWW_DIR}/current-live.set`]).catch(() => {})
      execAsync(["ln", "-sf", path, `${SWWW_DIR}/current.set`]).catch(() => {})
      execAsync([
        "dunstify", "Wallpaper changed",
        "-a", "Wallpaper", "-i", path, "-r", "91190", "-t", "2000"
      ]).catch(() => {})
    }).catch(() => {})
  }

  const applyLiveWallpaper = async (path: string) => {
    // Force kill any existing mpvpaper/mpv
    await execAsync(["pkill", "-9", "mpvpaper"]).catch(() => {})
    await execAsync(["pkill", "-9", "mpv"]).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get monitor name
    let monitor = "eDP-1"
    try {
      const result = await execAsync(["hyprctl", "monitors", "-j"])
      const monitors = JSON.parse(result)
      if (monitors.length > 0) {
        monitor = monitors[0].name
      }
    } catch {
      // Use default
    }

    // Check if swww is running
    let swwwRunning = false
    try {
      await execAsync(["pgrep", "swww-daemon"])
      swwwRunning = true
    } catch {
      swwwRunning = false
    }

    // Set Hyprland background to black (fallback when swww dies)
    await execAsync(["hyprctl", "keyword", "misc:background_color", "0x000000"]).catch(() => {})
    await execAsync(["hyprctl", "keyword", "misc:disable_hyprland_logo", "true"]).catch(() => {})
    await execAsync(["hyprctl", "keyword", "misc:disable_splash_rendering", "true"]).catch(() => {})
    await execAsync(["hyprctl", "keyword", "misc:force_default_wallpaper", "-1"]).catch(() => {})

    if (swwwRunning) {
      // Fade swww to black
      await execAsync([
        "swww", "clear", "000000",
        "--transition-type", "fade",
        "--transition-duration", "0.4",
        "--transition-fps", "60"
      ]).catch(() => {})

      // Wait for fade to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Kill swww
      await execAsync(["pkill", "-9", "swww-daemon"]).catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Check if this is a different wallpaper than currently playing
    let currentPath = ""
    try {
      const contents = GLib.file_get_contents(CURRENT_LIVE_FILE)
      if (contents[0]) {
        currentPath = new TextDecoder().decode(contents[1]).trim()
      }
    } catch {
      // File doesn't exist, first time
    }

    const isNewWallpaper = currentPath !== path

    // Save current path
    GLib.file_set_contents(CURRENT_LIVE_FILE, path)

    if (isNewWallpaper) {
      // New wallpaper selection - use fade-in
      const ipcSocket = "/tmp/mpvpaper-ipc"
      execAsync(["rm", "-f", ipcSocket]).catch(() => {})
      execAsync([
        "mpvpaper", "-f", "-o", `no-audio loop panscan=1.0 vf=fade=t=in:st=0:d=0.8 input-ipc-server=${ipcSocket}`,
        monitor, path
      ]).catch(() => {})

      // Remove fade filter after it completes
      setTimeout(() => {
        execAsync(["bash", "-c", `echo '{ "command": ["set_property", "vf", ""] }' | socat - ${ipcSocket}`]).catch(() => {})
      }, 1000)
    } else {
      // Same wallpaper (service restart) - no fade
      execAsync([
        "mpvpaper", "-f", "-o", "no-audio loop panscan=1.0",
        monitor, path
      ]).catch(() => {})
    }

    // Save current live wallpaper
    execAsync(["rm", "-f", `${SWWW_DIR}/current-live.set`]).catch(() => {})
    execAsync(["ln", "-sf", path, `${SWWW_DIR}/current-live.set`]).catch(() => {})

    // Get thumbnail for notification
    const thumbPath = getVideoThumbnailPath(path)
    const notifyIcon = GLib.file_test(thumbPath, GLib.FileTest.EXISTS) ? thumbPath : "video-x-generic"

    execAsync([
      "dunstify", "Live wallpaper set",
      "-a", "Wallpaper", "-i", notifyIcon, "-r", "91190", "-t", "2000"
    ]).catch(() => {})
  }

  // Create static wallpaper list
  const staticList = (
    <box vertical name="wallpaper-list">
      {staticWallpapers.length === 0 ? (
        <box name="wallpaper-empty" vertical>
          <label name="status-icon" label="" />
          <label name="status-label" label="No static wallpapers found" />
        </box>
      ) : (
        staticWallpapers.map((wp) => (
          <StaticThumbnail path={wp} onSelect={() => applyStaticWallpaper(wp)} />
        ))
      )}
    </box>
  ) as Gtk.Widget

  // Create live wallpaper list
  const liveList = (
    <box vertical name="wallpaper-list">
      {liveWallpapers.length === 0 ? (
        <box name="wallpaper-empty" vertical>
          <label name="status-icon" label="" />
          <label name="status-label" label="No video wallpapers found" />
          <label name="status-sublabel" label={`Add videos to ${VIDEO_DIR}`} />
        </box>
      ) : (
        liveWallpapers.map((wp) => (
          <VideoThumbnail path={wp} onSelect={() => applyLiveWallpaper(wp)} />
        ))
      )}
    </box>
  ) as Gtk.Widget

  const staticScrolled = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.EXTERNAL,
    vexpand: true,
  })
  staticScrolled.add(staticList)
  staticScrolled.show_all()

  const liveScrolled = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.EXTERNAL,
    vexpand: true,
  })
  liveScrolled.add(liveList)
  liveScrolled.show_all()

  // Create stack for tab content
  const stack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
    transition_duration: 200,
  })
  stack.add_named(staticScrolled, "static")
  stack.add_named(liveScrolled, "live")
  stack.show_all()

  const switchToStatic = () => {
    print("Switching to static")
    setActiveTab("static")
    stack.set_visible_child_name("static")
  }

  const switchToLive = () => {
    print("Switching to live")
    setActiveTab("live")
    stack.set_visible_child_name("live")
  }

  return (
    <box vertical name="home-page">
      <label name="section-header" label="//WALLPAPERS" />
      <box name="wallpaper-tab-bar">
        <button
          name="wallpaper-tab-btn"
          class={activeTab.as((tab) => tab === "static" ? "active" : "")}
          onClicked={switchToStatic}
          hexpand
        >
          <box vertical halign={Gtk.Align.CENTER}>
            <label name="tab-icon" label="" />
            <label name="tab-label" label="STATIC" />
          </box>
        </button>
        <button
          name="wallpaper-tab-btn"
          class={activeTab.as((tab) => tab === "live" ? "active" : "")}
          onClicked={switchToLive}
          hexpand
        >
          <box vertical halign={Gtk.Align.CENTER}>
            <label name="tab-icon" label="" />
            <label name="tab-label" label="LIVE" />
          </box>
        </button>
      </box>
      {stack}
    </box>
  )
}

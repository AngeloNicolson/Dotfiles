import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"
import GdkPixbuf from "gi://GdkPixbuf"
import GLib from "gi://GLib"
import cairo from "cairo"
import { s } from "../scale"
import { setDestinationVisible } from "../state"

// Background image path
const BG_IMAGE_PATH = `${GLib.get_user_config_dir()}/ags/assets/director/nebula2.jpg`

// Sub-menu items for each destination
interface SubItem {
  id: string
  label: string
  icon: string
  command: string
}

interface Destination {
  id: string
  label: string
  icon: string
  x: number
  y: number
  size: number
  command?: string
  ringStyle: "planet" | "icon" | "central"
  subItems?: SubItem[]
}

const DESTINATIONS: Destination[] = [
  // === LARGE PLANETS (corners) ===
  // VENUS position - Top left large planet
  {
    id: "apps", label: "APPS", icon: "", x: 0.14, y: 0.14, size: 4.8, ringStyle: "planet",
    subItems: [
      { id: "wofi", label: "LAUNCHER", icon: "", command: "wofi --show drun" },
      { id: "discord", label: "DISCORD", icon: "󰙯", command: "vesktop" },
      { id: "obs", label: "OBS", icon: "󰑋", command: "obs" },
      { id: "gimp", label: "GIMP", icon: "", command: "gimp" },
      { id: "blender", label: "BLENDER", icon: "󰂫", command: "blender" },
    ]
  },
  // MARS position - Top right large planet
  {
    id: "code", label: "CODE", icon: "", x: 0.80, y: 0.20, size: 3.0, ringStyle: "planet",
    subItems: [
      { id: "vscode", label: "VS CODE", icon: "", command: "code" },
      { id: "nvim", label: "NEOVIM", icon: "", command: "foot -e nvim" },
      { id: "github", label: "GITHUB", icon: "", command: "firefox https://github.com" },
    ]
  },
  // MOON position - Bottom left large planet
  {
    id: "files", label: "FILES", icon: "", x: 0.18, y: 0.78, size: 2.0, ringStyle: "planet",
    subItems: [
      { id: "nemo", label: "NEMO", icon: "", command: "nemo" },
      { id: "home-dir", label: "HOME", icon: "", command: "nemo ~" },
      { id: "downloads", label: "DOWNLOADS", icon: "", command: "nemo ~/Downloads" },
      { id: "projects", label: "PROJECTS", icon: "", command: "nemo ~/projects" },
    ]
  },
  // EARTH position - Bottom center large planet (half cut off)
  {
    id: "terminal", label: "TERMINAL", icon: "", x: 0.50, y: 1.0, size: 5.0, ringStyle: "planet",
    command: "foot"
  },

  // === CENTER - TOWER ===
  { id: "home", label: "TOWER", icon: "", x: 0.50, y: 0.58, size: 1.6, ringStyle: "central", command: "ags request toggle-bar" },

  // === MEDIUM DESTINATIONS ===
  // REEF position - Top center
  {
    id: "browser", label: "BROWSER", icon: "", x: 0.52, y: 0.08, size: 1.2, ringStyle: "planet",
    subItems: [
      { id: "firefox", label: "FIREFOX", icon: "", command: "firefox" },
      { id: "chromium", label: "CHROMIUM", icon: "", command: "chromium" },
      { id: "private", label: "PRIVATE", icon: "󰗹", command: "firefox --private-window" },
    ]
  },
  // TOOLS - VANGUARD position (right side middle)
  {
    id: "tools", label: "TOOLS", icon: "◯", x: 0.76, y: 0.56, size: 1.0, ringStyle: "icon",
    subItems: [
      { id: "galaxy", label: "GALAXY", icon: "◯", command: "ags request toggle-galaxy" },
      { id: "periodic", label: "PERIODIC", icon: "󰎔", command: "ags request toggle-periodic-table" },
    ]
  },

  // SYSTEM - CRUCIBLE position (lower right)
  {
    id: "system", label: "SYSTEM", icon: "", x: 0.85, y: 0.68, size: 1.1, ringStyle: "icon",
    subItems: [
      { id: "gnome-settings", label: "SETTINGS", icon: "", command: "gnome-control-center" },
      { id: "nvidia", label: "NVIDIA", icon: "󰾲", command: "nvidia-settings" },
      { id: "monitor", label: "MONITOR", icon: "", command: "gnome-system-monitor" },
      { id: "audio", label: "AUDIO", icon: "", command: "pavucontrol" },
    ]
  },

  // === LEFT SIDEBAR QUICK ICONS ===
  {
    id: "music", label: "MUSIC", icon: "", x: 0.04, y: 0.35, size: 0.7, ringStyle: "icon",
    subItems: [
      { id: "spotify", label: "SPOTIFY", icon: "", command: "spotify" },
      { id: "youtube-music", label: "YT MUSIC", icon: "", command: "firefox https://music.youtube.com" },
    ]
  },
  {
    id: "settings", label: "CONFIG", icon: "", x: 0.04, y: 0.45, size: 0.7, ringStyle: "icon",
    subItems: [
      { id: "gnome-settings", label: "SYSTEM", icon: "", command: "gnome-control-center" },
      { id: "bluetooth", label: "BLUETOOTH", icon: "", command: "blueman-manager" },
    ]
  },
  {
    id: "network", label: "NETWORK", icon: "󰖩", x: 0.04, y: 0.55, size: 0.7, ringStyle: "icon",
    command: "nm-connection-editor"
  },
  {
    id: "power", label: "POWER", icon: "⏻", x: 0.04, y: 0.65, size: 0.7, ringStyle: "icon",
    subItems: [
      { id: "logout", label: "LOGOUT", icon: "󰍃", command: "hyprctl dispatch exit" },
      { id: "reboot", label: "REBOOT", icon: "", command: "systemctl reboot" },
      { id: "shutdown", label: "SHUTDOWN", icon: "⏻", command: "systemctl poweroff" },
      { id: "suspend", label: "SUSPEND", icon: "󰤄", command: "systemctl suspend" },
    ]
  },
]

const TABS = [
  { id: "map", label: "MAP", active: false },
  { id: "director", label: "DIRECTOR", active: true },
  { id: "roster", label: "ROSTER", active: false },
]

interface Star {
  x: number
  y: number
  z: number  // depth layer for parallax
  size: number
  brightness: number
  twinklePhase: number
}

function generateStars(count: number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.8 + 0.2,  // 0.2 to 1.0 depth
      size: Math.random() * 1.5 + 0.5,
      brightness: Math.random() * 0.4 + 0.2,
      twinklePhase: Math.random() * Math.PI * 2,
    })
  }
  return stars
}

function createCircleCursor(display: Gdk.Display, hovered: boolean = false): Gdk.Cursor | null {
  const size = s(64)
  const surface = new cairo.ImageSurface(cairo.Format.ARGB32, size, size)
  const cr = new cairo.Context(surface)

  const centerX = size / 2
  const centerY = size / 2
  const outerRadius = hovered ? 26 : 28
  const innerRadius = hovered ? 16 : 18

  if (hovered) {
    // Hovered cursor - brighter, filled center
    cr.setSourceRGBA(0.4, 0.8, 1.0, 0.95)
    cr.setLineWidth(4)
    cr.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI)
    cr.stroke()

    // Bright filled center
    cr.setSourceRGBA(0.3, 0.7, 0.9, 0.9)
    cr.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
    cr.fill()

    // Inner glow ring
    cr.setSourceRGBA(0.5, 0.9, 1.0, 0.8)
    cr.setLineWidth(2)
    cr.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
    cr.stroke()

    // Center dot
    cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0)
    cr.arc(centerX, centerY, 3, 0, 2 * Math.PI)
    cr.fill()
  } else {
    // Normal cursor
    cr.setSourceRGBA(0.6, 0.65, 0.7, 0.9)
    cr.setLineWidth(6)
    cr.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI)
    cr.stroke()

    cr.setSourceRGBA(0.1, 0.12, 0.15, 0.95)
    cr.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
    cr.fill()

    cr.setSourceRGBA(0.4, 0.45, 0.5, 0.5)
    cr.setLineWidth(2)
    cr.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
    cr.stroke()
  }

  const pixbuf = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)
  if (pixbuf) {
    return Gdk.Cursor.new_from_pixbuf(display, pixbuf, size / 2, size / 2)
  }
  return null
}

export default function DestinationMenu() {
  let mouseX = 0
  let mouseY = 0
  let smoothMouseX = 0
  let smoothMouseY = 0
  const SMOOTH_FACTOR = 0.18  // Balance between smooth and responsive
  let hoveredDest: string | null = null
  let hoveredSubItem: string | null = null
  let animTime = 0
  const stars = generateStars(150)

  // Load background image
  let bgPixbuf: GdkPixbuf.Pixbuf | null = null
  let scaledBg: GdkPixbuf.Pixbuf | null = null
  let lastWidth = 0
  let lastHeight = 0
  try {
    bgPixbuf = GdkPixbuf.Pixbuf.new_from_file(BG_IMAGE_PATH)
  } catch (e) {
    print(`Failed to load background: ${e}`)
  }

  // Cursor state
  let normalCursor: Gdk.Cursor | null = null
  let hoverCursor: Gdk.Cursor | null = null
  let currentCursorHovered = false

  // Sub-menu state
  let currentPage: "main" | "sub" = "main"
  let selectedDestination: Destination | null = null
  let transitionProgress = 0
  let transitionDirection: "in" | "out" | null = null

  const canvas = new Gtk.DrawingArea()
  canvas.set_hexpand(true)
  canvas.set_vexpand(true)
  canvas.add_events(
    Gdk.EventMask.POINTER_MOTION_MASK |
    Gdk.EventMask.BUTTON_PRESS_MASK |
    Gdk.EventMask.LEAVE_NOTIFY_MASK |
    Gdk.EventMask.ENTER_NOTIFY_MASK
  )

  canvas.connect("realize", () => {
    const gdkWindow = canvas.get_window()
    if (gdkWindow) {
      const display = gdkWindow.get_display()
      normalCursor = createCircleCursor(display, false)
      hoverCursor = createCircleCursor(display, true)
      if (normalCursor) {
        gdkWindow.set_cursor(normalCursor)
      }
    }
  })

  canvas.connect("leave-notify-event", () => {
    hoveredDest = null
    hoveredSubItem = null
    canvas.queue_draw()
    return false
  })

  canvas.connect("motion-notify-event", (_w, event) => {
    mouseX = event.get_coords()[1]
    mouseY = event.get_coords()[2]
    canvas.queue_draw()
    return false
  })

  canvas.connect("button-press-event", (_w, event) => {
    if (event.get_button()[1] !== 1) return false

    if (currentPage === "main" && hoveredDest) {
      const dest = DESTINATIONS.find(d => d.id === hoveredDest)
      if (dest) {
        if (dest.subItems && dest.subItems.length > 0) {
          // Open sub-menu
          selectedDestination = dest
          transitionDirection = "in"
          transitionProgress = 0
        } else if (dest.command) {
          // Direct command - launch and close director
          GLib.spawn_command_line_async(dest.command)
          setDestinationVisible(false)
        }
      }
    } else if (currentPage === "sub") {
      if (hoveredSubItem === "back") {
        // Go back to main
        transitionDirection = "out"
        transitionProgress = 0
      } else if (hoveredSubItem && selectedDestination?.subItems) {
        const item = selectedDestination.subItems.find(i => i.id === hoveredSubItem)
        if (item) {
          // Launch app and close director
          GLib.spawn_command_line_async(item.command)
          setDestinationVisible(false)
        }
      }
    }
    return false
  })

  canvas.connect("draw", (_w, cr) => {
    const allocation = canvas.get_allocation()
    const width = allocation.width
    const height = allocation.height
    const centerX = width / 2
    const centerY = height / 2
    const minDim = Math.min(width, height)
    const baseSize = minDim * 0.055

    // Smooth mouse interpolation for parallax
    smoothMouseX += (mouseX - smoothMouseX) * SMOOTH_FACTOR
    smoothMouseY += (mouseY - smoothMouseY) * SMOOTH_FACTOR

    // Parallax offset based on smoothed mouse position (inverted for depth effect)
    const parallaxX = -(smoothMouseX - centerX) / centerX
    const parallaxY = -(smoothMouseY - centerY) / centerY

    // Draw background image with parallax
    if (bgPixbuf) {
      // Scale image to cover canvas (with extra for parallax movement)
      const scalePadding = s(60)  // Extra pixels for parallax
      const targetW = width + scalePadding * 2
      const targetH = height + scalePadding * 2

      // Only rescale if dimensions changed
      if (lastWidth !== width || lastHeight !== height) {
        const imgW = bgPixbuf.get_width()
        const imgH = bgPixbuf.get_height()
        const scaleX = targetW / imgW
        const scaleY = targetH / imgH
        const scale = Math.max(scaleX, scaleY)  // Cover mode
        scaledBg = bgPixbuf.scale_simple(
          Math.ceil(imgW * scale),
          Math.ceil(imgH * scale),
          GdkPixbuf.InterpType.BILINEAR
        )
        lastWidth = width
        lastHeight = height
      }

      if (scaledBg) {
        const bgOffsetX = -scalePadding + parallaxX * 50
        const bgOffsetY = -scalePadding + parallaxY * 50
        Gdk.cairo_set_source_pixbuf(cr, scaledBg, bgOffsetX, bgOffsetY)
        cr.paint()
      }
    } else {
      // Fallback solid background
      cr.setSourceRGBA(0.02, 0.025, 0.06, 0.97)
      cr.paint()
    }

    // Dark overlay for better readability
    cr.setSourceRGBA(0.0, 0.0, 0.05, 0.4)
    cr.paint()

    // Stars with parallax (on top of background)
    stars.forEach(star => {
      const twinkle = Math.sin(animTime * 0.015 + star.twinklePhase) * 0.3 + 0.7
      const px = (star.x * width) + (parallaxX * 120 * star.z)
      const py = (star.y * height) + (parallaxY * 120 * star.z)
      cr.setSourceRGBA(0.85, 0.88, 1.0, star.brightness * twinkle * 0.6)
      cr.arc(px, py, star.size * star.z, 0, 2 * Math.PI)
      cr.fill()
    })

    // Handle transitions
    if (transitionDirection === "in") {
      transitionProgress += 0.08
      if (transitionProgress >= 1) {
        transitionProgress = 1
        transitionDirection = null
        currentPage = "sub"
      }
    } else if (transitionDirection === "out") {
      transitionProgress -= 0.08
      if (transitionProgress <= 0) {
        transitionProgress = 0
        transitionDirection = null
        currentPage = "main"
        selectedDestination = null
      }
    }

    // Draw tabs - disabled
    // drawTabs(cr, width, parallaxX)

    if (currentPage === "main" || transitionDirection) {
      // Draw main destinations with parallax
      const mainAlpha = transitionDirection ? 1 - transitionProgress : 1
      const mainScale = transitionDirection ? 1 - transitionProgress * 0.3 : 1

      hoveredDest = null
      DESTINATIONS.forEach((dest, idx) => {
        // Left sidebar items (x < 0.1) stay fixed - no parallax
        const isLeftSidebar = dest.x < 0.1
        let depthFactor: number
        if (isLeftSidebar) {
          depthFactor = 0  // Sidebar items stay fixed on screen
        } else if (dest.ringStyle === "central") {
          depthFactor = 1.2  // Tower has more parallax
        } else if (dest.id === "terminal") {
          depthFactor = 1.1  // Terminal moves with Tower, more parallax
        } else if (dest.id === "files") {
          depthFactor = 1.0  // Files has more parallax
        } else if (dest.id === "browser") {
          depthFactor = 0.38  // Browser moves slightly more than background (bg=50, this=57)
        } else {
          depthFactor = 0.4 + (idx % 3) * 0.25
        }
        const px = (dest.x * width) + (parallaxX * 150 * depthFactor)
        const py = (dest.y * height) + (parallaxY * 150 * depthFactor)
        const pSize = baseSize * dest.size * mainScale

        const dist = Math.sqrt((mouseX - px) ** 2 + (mouseY - py) ** 2)
        const isHovered = dist < pSize && !transitionDirection

        if (isHovered) {
          hoveredDest = dest.id
        }

        drawDestination(cr, dest, px, py, pSize, isHovered, animTime, mainAlpha, dest.subItems && dest.subItems.length > 0)
      })
    }

    if (currentPage === "sub" || transitionDirection === "in") {
      // Draw sub-menu
      const subAlpha = transitionProgress
      const subScale = 0.7 + transitionProgress * 0.3

      if (selectedDestination?.subItems) {
        drawSubMenu(cr, selectedDestination, width, height, baseSize * subScale, subAlpha, parallaxX, parallaxY)
      }
    }

    // Corner decorations with parallax
    drawCornerDecor(cr, width, height, parallaxX, parallaxY)

    // Update cursor based on hover state
    const isHovering = hoveredDest !== null || hoveredSubItem !== null
    if (isHovering !== currentCursorHovered) {
      currentCursorHovered = isHovering
      const gdkWindow = canvas.get_window()
      if (gdkWindow) {
        gdkWindow.set_cursor(isHovering ? hoverCursor : normalCursor)
      }
    }

    return false
  })

  function drawTabs(cr: any, width: number, parallaxX: number) {
    const tabWidth = s(120)
    const tabHeight = s(32)
    const totalWidth = TABS.length * tabWidth + (TABS.length - 1) * 20
    const startX = (width - totalWidth) / 2 + parallaxX * 5
    const y = 25

    TABS.forEach((tab, i) => {
      const x = startX + i * (tabWidth + 20)

      if (tab.active) {
        cr.setSourceRGBA(0.15, 0.2, 0.3, 0.9)
        roundedRect(cr, x, y, tabWidth, tabHeight, 4)
        cr.fill()

        cr.setSourceRGBA(0.4, 0.6, 0.85, 0.8)
        cr.setLineWidth(2)
        roundedRect(cr, x, y, tabWidth, tabHeight, 4)
        cr.stroke()
      } else {
        cr.setSourceRGBA(0.08, 0.1, 0.15, 0.6)
        roundedRect(cr, x, y, tabWidth, tabHeight, 4)
        cr.fill()

        cr.setSourceRGBA(0.25, 0.3, 0.4, 0.5)
        cr.setLineWidth(1)
        roundedRect(cr, x, y, tabWidth, tabHeight, 4)
        cr.stroke()
      }

      cr.setSourceRGBA(tab.active ? 0.95 : 0.55, tab.active ? 0.97 : 0.6, tab.active ? 1 : 0.65, 1)
      cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
      cr.setFontSize(12)
      const extents = cr.textExtents(tab.label)
      cr.moveTo(x + (tabWidth - extents.width) / 2, y + tabHeight / 2 + 4)
      cr.showText(tab.label)
    })
  }

  function drawDestination(cr: any, dest: Destination, x: number, y: number, size: number, _hovered: boolean, _time: number, alpha: number, hasSubMenu: boolean) {
    const actualSize = size

    // Reset path to prevent lines connecting between destinations
    cr.newPath()

    // Outer decorative ring
    cr.setSourceRGBA(0.35, 0.5, 0.65, 0.3 * alpha)
    cr.setLineWidth(1)
    cr.arc(x, y, actualSize + 10, 0, 2 * Math.PI)
    cr.stroke()

    // Tick marks
    const tickCount = dest.ringStyle === "central" ? 12 : 8
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2
      const innerR = actualSize + 5
      const outerR = actualSize + 14
      cr.setSourceRGBA(0.45, 0.65, 0.85, 0.4 * alpha)
      cr.setLineWidth(1)
      cr.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR)
      cr.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR)
      cr.stroke()
    }

    // Main circle fill
    if (dest.ringStyle === "central") {
      cr.setSourceRGBA(0.2, 0.35, 0.5, 0.85 * alpha)
    } else if (dest.ringStyle === "planet") {
      cr.setSourceRGBA(0.18, 0.28, 0.4, 0.8 * alpha)
    } else {
      cr.setSourceRGBA(0.1, 0.14, 0.22, 0.75 * alpha)
    }
    cr.arc(x, y, actualSize, 0, 2 * Math.PI)
    cr.fill()

    // Main border
    cr.setSourceRGBA(0.45, 0.7, 0.9, 0.7 * alpha)
    cr.setLineWidth(2)
    cr.arc(x, y, actualSize, 0, 2 * Math.PI)
    cr.stroke()

    // Inner ring
    cr.setSourceRGBA(0.5, 0.75, 0.95, 0.2 * alpha)
    cr.setLineWidth(1)
    cr.arc(x, y, actualSize * 0.65, 0, 2 * Math.PI)
    cr.stroke()

    // Icon - only show for sidebar items
    const isLeftSidebarIcon = dest.x < 0.1
    if (isLeftSidebarIcon) {
      cr.setSourceRGBA(0.9, 0.94, 1.0, 0.85 * alpha)
      cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
      const iconSize = actualSize * 0.5
      cr.setFontSize(iconSize)
      const iconExtents = cr.textExtents(dest.icon)
      cr.moveTo(x - iconExtents.width / 2, y + iconExtents.height / 3)
      cr.showText(dest.icon)
    }

    // Label - overlaid on sphere for main destinations, smaller for sidebar
    const isLeftSidebar = dest.x < 0.1
    if (isLeftSidebar) {
      // Smaller labels for sidebar, below the icon
      cr.setSourceRGBA(0.9, 0.93, 0.98, 0.95 * alpha)
      cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
      cr.setFontSize(10)
      const labelExtents = cr.textExtents(dest.label)
      cr.moveTo(x - labelExtents.width / 2, y + actualSize + 18)
      cr.showText(dest.label)
    } else {
      // Large labels with wide letter spacing, light weight
      cr.setSourceRGBA(0.78, 0.82, 0.88, 0.75 * alpha)
      cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
      cr.setFontSize(32)

      // Calculate total width with wide letter spacing
      const letterSpacing = s(22)
      const chars = dest.label.split('')
      let totalWidth = 0
      chars.forEach(ch => {
        totalWidth += cr.textExtents(ch).width + letterSpacing
      })
      totalWidth -= letterSpacing // Remove last spacing

      // Position label based on destination
      let labelX = x - totalWidth / 2
      let labelY = y + 12  // default: centered on sphere

      if (dest.id === "terminal") {
        // TERMINAL: label lower (visible above cut-off sphere)
        labelY = y - actualSize + 200
      } else if (dest.id === "browser") {
        // BROWSER: label below
        labelY = y + actualSize + 40
      } else if (dest.id === "tools") {
        // TOOLS: label above
        labelY = y - actualSize - 15
      } else if (dest.id === "system") {
        // SYSTEM: label below
        labelY = y + actualSize + 40
      } else if (dest.id === "home") {
        // TOWER: label to the left
        labelX = x - actualSize - totalWidth - 20
        labelY = y + 12
      }

      chars.forEach(ch => {
        cr.moveTo(labelX, labelY)
        cr.showText(ch)
        labelX += cr.textExtents(ch).width + letterSpacing
      })
    }
  }

  function drawSubMenu(cr: any, dest: Destination, width: number, height: number, baseSize: number, alpha: number, parallaxX: number, parallaxY: number) {
    const items = dest.subItems!
    const centerX = width / 2
    const centerY = height / 2

    // Title at top
    cr.setSourceRGBA(0.9, 0.94, 1.0, alpha)
    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
    cr.setFontSize(24)
    const titleExtents = cr.textExtents(dest.label)
    cr.moveTo(centerX - titleExtents.width / 2 + parallaxX * 5, 90)
    cr.showText(dest.label)

    // Subtitle
    cr.setSourceRGBA(0.6, 0.7, 0.8, alpha * 0.7)
    cr.setFontSize(12)
    const subtitle = "SELECT DESTINATION"
    const subExtents = cr.textExtents(subtitle)
    cr.moveTo(centerX - subExtents.width / 2 + parallaxX * 5, 115)
    cr.showText(subtitle)

    // Back button
    const backX = 80 + parallaxX * 10
    const backY = height / 2 + parallaxY * 10
    const backSize = baseSize * 0.8
    const backDist = Math.sqrt((mouseX - backX) ** 2 + (mouseY - backY) ** 2)
    const backHovered = backDist < backSize

    hoveredSubItem = null
    if (backHovered) {
      hoveredSubItem = "back"
    }

    // Draw back button (no hover effect on button itself)
    cr.setSourceRGBA(0.15, 0.2, 0.3, 0.8 * alpha)
    cr.arc(backX, backY, backSize, 0, 2 * Math.PI)
    cr.fill()

    cr.setSourceRGBA(0.45, 0.6, 0.8, 0.6 * alpha)
    cr.setLineWidth(2)
    cr.arc(backX, backY, backSize, 0, 2 * Math.PI)
    cr.stroke()

    cr.setSourceRGBA(0.9, 0.94, 1.0, 0.85 * alpha)
    cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
    cr.setFontSize(backSize * 0.6)
    const backIcon = "󰁍"
    const backIconExt = cr.textExtents(backIcon)
    cr.moveTo(backX - backIconExt.width / 2, backY + backIconExt.height / 3)
    cr.showText(backIcon)

    cr.setSourceRGBA(0.7, 0.75, 0.85, alpha * 0.8)
    cr.setFontSize(10)
    const backLabel = "BACK"
    const backLabelExt = cr.textExtents(backLabel)
    cr.moveTo(backX - backLabelExt.width / 2, backY + backSize + 18)
    cr.showText(backLabel)

    // Arrange items in arc or grid based on count
    const itemCount = items.length
    const radius = Math.min(width, height) * 0.28
    const startAngle = -Math.PI / 2 - (itemCount - 1) * 0.3
    const angleStep = 0.6

    items.forEach((item, i) => {
      const angle = startAngle + i * angleStep
      const ix = centerX + Math.cos(angle) * radius + parallaxX * 15
      const iy = centerY + Math.sin(angle) * radius * 0.8 + 40 + parallaxY * 15
      const iSize = baseSize * 1.1

      const dist = Math.sqrt((mouseX - ix) ** 2 + (mouseY - iy) ** 2)
      const isHovered = dist < iSize

      if (isHovered) {
        hoveredSubItem = item.id
      }

      // Outer ring
      cr.setSourceRGBA(0.35, 0.5, 0.65, 0.35 * alpha)
      cr.setLineWidth(1)
      cr.arc(ix, iy, iSize + 8, 0, 2 * Math.PI)
      cr.stroke()

      // Ticks
      for (let t = 0; t < 8; t++) {
        const ta = (t / 8) * Math.PI * 2
        cr.setSourceRGBA(0.45, 0.65, 0.85, 0.4 * alpha)
        cr.setLineWidth(1)
        cr.moveTo(ix + Math.cos(ta) * (iSize + 4), iy + Math.sin(ta) * (iSize + 4))
        cr.lineTo(ix + Math.cos(ta) * (iSize + 12), iy + Math.sin(ta) * (iSize + 12))
        cr.stroke()
      }

      // Fill
      cr.setSourceRGBA(0.12, 0.18, 0.28, 0.8 * alpha)
      cr.arc(ix, iy, iSize, 0, 2 * Math.PI)
      cr.fill()

      // Border
      cr.setSourceRGBA(0.5, 0.75, 0.95, 0.7 * alpha)
      cr.setLineWidth(2)
      cr.arc(ix, iy, iSize, 0, 2 * Math.PI)
      cr.stroke()

      // Icon
      cr.setSourceRGBA(0.9, 0.94, 1.0, 0.85 * alpha)
      cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL)
      cr.setFontSize(iSize * 0.5)
      const iExt = cr.textExtents(item.icon)
      cr.moveTo(ix - iExt.width / 2, iy + iExt.height / 3)
      cr.showText(item.icon)

      // Label
      cr.setSourceRGBA(0.8, 0.87, 0.94, 0.75 * alpha)
      cr.selectFontFace("JetBrainsMono Nerd Font", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
      cr.setFontSize(10)
      const lExt = cr.textExtents(item.label)
      cr.moveTo(ix - lExt.width / 2, iy + iSize + 20)
      cr.showText(item.label)
    })
  }

  function drawHoverBrackets(cr: any, cx: number, cy: number, dist: number, alpha: number) {
    const sz = 8
    cr.setSourceRGBA(0.55, 0.8, 1.0, 0.9 * alpha)
    cr.setLineWidth(2)

    cr.moveTo(cx - dist, cy - dist + sz)
    cr.lineTo(cx - dist, cy - dist)
    cr.lineTo(cx - dist + sz, cy - dist)
    cr.stroke()

    cr.moveTo(cx + dist - sz, cy - dist)
    cr.lineTo(cx + dist, cy - dist)
    cr.lineTo(cx + dist, cy - dist + sz)
    cr.stroke()

    cr.moveTo(cx - dist, cy + dist - sz)
    cr.lineTo(cx - dist, cy + dist)
    cr.lineTo(cx - dist + sz, cy + dist)
    cr.stroke()

    cr.moveTo(cx + dist - sz, cy + dist)
    cr.lineTo(cx + dist, cy + dist)
    cr.lineTo(cx + dist, cy + dist - sz)
    cr.stroke()
  }

  function drawCornerDecor(cr: any, width: number, height: number, parallaxX: number, parallaxY: number) {
    cr.setSourceRGBA(0.35, 0.45, 0.55, 0.3)
    cr.setLineWidth(1)

    const m = 30
    const len = 70
    const pxOff = parallaxX * 8
    const pyOff = parallaxY * 8

    cr.moveTo(m + pxOff, height - m + pyOff)
    cr.lineTo(m + pxOff, height - m - len + pyOff)
    cr.stroke()
    cr.moveTo(m + pxOff, height - m + pyOff)
    cr.lineTo(m + len + pxOff, height - m + pyOff)
    cr.stroke()

    cr.moveTo(width - m + pxOff, height - m + pyOff)
    cr.lineTo(width - m + pxOff, height - m - len + pyOff)
    cr.stroke()
    cr.moveTo(width - m + pxOff, height - m + pyOff)
    cr.lineTo(width - m - len + pxOff, height - m + pyOff)
    cr.stroke()
  }

  function roundedRect(cr: any, x: number, y: number, w: number, h: number, r: number) {
    cr.newPath()
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI)
    cr.arc(x + w - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI)
    cr.arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI)
    cr.arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI)
    cr.closePath()
  }

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 33, () => {
    animTime += 1
    canvas.queue_draw()
    return GLib.SOURCE_CONTINUE
  })

  canvas.show_all()

  return (
    <box name="destination-menu" expand hexpand vexpand>
      {canvas}
    </box>
  )
}

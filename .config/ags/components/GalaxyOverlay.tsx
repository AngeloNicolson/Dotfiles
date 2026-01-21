import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import cairo from "cairo"

// Planet data - distributed across 3 orbit rings
interface Planet {
  id: string
  label: string
  orbit: number      // Which orbit ring (0=inner, 1=middle, 2=outer)
  startAngle: number // Initial position in degrees
  sizeFactor: number // Size relative to base size
}

const PLANETS: Planet[] = [
  // Inner orbit
  { id: "p1", label: "Planet 1", orbit: 0, startAngle: 60, sizeFactor: 1.0 },
  { id: "p2", label: "Planet 2", orbit: 0, startAngle: 240, sizeFactor: 0.9 },
  // Middle orbit
  { id: "p3", label: "Planet 3", orbit: 1, startAngle: 20, sizeFactor: 1.1 },
  { id: "p4", label: "Planet 4", orbit: 1, startAngle: 140, sizeFactor: 1.0 },
  { id: "p5", label: "Planet 5", orbit: 1, startAngle: 260, sizeFactor: 1.15 },
  // Outer orbit
  { id: "p6", label: "Planet 6", orbit: 2, startAngle: 100, sizeFactor: 1.2 },
  { id: "p7", label: "Planet 7", orbit: 2, startAngle: 280, sizeFactor: 1.05 },
]

// Orbit radii as percentage of the smaller screen dimension
const ORBIT_PERCENTAGES = [0.12, 0.22, 0.34]
const CENTER_SIZE_PERCENT = 0.06
const PLANET_BASE_SIZE_PERCENT = 0.045

// Create custom circular cursor
function createCircleCursor(display: Gdk.Display): Gdk.Cursor | null {
  const size = 64
  const surface = new cairo.ImageSurface(cairo.Format.ARGB32, size, size)
  const cr = new cairo.Context(surface)

  const centerX = size / 2
  const centerY = size / 2
  const outerRadius = 28
  const innerRadius = 18

  // Draw outer ring (lighter gray)
  cr.setSourceRGBA(0.6, 0.65, 0.7, 0.9)
  cr.setLineWidth(6)
  cr.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI)
  cr.stroke()

  // Draw inner darker circle
  cr.setSourceRGBA(0.1, 0.12, 0.15, 0.95)
  cr.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
  cr.fill()

  // Inner highlight ring
  cr.setSourceRGBA(0.4, 0.45, 0.5, 0.5)
  cr.setLineWidth(2)
  cr.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI)
  cr.stroke()

  const pixbuf = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)
  if (pixbuf) {
    return Gdk.Cursor.new_from_pixbuf(display, pixbuf, size / 2, size / 2)
  }
  return null
}

export default function DestinationOverlay() {
  let angle = 0
  let mouseX = -1000
  let mouseY = -1000
  let hoveredPlanet: string | null = null

  // Main drawing area - fullscreen
  const canvas = new Gtk.DrawingArea()
  canvas.set_hexpand(true)
  canvas.set_vexpand(true)
  canvas.add_events(
    Gdk.EventMask.POINTER_MOTION_MASK |
    Gdk.EventMask.BUTTON_PRESS_MASK |
    Gdk.EventMask.LEAVE_NOTIFY_MASK |
    Gdk.EventMask.ENTER_NOTIFY_MASK
  )

  // Set custom cursor on realize
  canvas.connect("realize", () => {
    const gdkWindow = canvas.get_window()
    if (gdkWindow) {
      const display = gdkWindow.get_display()
      const cursor = createCircleCursor(display)
      if (cursor) {
        gdkWindow.set_cursor(cursor)
      }
    }
  })

  canvas.connect("leave-notify-event", () => {
    mouseX = -1000
    mouseY = -1000
    hoveredPlanet = null
    canvas.queue_draw()
    return false
  })

  // Track mouse movement
  canvas.connect("motion-notify-event", (_w, event) => {
    mouseX = event.get_coords()[1]
    mouseY = event.get_coords()[2]
    canvas.queue_draw()
    return false
  })

  canvas.connect("draw", (_w, cr) => {
    const allocation = canvas.get_allocation()
    const width = allocation.width
    const height = allocation.height
    const centerX = width / 2
    const centerY = height / 2
    const minDim = Math.min(width, height)

    // Calculate sizes based on screen
    const orbitRadii = ORBIT_PERCENTAGES.map(p => minDim * p)
    const centerSize = minDim * CENTER_SIZE_PERCENT
    const planetBaseSize = minDim * PLANET_BASE_SIZE_PERCENT

    // Draw orbit rings
    orbitRadii.forEach((r) => {
      cr.setSourceRGBA(0.4, 0.75, 0.85, 0.25)
      cr.setLineWidth(1.5)
      cr.arc(centerX, centerY, r, 0, 2 * Math.PI)
      cr.stroke()
    })

    // Check if hovering center
    const distToCenter = Math.sqrt((mouseX - centerX) ** 2 + (mouseY - centerY) ** 2)
    const hoveringCenter = distToCenter < centerSize / 2

    // Draw center node
    cr.setSourceRGBA(0.35, 0.75, 0.85, hoveringCenter ? 1 : 0.9)
    cr.arc(centerX, centerY, centerSize / 2, 0, 2 * Math.PI)
    cr.fill()
    cr.setSourceRGBA(0.5, 0.9, 1.0, 1)
    cr.setLineWidth(hoveringCenter ? 3 : 2)
    cr.arc(centerX, centerY, centerSize / 2, 0, 2 * Math.PI)
    cr.stroke()

    // Draw squares around center if hovered
    if (hoveringCenter) {
      drawHoverSquares(cr, centerX, centerY, centerSize / 2 + 15, 8)
    }

    // Draw planets and check hover
    hoveredPlanet = null
    PLANETS.forEach((p) => {
      const orbitR = orbitRadii[p.orbit]
      const rad = ((p.startAngle + angle) * Math.PI) / 180
      const px = centerX + orbitR * Math.cos(rad)
      const py = centerY + orbitR * Math.sin(rad)
      const pSize = planetBaseSize * p.sizeFactor

      // Check if mouse is over this planet
      const dist = Math.sqrt((mouseX - px) ** 2 + (mouseY - py) ** 2)
      const isHovered = dist < pSize / 2

      if (isHovered) {
        hoveredPlanet = p.id
      }

      // Planet fill
      cr.setSourceRGBA(0.25, 0.55, 0.65, isHovered ? 1 : 0.85)
      cr.arc(px, py, pSize / 2, 0, 2 * Math.PI)
      cr.fill()

      // Planet border
      cr.setSourceRGBA(0.5, 0.85, 0.95, 1)
      cr.setLineWidth(isHovered ? 3 : 2)
      cr.arc(px, py, pSize / 2, 0, 2 * Math.PI)
      cr.stroke()

      // Draw squares around planet if hovered
      if (isHovered) {
        drawHoverSquares(cr, px, py, pSize / 2 + 12, 6)
      }
    })

    return false
  })

  // Helper function to draw squares around a point
  function drawHoverSquares(cr: any, cx: number, cy: number, distance: number, squareSize: number) {
    cr.setSourceRGBA(0.5, 0.9, 1.0, 0.9)

    // 4 squares at cardinal directions
    const positions = [
      { x: cx - distance, y: cy },           // Left
      { x: cx + distance, y: cy },           // Right
      { x: cx, y: cy - distance },           // Top
      { x: cx, y: cy + distance },           // Bottom
    ]

    positions.forEach(pos => {
      cr.rectangle(
        pos.x - squareSize / 2,
        pos.y - squareSize / 2,
        squareSize,
        squareSize
      )
      cr.fill()
    })
  }

  // Animation
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
    angle += 0.04
    if (angle >= 360) angle -= 360
    canvas.queue_draw()
    return GLib.SOURCE_CONTINUE
  })

  canvas.show_all()

  return (
    <box name="destination-overlay" expand hexpand vexpand>
      {canvas}
    </box>
  )
}

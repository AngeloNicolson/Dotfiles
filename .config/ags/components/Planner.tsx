import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import { createState } from "ags"

const PLANS_DIR = GLib.get_home_dir() + "/.config/plans"
const START_H = 4
const END_H = 22
const DEFAULT_ROW_H = 72
const MIN_ROW_H = 24
const MAX_ROW_H = 120

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

function pad2(n: number): string { return String(n).padStart(2, "0") }

function getDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDate(date: Date): string {
  return `${DAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function formatTime(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

function dirExists(path: string): boolean {
  return GLib.file_test(path, GLib.FileTest.IS_DIR)
}

function loadPlanFiles(): string[] {
  if (!dirExists(PLANS_DIR)) return []
  try {
    const dir = GLib.Dir.open(PLANS_DIR, 0)
    const files: string[] = []
    let name: string | null
    while ((name = dir.read_name()) !== null) {
      if (name.endsWith(".plan")) files.push(name)
    }
    files.sort()
    return files
  } catch (e) {
    print(`Error reading plans dir: ${e}`)
    return []
  }
}

interface PlanEvent {
  startMin: number
  endMin: number
  desc: string
}

function parsePlanFile(dateStr: string): PlanEvent[] {
  const path = `${PLANS_DIR}/${dateStr}.plan`
  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return []
  try {
    const content = readFile(path)
    if (!content) return []
    const events: PlanEvent[] = []
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed === "" || trimmed.startsWith("#")) continue
      const rangeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/)
      if (rangeMatch) {
        const [h1, m1] = rangeMatch[1].split(":").map(Number)
        const [h2, m2] = rangeMatch[2].split(":").map(Number)
        events.push({ startMin: h1 * 60 + m1, endMin: h2 * 60 + m2, desc: rangeMatch[3] })
        continue
      }
      const singleMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)$/)
      if (singleMatch) {
        const [h, m] = singleMatch[1].split(":").map(Number)
        const sm = h * 60 + m
        events.push({ startMin: sm, endMin: sm + 15, desc: singleMatch[2] })
      }
    }
    return events
  } catch { return [] }
}

function getHeaderComments(dateStr: string): string {
  const path = `${PLANS_DIR}/${dateStr}.plan`
  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return ""
  try {
    const content = readFile(path)
    if (!content) return ""
    const lines = content.split("\n")
    const headerLines: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === "" || trimmed.startsWith("#")) {
        headerLines.push(line)
      } else {
        break
      }
    }
    return headerLines.length > 0 ? headerLines.join("\n") + "\n" : ""
  } catch { return "" }
}

function isToday(date: Date): boolean {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
}

function generateTemplate(): string {
  return [
    "# -- .plan file -------------------------",
    "# YYYY-MM-DD.plan  |  Edit with neovim",
    "#",
    "#   HH:MM-HH:MM  Event (time range)",
    "#   HH:MM  Event (single 15-min slot)",
    "#",
    "# Example:",
    "#   09:00-10:30  Morning focus block",
    "#   12:00-13:00  Lunch",
    "#   14:00  Quick standup",
    "",
  ].join("\n") + "\n"
}

function createPlansDir() {
  GLib.mkdir_with_parents(PLANS_DIR, 0o755)
  writeFile(`${PLANS_DIR}/template.plan`, generateTemplate())
}

export default function Planner() {
  const [plansExist, setPlansExist] = createState(dirExists(PLANS_DIR))
  const [currentDate, setCurrentDate] = createState(new Date())
  const [events, setEvents] = createState<PlanEvent[]>([])
  const [fileList, setFileList] = createState<string[]>([])
  const [rowH, setRowH] = createState(DEFAULT_ROW_H)

  // Interaction state
  let dragStartMin = -1
  let isDragging = false
  let activeEntry: Gtk.Entry | null = null
  let gridOverlay: Gtk.Overlay | null = null
  let scrollableRef: Gtk.Widget | null = null
  let eventOverlays: Gtk.Widget[] = []

  function reload() {
    const exists = dirExists(PLANS_DIR)
    setPlansExist(exists)
    if (exists) {
      setFileList(loadPlanFiles())
      setEvents(parsePlanFile(getDateStr(currentDate.get())))
    } else {
      setEvents([])
    }
  }

  // Y coordinate to minutes (snapped to 15min)
  function yToMin(y: number): number {
    const h = rowH.get()
    const rowWithLine = h + 1
    const hourIdx = Math.floor(y / rowWithLine)
    const frac = Math.max(0, (y - hourIdx * rowWithLine - 1) / h)
    const raw = (START_H + hourIdx) * 60 + frac * 60
    return Math.round(Math.max(START_H * 60, Math.min(END_H * 60, raw)) / 15) * 15
  }

  // Minutes to Y coordinate (sub-hour precision)
  function minToY(min: number): number {
    const h = rowH.get()
    const hourIdx = Math.floor(min / 60) - START_H
    const frac = (min % 60) / 60
    return hourIdx * (h + 1) + 1 + frac * h
  }

  function saveEventsToFile(dateStr: string, evts: PlanEvent[]) {
    GLib.mkdir_with_parents(PLANS_DIR, 0o755)
    const header = getHeaderComments(dateStr)
    const sorted = [...evts].sort((a, b) => a.startMin - b.startMin)
    const lines: string[] = []
    for (const ev of sorted) {
      if (ev.endMin - ev.startMin <= 15) {
        lines.push(`${formatTime(ev.startMin)}  ${ev.desc}`)
      } else {
        lines.push(`${formatTime(ev.startMin)}-${formatTime(ev.endMin)}  ${ev.desc}`)
      }
    }
    const content = header + lines.join("\n") + "\n"
    writeFile(`${PLANS_DIR}/${dateStr}.plan`, content)
    reload()
  }

  function addNewEvent(startMin: number, endMin: number, desc: string) {
    const evts = [...events.get(), { startMin, endMin, desc }]
    saveEventsToFile(getDateStr(currentDate.get()), evts)
  }

  function updateExistingEvent(oldEv: PlanEvent, newStartMin: number, newEndMin: number, newDesc: string) {
    const evts = events.get().map(e =>
      (e.startMin === oldEv.startMin && e.endMin === oldEv.endMin && e.desc === oldEv.desc)
        ? { startMin: newStartMin, endMin: newEndMin, desc: newDesc }
        : e
    )
    saveEventsToFile(getDateStr(currentDate.get()), evts)
  }

  function hideEntry() {
    if (activeEntry && gridOverlay) {
      gridOverlay.remove(activeEntry)
      activeEntry.destroy()
    }
    activeEntry = null
  }

  function showEntry(startMin: number, endMin: number, desc: string, isNew: boolean, existingEv?: PlanEvent) {
    hideEntry()
    if (!gridOverlay) return

    let committed = false
    const entry = new Gtk.Entry()
    entry.set_name("plan-entry")
    entry.set_hexpand(true)
    entry.set_valign(Gtk.Align.START)
    entry.set_halign(Gtk.Align.FILL)

    const y = minToY(startMin)
    entry.set_margin_top(Math.round(y))
    entry.set_margin_start(39)
    entry.set_margin_end(4)

    const placeholder = `${formatTime(startMin)}-${formatTime(endMin)} Event`
    entry.set_placeholder_text(placeholder)

    if (desc) {
      entry.set_text(desc)
    }

    function commit() {
      if (committed) return
      committed = true
      const text = entry.get_text().trim()
      hideEntry()
      if (!text) return

      let finalStart = startMin
      let finalEnd = endMin
      let finalDesc = text

      const rangeMatch = text.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/)
      const singleMatch = text.match(/^(\d{1,2}:\d{2})\s+(.+)$/)
      if (rangeMatch) {
        const [h1, m1] = rangeMatch[1].split(":").map(Number)
        const [h2, m2] = rangeMatch[2].split(":").map(Number)
        finalStart = h1 * 60 + m1
        finalEnd = h2 * 60 + m2
        finalDesc = rangeMatch[3]
      } else if (singleMatch) {
        const [h, m] = singleMatch[1].split(":").map(Number)
        finalStart = h * 60 + m
        finalEnd = finalStart + 15
        finalDesc = singleMatch[2]
      }

      if (isNew) {
        addNewEvent(finalStart, finalEnd, finalDesc)
      } else if (existingEv) {
        updateExistingEvent(existingEv, finalStart, finalEnd, finalDesc)
      }
    }

    entry.connect("activate", () => commit())
    entry.connect("focus-out-event", () => { commit(); return false })
    entry.connect("key-press-event", (_w: any, ev: any) => {
      const keyval = ev.get_keyval()[1]
      if (keyval === Gdk.KEY_Escape) {
        committed = true
        hideEntry()
        return true
      }
      return false
    })

    activeEntry = entry
    gridOverlay.add_overlay(entry)
    entry.show()

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
      entry.grab_focus()
      return GLib.SOURCE_REMOVE
    })
  }

  // Set cursor on a widget's GdkWindow
  function setCursor(widget: Gtk.Widget, name: string | null) {
    const win = widget.get_window()
    if (!win) return
    if (name) {
      const display = Gdk.Display.get_default()
      const cursor = Gdk.Cursor.new_from_name(display!, name)
      win.set_cursor(cursor)
    } else {
      win.set_cursor(null)
    }
  }

  // Compute column layout for overlapping events (earlier start → left)
  function computeEventColumns(evList: PlanEvent[]): { col: number, total: number }[] {
    const n = evList.length
    if (n === 0) return []
    const result: { col: number, total: number }[] = new Array(n)

    // Sort indices by start time, longer events first on ties
    const indices = evList.map((_, i) => i)
      .sort((a, b) => evList[a].startMin - evList[b].startMin ||
        (evList[b].endMin - evList[b].startMin) - (evList[a].endMin - evList[a].startMin))

    // Greedy column assignment
    const colEnds: number[] = []
    const colAssign: number[] = new Array(n).fill(0)

    for (const i of indices) {
      const ev = evList[i]
      let col = -1
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= ev.startMin) { col = c; break }
      }
      if (col === -1) { col = colEnds.length; colEnds.push(0) }
      colEnds[col] = ev.endMin
      colAssign[i] = col
    }

    // Group overlapping events into clusters to determine total columns
    let groupStart = 0
    let groupEnd = evList[indices[0]].endMin

    for (let gi = 1; gi <= indices.length; gi++) {
      const ev = gi < indices.length ? evList[indices[gi]] : null
      if (!ev || ev.startMin >= groupEnd) {
        // Finalize group [groupStart, gi)
        const maxCol = Math.max(...indices.slice(groupStart, gi).map(j => colAssign[j]))
        for (let k = groupStart; k < gi; k++) {
          result[indices[k]] = { col: colAssign[indices[k]], total: maxCol + 1 }
        }
        groupStart = gi
        if (ev) groupEnd = ev.endMin
      } else {
        groupEnd = Math.max(groupEnd, ev.endMin)
      }
    }
    return result
  }

  // Drag guide lines
  let guideLines: Gtk.Widget[] = []

  function ensureGuideLines() {
    if (!gridOverlay) return
    if (guideLines.length > 0 && guideLines[0].get_parent()) return
    guideLines.forEach(l => { try { l.destroy() } catch {} })
    guideLines = []
    for (let i = 0; i < 2; i++) {
      const line = (<box name="plan-drag-guide" hexpand={true} />) as Gtk.Widget
      line.set_valign(Gtk.Align.START)
      line.set_halign(Gtk.Align.FILL)
      line.set_size_request(-1, 1)
      line.set_no_show_all(true)
      line.hide()
      gridOverlay.add_overlay(line)
      guideLines.push(line)
    }
  }

  function showGuide(idx: number, minVal: number) {
    ensureGuideLines()
    const line = guideLines[idx]
    if (!line) return
    line.set_margin_top(Math.round(minToY(minVal)))
    line.show()
  }

  function hideGuides() {
    for (const l of guideLines) { try { l.hide() } catch {} }
  }

  // Remove old event overlay widgets and place new ones
  function placeEventOverlays() {
    if (!gridOverlay) return

    for (const w of eventOverlays) {
      gridOverlay.remove(w)
      w.destroy()
    }
    eventOverlays = []

    const evList = events.get()
    const columns = computeEventColumns(evList)

    // Available width for column calculations
    const overlayW = gridOverlay.get_allocation().width
    const cellW = overlayW > 50 ? overlayW - 41 : 220
    const COL_GAP = 2
    const EDGE = 8

    for (let idx = 0; idx < evList.length; idx++) {
      const ev = evList[idx]
      const { col, total } = columns[idx]
      const topY = Math.round(minToY(ev.startMin))
      const botY = Math.round(minToY(ev.endMin))
      const cardH = Math.max(18, botY - topY)
      const duration = ev.endMin - ev.startMin

      const timeStr = duration <= 15
        ? formatTime(ev.startMin)
        : `${formatTime(ev.startMin)}-${formatTime(ev.endMin)}`

      // Ref for live time updates during drag
      let timeLabelRef: any = null

      const cardVisual = (<box name="plan-event" vertical hexpand={true}>
        <label name="plan-event-time" label={timeStr} halign={1} valign={1} $={(self) => {
          timeLabelRef = self
          self.set_ellipsize(3)
        }} />
        <label name="plan-event-text" label={ev.desc} halign={1} valign={1} hexpand={true} $={(self) => {
          self.set_ellipsize(3)
        }} />
      </box>) as Gtk.Widget
      cardVisual.set_size_request(-1, cardH)

      // EventBox — visible_window for own GdkWindow (events + cursor)
      const eb = new Gtk.EventBox({ visible_window: true })
      const rgba = new Gdk.RGBA()
      rgba.red = 0; rgba.green = 0; rgba.blue = 0; rgba.alpha = 0
      eb.override_background_color(Gtk.StateFlags.NORMAL, rgba)
      eb.set_valign(Gtk.Align.START)
      eb.set_halign(Gtk.Align.FILL)
      eb.set_hexpand(true)
      eb.set_margin_top(topY)
      eb.set_size_request(-1, cardH)

      // Column positioning
      if (total > 1) {
        const colW = (cellW - COL_GAP * (total - 1)) / total
        const colStart = 39 + col * (colW + COL_GAP)
        eb.set_margin_start(Math.round(colStart))
        eb.set_margin_end(Math.max(2, Math.round(overlayW - colStart - colW)))
      } else {
        eb.set_margin_start(39)
        eb.set_margin_end(2)
      }

      eb.add(cardVisual)
      eb.add_events(
        Gdk.EventMask.BUTTON_PRESS_MASK |
        Gdk.EventMask.BUTTON_RELEASE_MASK |
        Gdk.EventMask.POINTER_MOTION_MASK |
        Gdk.EventMask.ENTER_NOTIFY_MASK |
        Gdk.EventMask.LEAVE_NOTIFY_MASK
      )

      type DragMode = "none" | "move" | "resize-top" | "resize-bottom"
      let mode: DragMode = "none"
      let pressRootY = 0
      let hasMoved = false

      function zoneAtY(localY: number): "top" | "bottom" | "middle" {
        if (localY <= EDGE && cardH > 24) return "top"
        if (localY >= cardH - EDGE) return "bottom"
        return "middle"
      }

      function updateCursorForZone(zone: string) {
        if (zone === "top" || zone === "bottom") setCursor(eb, "ns-resize")
        else setCursor(eb, "grab")
      }

      // Convert root-Y delta (pixels) to snapped delta minutes
      function rootDeltaToMins(rootY: number): number {
        const h = rowH.get()
        const pixPerMin = h / 60
        return Math.round((rootY - pressRootY) / pixPerMin / 15) * 15
      }

      // Show guide lines + update label from delta minutes
      function updateDragPreview(deltaMins: number) {
        if (mode === "resize-bottom") {
          let newEnd = ev.endMin + deltaMins
          newEnd = Math.max(ev.startMin + 15, Math.min(END_H * 60, newEnd))
          showGuide(0, newEnd)
          guideLines[1]?.hide()
          if (timeLabelRef) timeLabelRef.set_label(`${formatTime(ev.startMin)}-${formatTime(newEnd)}`)
        } else if (mode === "resize-top") {
          let newStart = ev.startMin + deltaMins
          newStart = Math.max(START_H * 60, Math.min(ev.endMin - 15, newStart))
          showGuide(0, newStart)
          guideLines[1]?.hide()
          if (timeLabelRef) timeLabelRef.set_label(`${formatTime(newStart)}-${formatTime(ev.endMin)}`)
        } else if (mode === "move") {
          const dur = ev.endMin - ev.startMin
          let newStart = ev.startMin + deltaMins
          newStart = Math.max(START_H * 60, Math.min(END_H * 60 - dur, newStart))
          showGuide(0, newStart)
          showGuide(1, newStart + dur)
          if (timeLabelRef) timeLabelRef.set_label(`${formatTime(newStart)}-${formatTime(newStart + dur)}`)
        }
      }

      eb.connect("enter-notify-event", (_w: any, enterEv: any) => {
        const [, , localY] = enterEv.get_coords()
        updateCursorForZone(zoneAtY(localY))
        return false
      })

      eb.connect("leave-notify-event", () => {
        if (mode === "none") setCursor(eb, null)
        return false
      })

      eb.connect("button-press-event", (_w: any, cardEv: any) => {
        if (activeEntry) {
          activeEntry.activate()
          return true
        }
        const [, , localY] = cardEv.get_coords()
        const [, , rootY] = cardEv.get_root_coords()
        pressRootY = rootY
        hasMoved = false

        const zone = zoneAtY(localY)
        if (zone === "top") {
          mode = "resize-top"
          setCursor(eb, "ns-resize")
        } else if (zone === "bottom") {
          mode = "resize-bottom"
          setCursor(eb, "ns-resize")
        } else {
          mode = "move"
          setCursor(eb, "grabbing")
        }
        eb.grab_add()
        return true
      })

      eb.connect("motion-notify-event", (_w: any, cardEv: any) => {
        if (mode === "none") {
          const [, , localY] = cardEv.get_coords()
          updateCursorForZone(zoneAtY(localY))
          return false
        }
        const [, , rootY] = cardEv.get_root_coords()
        const deltaMins = rootDeltaToMins(rootY)
        if (deltaMins !== 0) hasMoved = true
        if (hasMoved) updateDragPreview(deltaMins)
        return true
      })

      eb.connect("button-release-event", (_w: any, cardEv: any) => {
        if (mode === "none") return true
        eb.grab_remove()
        hideGuides()
        const currentMode = mode
        mode = "none"
        setCursor(eb, "grab")

        // Restore original time label in case commit doesn't happen
        if (timeLabelRef) timeLabelRef.set_label(timeStr)

        if (!hasMoved) {
          showEntry(ev.startMin, ev.endMin, ev.desc, false, ev)
          return true
        }

        const [, , rootY] = cardEv.get_root_coords()
        const deltaMins = rootDeltaToMins(rootY)
        if (deltaMins === 0) return true

        if (currentMode === "resize-bottom") {
          let newEnd = ev.endMin + deltaMins
          newEnd = Math.max(ev.startMin + 15, Math.min(END_H * 60, newEnd))
          if (newEnd !== ev.endMin) updateExistingEvent(ev, ev.startMin, newEnd, ev.desc)
        } else if (currentMode === "resize-top") {
          let newStart = ev.startMin + deltaMins
          newStart = Math.max(START_H * 60, Math.min(ev.endMin - 15, newStart))
          if (newStart !== ev.startMin) updateExistingEvent(ev, newStart, ev.endMin, ev.desc)
        } else if (currentMode === "move") {
          const dur = ev.endMin - ev.startMin
          let newStart = ev.startMin + deltaMins
          newStart = Math.max(START_H * 60, Math.min(END_H * 60 - dur, newStart))
          if (newStart !== ev.startMin) updateExistingEvent(ev, newStart, newStart + dur, ev.desc)
        }
        return true
      })

      eventOverlays.push(eb)
      gridOverlay.add_overlay(eb)
    }

    gridOverlay.show_all()
  }

  function buildGrid(): Gtk.Widget {
    const grid = (<box vertical name="plan-grid" $={(gridSelf) => {
      let buildVersion = 0
      let isFirstBuild = true

      // Grid-level mouse events for click-to-add and drag-to-create
      gridSelf.add_events(
        Gdk.EventMask.BUTTON_PRESS_MASK |
        Gdk.EventMask.BUTTON_RELEASE_MASK |
        Gdk.EventMask.POINTER_MOTION_MASK
      )
      gridSelf.connect("button-press-event", (_w: any, ev: any) => {
        if (activeEntry) {
          activeEntry.activate()
          dragStartMin = -1
          return true
        }
        const [, , y] = ev.get_coords()
        dragStartMin = yToMin(y)
        isDragging = false
        return false
      })
      gridSelf.connect("motion-notify-event", (_w: any, ev: any) => {
        if (dragStartMin < 0) return false
        const [, , y] = ev.get_coords()
        const curMin = yToMin(y)
        if (Math.abs(curMin - dragStartMin) >= 15) {
          isDragging = true
        }
        return false
      })
      gridSelf.connect("button-release-event", (_w: any, ev: any) => {
        if (dragStartMin < 0) return false
        const [, , y] = ev.get_coords()
        const endMin = yToMin(y)
        if (isDragging) {
          const lo = Math.min(dragStartMin, endMin)
          const hi = Math.max(dragStartMin, endMin)
          showEntry(lo, Math.max(hi, lo + 15), "", true)
        } else {
          showEntry(dragStartMin, dragStartMin + 60, "", true)
        }
        dragStartMin = -1
        isDragging = false
        return false
      })

      function rebuild() {
        buildVersion++
        const thisVersion = buildVersion

        // Save scroll position before destroying children
        let savedScroll = -1
        if (!isFirstBuild && scrollableRef) {
          const vadj = (scrollableRef as any).get_vadjustment()
          if (vadj) savedScroll = vadj.get_value()
        }

        gridSelf.get_children().forEach((c: Gtk.Widget) => c.destroy())

        const today = isToday(currentDate.get())
        const now = new Date()
        const nowHour = now.getHours()
        const nowMin = now.getMinutes()
        const h = rowH.get()
        let scrollTarget: Gtk.Widget | null = null

        for (let hr = START_H; hr <= END_H; hr++) {
          const gridLine = (<box name="plan-gridline" />) as Gtk.Widget
          gridSelf.pack_start(gridLine, false, false, 0)

          // Hour row — no events here, just the time label + empty cell
          const rowContent = (
            <box name="plan-row">
              <label name="plan-hour-label" label={pad2(hr)} />
              <box name="plan-divider" />
              <box name="plan-cell" hexpand={true} />
            </box>
          ) as Gtk.Widget
          rowContent.set_size_request(-1, h)

          const rowOverlay = new Gtk.Overlay()
          rowOverlay.set_size_request(-1, h)
          rowOverlay.add(rowContent)
          const halfLine = (<box name="plan-halfline" hexpand={true} $={(self) => {
            self.set_valign(Gtk.Align.START)
            self.set_margin_top(Math.round(h / 2))
            self.set_margin_start(38)
          }} />) as Gtk.Widget
          rowOverlay.add_overlay(halfLine)
          rowOverlay.show_all()
          const row = rowOverlay as Gtk.Widget

          if (today && hr === nowHour) {
            const nowOverlay = new Gtk.Overlay()
            nowOverlay.set_size_request(-1, h)
            nowOverlay.add(row)
            const nowLine = (<box name="plan-now-line" hexpand={true} $={(self) => {
              self.set_size_request(-1, 2)
              self.set_valign(Gtk.Align.START)
              self.set_margin_top(Math.round((nowMin / 60) * h))
            }} />) as Gtk.Widget
            nowOverlay.add_overlay(nowLine)
            nowOverlay.show_all()
            gridSelf.pack_start(nowOverlay, false, false, 0)
            scrollTarget = nowOverlay as any
          } else {
            gridSelf.pack_start(row, false, false, 0)
          }
        }

        const lastLine = (<box name="plan-gridline" />) as Gtk.Widget
        gridSelf.pack_start(lastLine, false, false, 0)
        gridSelf.show_all()

        // Defer event overlay placement until after allocation
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
          if (buildVersion !== thisVersion) return GLib.SOURCE_REMOVE
          placeEventOverlays()
          return GLib.SOURCE_REMOVE
        })

        // Scroll: first build → scroll to now; subsequent → restore position
        if (isFirstBuild && scrollTarget) {
          const target = scrollTarget
          isFirstBuild = false
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            if (buildVersion !== thisVersion) return GLib.SOURCE_REMOVE
            try {
              const alloc = target.get_allocation()
              if (scrollableRef) {
                const vadj = (scrollableRef as any).get_vadjustment()
                if (vadj) {
                  const viewH = vadj.get_page_size()
                  vadj.set_value(Math.max(0, alloc.y - viewH / 3))
                }
              }
            } catch {}
            return GLib.SOURCE_REMOVE
          })
        } else if (savedScroll >= 0) {
          isFirstBuild = false
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            if (buildVersion !== thisVersion) return GLib.SOURCE_REMOVE
            if (scrollableRef) {
              const vadj = (scrollableRef as any).get_vadjustment()
              if (vadj) vadj.set_value(savedScroll)
            }
            return GLib.SOURCE_REMOVE
          })
        } else {
          isFirstBuild = false
        }
      }

      events.subscribe(rebuild)
      rowH.subscribe(rebuild)
      rebuild()
    }} />) as Gtk.Widget

    return grid
  }

  function handleCreate() { createPlansDir(); reload() }
  function prevDay() {
    const d = new Date(currentDate.get()); d.setDate(d.getDate() - 1)
    setCurrentDate(d); setEvents(parsePlanFile(getDateStr(d)))
  }
  function nextDay() {
    const d = new Date(currentDate.get()); d.setDate(d.getDate() + 1)
    setCurrentDate(d); setEvents(parsePlanFile(getDateStr(d)))
  }

  const innerStack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.CROSSFADE,
    transition_duration: 200,
  })

  const emptyView = (
    <box vertical name="planner-page">
      <box name="planner-header">
        <label name="section-header" label="//PLANNER" />
      </box>
      <box name="planner-panel" vertical>
        <box name="planner-empty" vertical halign={3}>
          <label name="planner-empty-title" label="No .plan directory" />
          <label name="planner-empty-path" label="~/.config/plans/" />
          <label name="planner-empty-hint" label="Create daily plans as" />
          <label name="planner-empty-hint" label="YYYY-MM-DD.plan files" />
          <label name="planner-empty-hint" label="Edit with neovim" />
          <button name="planner-create-btn" onClicked={handleCreate}>
            <label label="CREATE FOLDER" />
          </button>
        </box>
      </box>
    </box>
  ) as Gtk.Widget

  const contentView = (
    <box vertical name="planner-page" vexpand={true}>
      <box name="planner-header">
        <label name="section-header" label="//PLANNER" />
        <box hexpand={true} />
        <button name="planner-reload-btn" onClicked={() => reload()}>
          <label label="RELOAD" />
        </button>
      </box>

      <box name="planner-date-nav" halign={3}>
        <button name="planner-nav-btn" onClicked={prevDay}>
          <label label="<" />
        </button>
        <label name="planner-date" $={(self) => {
          function update() { self.set_label(formatDate(currentDate.get())) }
          currentDate.subscribe(update)
          update()
        }} />
        <button name="planner-nav-btn" onClicked={nextDay}>
          <label label=">" />
        </button>
      </box>

      <scrollable hscroll={1} vscroll={0} vexpand={true} $={(self) => {
        scrollableRef = self
        self.add_events(Gdk.EventMask.SCROLL_MASK)
        self.connect("scroll-event", (_w: any, ev: any) => {
          const [, , state] = ev.get_state()
          if (!(state & Gdk.ModifierType.CONTROL_MASK)) return false
          const dir = ev.get_scroll_direction()[1]
          const cur = rowH.get()
          if (dir === Gdk.ScrollDirection.UP) {
            setRowH(Math.min(MAX_ROW_H, cur + 8))
          } else if (dir === Gdk.ScrollDirection.DOWN) {
            setRowH(Math.max(MIN_ROW_H, cur - 8))
          }
          return true
        })

        const overlay = new Gtk.Overlay()
        gridOverlay = overlay
        let lastAllocW = 0
        overlay.connect("size-allocate", (_w: any, alloc: any) => {
          const newW = alloc.width
          if (newW > 50 && newW !== lastAllocW) {
            lastAllocW = newW
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
              placeEventOverlays()
              return GLib.SOURCE_REMOVE
            })
          }
        })
        const grid = buildGrid()
        overlay.add(grid)
        self.add(overlay)
        overlay.show_all()
      }} />

      <label name="planner-footer" $={(self) => {
        function update() { self.set_label(`${fileList.get().length} plans`) }
        fileList.subscribe(update)
        update()
      }} />
    </box>
  ) as Gtk.Widget

  innerStack.add_named(emptyView, "empty")
  innerStack.add_named(contentView, "content")
  innerStack.show_all()

  function syncView() {
    innerStack.set_visible_child_name(plansExist.get() ? "content" : "empty")
  }
  plansExist.subscribe(syncView)
  syncView()
  reload()

  return innerStack
}

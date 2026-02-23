import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"
import { Astal } from "ags/gtk3"
import app from "ags/gtk3/app"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import { createState } from "ags"
import { setTaskPopupVisible, setTaskPopupTitle } from "../state"

const PLANS_DIR = GLib.get_home_dir() + "/.config/plans"
const BOARDS_DIR = PLANS_DIR + "/boards"
const DEFAULT_BOARD = "main"

interface KanbanTask {
  id: string
  title: string
  description: string
  status: "todo" | "doing" | "done"
  assignment: string
  order: number
  createdAt: string
}

interface ChecklistItem {
  checked: boolean
  text: string
}

function parseChecklist(description: string): ChecklistItem[] {
  if (!description) return []
  const items: ChecklistItem[] = []
  for (const line of description.split("\n")) {
    const m = line.match(/^- \[([ xX])\] (.*)$/)
    if (m) items.push({ checked: m[1] !== " ", text: m[2] })
  }
  return items
}

function serializeChecklist(items: ChecklistItem[]): string {
  return items.map(i => `- [${i.checked ? "x" : " "}] ${i.text}`).join("\n")
}

function parseDescription(description: string): { notes: string, checklist: ChecklistItem[] } {
  if (!description) return { notes: "", checklist: [] }
  const lines = description.split("\n")
  const noteLines: string[] = []
  const checklist: ChecklistItem[] = []
  for (const line of lines) {
    const m = line.match(/^- \[([ xX])\] (.*)$/)
    if (m) checklist.push({ checked: m[1] !== " ", text: m[2] })
    else noteLines.push(line)
  }
  while (noteLines.length > 0 && noteLines[noteLines.length - 1].trim() === "") noteLines.pop()
  return { notes: noteLines.join("\n"), checklist }
}

function serializeDescription(notes: string, checklist: ChecklistItem[]): string {
  const parts: string[] = []
  if (notes.trim()) parts.push(notes.trim())
  if (checklist.length > 0) parts.push(serializeChecklist(checklist))
  return parts.join("\n\n")
}

function gtkRGBA(r: number, g: number, b: number, a: number = 1) {
  const c = new Gdk.RGBA()
  c.red = r; c.green = g; c.blue = b; c.alpha = a
  return c
}

const CD_BG = gtkRGBA(0x0d / 255, 0x11 / 255, 0x17 / 255)
const CD_WHITE = gtkRGBA(0xe6 / 255, 0xed / 255, 0xf3 / 255)
const CD_DIM = gtkRGBA(0x8b / 255, 0x94 / 255, 0x9e / 255)
const CD_DIMMER = gtkRGBA(0x48 / 255, 0x4f / 255, 0x58 / 255)

function forceColor(w: Gtk.Widget, fg?: any, bg?: any) {
  if (fg) w.override_color(Gtk.StateFlags.NORMAL, fg)
  if (bg) w.override_background_color(Gtk.StateFlags.NORMAL, bg)
}

function generateId(): string {
  const hex = "0123456789abcdef"
  let id = ""
  for (let i = 0; i < 6; i++) id += hex[Math.floor(Math.random() * 16)]
  return id
}

function boardFilePath(name: string): string {
  return `${PLANS_DIR}/${name}_kanban.plan`
}

function listBoards(): string[] {
  if (!dirExists(PLANS_DIR)) return []
  try {
    const dir = GLib.Dir.open(PLANS_DIR, 0)
    const names: string[] = []
    let name: string | null
    while ((name = dir.read_name()) !== null) {
      if (name.endsWith("_kanban.plan")) names.push(name.replace(/_kanban\.plan$/, ""))
    }
    names.sort()
    return names
  } catch (e) {
    print(`Error reading plans dir: ${e}`)
    return []
  }
}

function deleteBoard(name: string) {
  GLib.unlink(boardFilePath(name))
}

function parseKanbanPlan(content: string): KanbanTask[] {
  const tasks: KanbanTask[] = []
  let currentStatus: "todo" | "doing" | "done" | null = null
  let currentTask: Partial<KanbanTask> | null = null
  let descLines: string[] = []
  let orderCounter = 0
  let idCounter = 0

  function finishTask() {
    if (currentTask && currentTask.title) {
      while (descLines.length > 0 && descLines[0].trim() === "") descLines.shift()
      while (descLines.length > 0 && descLines[descLines.length - 1].trim() === "") descLines.pop()
      currentTask.description = descLines.join("\n")
      tasks.push(currentTask as KanbanTask)
    }
    currentTask = null
    descLines = []
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (/^##\s+TODO\s*$/i.test(trimmed)) { finishTask(); currentStatus = "todo"; orderCounter = 0; continue }
    if (/^##\s+DOING\s*$/i.test(trimmed)) { finishTask(); currentStatus = "doing"; orderCounter = 0; continue }
    if (/^##\s+DONE\s*$/i.test(trimmed)) { finishTask(); currentStatus = "done"; orderCounter = 0; continue }

    if (trimmed.startsWith("### ") && currentStatus) {
      finishTask()
      currentTask = {
        id: `p${idCounter++}`,
        title: trimmed.slice(4).trim(),
        description: "",
        status: currentStatus,
        assignment: "",
        order: orderCounter++,
        createdAt: new Date().toISOString(),
      }
      continue
    }

    if (currentTask) {
      if (/^@\S+/.test(trimmed)) {
        currentTask.assignment = trimmed.slice(1).trim()
        continue
      }
      descLines.push(line.trimEnd())
    }
  }
  finishTask()
  return tasks
}

function serializeKanbanPlan(tasks: KanbanTask[]): string {
  const lines: string[] = []
  for (const status of ["todo", "doing", "done"] as const) {
    lines.push(`## ${status.toUpperCase()}`)
    lines.push("")
    const statusTasks = tasks.filter(t => t.status === status).sort((a, b) => a.order - b.order)
    for (const task of statusTasks) {
      lines.push(`### ${task.title}`)
      if (task.description.trim()) lines.push(task.description.trim())
      if (task.assignment) lines.push(`@${task.assignment}`)
      lines.push("")
    }
  }
  return lines.join("\n")
}

function loadKanban(boardName: string): KanbanTask[] {
  const path = boardFilePath(boardName)
  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return []
  try {
    const content = readFile(path)
    if (!content) return []
    return parseKanbanPlan(content)
  } catch (e) {
    print(`Error loading kanban: ${e}`)
    return []
  }
}

function saveKanban(boardName: string, tasks: KanbanTask[]) {
  GLib.mkdir_with_parents(PLANS_DIR, 0o755)
  writeFile(boardFilePath(boardName), serializeKanbanPlan(tasks))
}

function migrateKanbanIfNeeded() {
  // Migrate from old single kanban.json
  const oldFile = `${PLANS_DIR}/kanban.json`
  if (GLib.file_test(oldFile, GLib.FileTest.EXISTS)) {
    const newPath = boardFilePath(DEFAULT_BOARD)
    if (!GLib.file_test(newPath, GLib.FileTest.EXISTS)) {
      try {
        const content = readFile(oldFile)
        if (content) {
          const data = JSON.parse(content)
          saveKanban(DEFAULT_BOARD, data.tasks || [])
          print(`Migrated kanban.json to ${DEFAULT_BOARD}_kanban.plan`)
        }
      } catch (e) { print(`Error migrating kanban.json: ${e}`) }
    }
  }
  // Migrate from old boards/*.json format
  if (!dirExists(BOARDS_DIR)) return
  try {
    const dir = GLib.Dir.open(BOARDS_DIR, 0)
    let name: string | null
    while ((name = dir.read_name()) !== null) {
      if (!name.endsWith(".json")) continue
      const boardName = name.replace(/\.json$/, "")
      const newPath = boardFilePath(boardName)
      if (GLib.file_test(newPath, GLib.FileTest.EXISTS)) continue
      try {
        const content = readFile(`${BOARDS_DIR}/${name}`)
        if (!content) continue
        const data = JSON.parse(content)
        saveKanban(boardName, data.tasks || [])
        print(`Migrated board: ${boardName}`)
      } catch (e) { print(`Error migrating board ${boardName}: ${e}`) }
    }
  } catch (e) { print(`Error reading old boards dir: ${e}`) }
}

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
  recurring?: boolean
  fromSchedule?: boolean
}

function parseEventLine(text: string): PlanEvent | null {
  const rangeMatch = text.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/)
  if (rangeMatch) {
    const [h1, m1] = rangeMatch[1].split(":").map(Number)
    const [h2, m2] = rangeMatch[2].split(":").map(Number)
    return { startMin: h1 * 60 + m1, endMin: h2 * 60 + m2, desc: rangeMatch[3] }
  }
  const singleMatch = text.match(/^(\d{1,2}:\d{2})\s+(.+)$/)
  if (singleMatch) {
    const [h, m] = singleMatch[1].split(":").map(Number)
    const sm = h * 60 + m
    return { startMin: sm, endMin: sm + 15, desc: singleMatch[2] }
  }
  return null
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
      const ev = parseEventLine(trimmed)
      if (ev) events.push(ev)
    }
    return events
  } catch { return [] }
}

interface ScheduleSection {
  selector: string
  events: PlanEvent[]
  additions: PlanEvent[]
  removals: PlanEvent[]
}

const SCHEDULE_FILE = `${PLANS_DIR}/schedule.plan`

function parseScheduleFile(): ScheduleSection[] {
  if (!GLib.file_test(SCHEDULE_FILE, GLib.FileTest.EXISTS)) return []
  try {
    const content = readFile(SCHEDULE_FILE)
    if (!content) return []
    const sections: ScheduleSection[] = []
    let current: ScheduleSection | null = null
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed === "" || trimmed.startsWith("#")) continue
      const selectorMatch = trimmed.match(/^@(.+)$/)
      if (selectorMatch) {
        current = { selector: selectorMatch[1].trim(), events: [], additions: [], removals: [] }
        sections.push(current)
        continue
      }
      if (!current) continue
      if (trimmed.startsWith("-")) {
        const ev = parseEventLine(trimmed.slice(1).trim())
        if (ev) current.removals.push(ev)
      } else {
        const raw = trimmed.startsWith("+") ? trimmed.slice(1).trim() : trimmed
        const ev = parseEventLine(raw)
        if (ev) {
          const isDateSection = /^\d{4}-\d{2}-\d{2}$/.test(current.selector)
          if (isDateSection) {
            current.additions.push(ev)
          } else {
            ev.recurring = true
            current.events.push(ev)
          }
        }
      }
    }
    return sections
  } catch { return [] }
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

function matchesDate(selector: string, date: Date): boolean {
  const sel = selector.toLowerCase().trim()
  if (sel === "daily") return true

  // Exact date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(sel)) {
    return sel === getDateStr(date)
  }

  const dow = date.getDay() // 0=sun..6=sat

  // Range: mon-fri
  const rangeMatch = sel.match(/^([a-z]{3})-([a-z]{3})$/)
  if (rangeMatch) {
    const start = DAY_NAMES.indexOf(rangeMatch[1])
    const end = DAY_NAMES.indexOf(rangeMatch[2])
    if (start < 0 || end < 0) return false
    if (start <= end) return dow >= start && dow <= end
    // Wraps: fri-mon means fri,sat,sun,mon
    return dow >= start || dow <= end
  }

  // List: mon,wed,fri
  if (sel.includes(",")) {
    const days = sel.split(",").map(s => DAY_NAMES.indexOf(s.trim()))
    return days.includes(dow)
  }

  // Single day name
  const single = DAY_NAMES.indexOf(sel)
  if (single >= 0) return dow === single

  return false
}

function eventMatchesRemoval(ev: PlanEvent, removal: PlanEvent): boolean {
  if (ev.startMin !== removal.startMin) return false
  if (ev.desc.toLowerCase() !== removal.desc.toLowerCase()) return false
  // If removal specifies a range, also match endMin
  if (removal.endMin - removal.startMin > 15 && ev.endMin !== removal.endMin) return false
  return true
}

function getScheduleEventsForDate(sections: ScheduleSection[], dateStr: string, date: Date): PlanEvent[] {
  // Phase 1: collect recurring events from non-date selectors
  let events: PlanEvent[] = []
  for (const sec of sections) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(sec.selector)) continue
    if (matchesDate(sec.selector, date)) {
      events.push(...sec.events.map(e => ({ ...e, recurring: true, fromSchedule: true })))
    }
  }

  // Phase 2: apply date-specific variations
  for (const sec of sections) {
    if (sec.selector !== dateStr) continue
    // Remove cancelled events (explicit -)
    events = events.filter(ev => !sec.removals.some(r => eventMatchesRemoval(ev, r)))
    // Additions auto-replace recurring events at the same time slot
    for (const add of sec.additions) {
      events = events.filter(ev => !ev.recurring || ev.startMin !== add.startMin)
    }
    // Date additions are editable overrides — NOT fromSchedule
    events.push(...sec.additions)
  }

  return events
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

const PLAN_HEADER = [
  "# ── .plan format ──────────────────────",
  "#",
  "# Daily:   ~/.config/plans/YYYY-MM-DD.plan",
  "# Weekly:  ~/.config/plans/schedule.plan",
  "#",
  "# EVENTS",
  "#   HH:MM-HH:MM  Description    (time range)",
  "#   HH:MM  Description           (15-min slot)",
  "#",
  "# SCHEDULE.PLAN",
  "#   @daily              every day",
  "#   @mon @tue ...        weekday",
  "#   @YYYY-MM-DD          specific date override",
  "#   Events auto-replace recurring at same time.",
  "#   -HH:MM-HH:MM  Desc  explicit removal",
  "#",
  "# Lines starting with # are comments.",
  "# Daily .plan events override schedule.",
  "#",
].join("\n")

function generateTemplate(): string {
  return PLAN_HEADER + "\n"
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

  // Kanban state
  const [kanbanTasks, setKanbanTasks] = createState<KanbanTask[]>([])
  const [activeInnerTab, setActiveInnerTab] = createState<"calendar" | "board">("calendar")
  const [activeSubpane, setActiveSubpane] = createState<"todo" | "doing" | "done">("todo")
  const [activeBoard, setActiveBoard] = createState(DEFAULT_BOARD)
  const [boardList, setBoardList] = createState<string[]>([])

  // Track our own writes to avoid re-triggering file watcher
  let selfWriteTimestamp = 0
  function trackedSave(board: string, tasks: KanbanTask[]) {
    selfWriteTimestamp = Date.now()
    saveKanban(board, tasks)
  }

  function addTask(title: string, status: "todo" | "doing" | "done") {
    const tasks = kanbanTasks.get()
    const sameStatus = tasks.filter(t => t.status === status)
    const maxOrder = sameStatus.length > 0 ? Math.max(...sameStatus.map(t => t.order)) + 1 : 0
    const task: KanbanTask = {
      id: generateId(),
      title,
      description: "",
      status,
      assignment: "",
      order: maxOrder,
      createdAt: new Date().toISOString(),
    }
    const updated = [...tasks, task]
    trackedSave(activeBoard.get(), updated)
    setKanbanTasks(updated)
  }

  function updateTask(id: string, changes: Partial<KanbanTask>) {
    const tasks = kanbanTasks.get().map(t => t.id === id ? { ...t, ...changes } : t)
    trackedSave(activeBoard.get(), tasks)
    setKanbanTasks(tasks)
  }

  function deleteTask(id: string) {
    const tasks = kanbanTasks.get().filter(t => t.id !== id)
    trackedSave(activeBoard.get(), tasks)
    setKanbanTasks(tasks)
  }

  function moveTaskForward(id: string) {
    const task = kanbanTasks.get().find(t => t.id === id)
    if (!task) return
    const next = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : null
    if (!next) return
    const tasks = kanbanTasks.get()
    const sameStatus = tasks.filter(t => t.status === next)
    const maxOrder = sameStatus.length > 0 ? Math.max(...sameStatus.map(t => t.order)) + 1 : 0
    updateTask(id, { status: next as any, order: maxOrder })
  }

  function moveTaskBack(id: string) {
    const task = kanbanTasks.get().find(t => t.id === id)
    if (!task) return
    const prev = task.status === "done" ? "doing" : task.status === "doing" ? "todo" : null
    if (!prev) return
    const tasks = kanbanTasks.get()
    const sameStatus = tasks.filter(t => t.status === prev)
    const maxOrder = sameStatus.length > 0 ? Math.max(...sameStatus.map(t => t.order)) + 1 : 0
    updateTask(id, { status: prev as any, order: maxOrder })
  }

  function switchBoard(name: string) {
    setActiveBoard(name)
    setKanbanTasks(loadKanban(name))
  }

  function createBoard(name: string) {
    const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase()
    if (!sanitized) return
    GLib.mkdir_with_parents(PLANS_DIR, 0o755)
    trackedSave(sanitized, [])
    setBoardList(listBoards())
    switchBoard(sanitized)
  }

  const SUBPANES = ["todo", "doing", "done"] as const
  function nextSubpane() {
    const cur = SUBPANES.indexOf(activeSubpane.get())
    setActiveSubpane(SUBPANES[(cur + 1) % SUBPANES.length])
  }
  function prevSubpane() {
    const cur = SUBPANES.indexOf(activeSubpane.get())
    setActiveSubpane(SUBPANES[(cur - 1 + SUBPANES.length) % SUBPANES.length])
  }

  function removeBoardAndSwitch(name: string) {
    selfWriteTimestamp = Date.now()
    deleteBoard(name)
    const remaining = listBoards()
    if (remaining.length === 0) {
      trackedSave(DEFAULT_BOARD, [])
      setBoardList([DEFAULT_BOARD])
      switchBoard(DEFAULT_BOARD)
    } else {
      setBoardList(remaining)
      switchBoard(remaining[0])
    }
  }

  // Interaction state
  let dragStartMin = -1
  let isDragging = false
  let activeEntry: Gtk.Entry | null = null
  let gridOverlay: Gtk.Overlay | null = null
  let scrollableRef: Gtk.Widget | null = null
  let eventOverlays: Gtk.Widget[] = []
  let nowLineWidget: Gtk.Widget | null = null

  function loadEventsForDate(date: Date): PlanEvent[] {
    const dateStr = getDateStr(date)
    const sections = parseScheduleFile()
    const scheduleEvents = getScheduleEventsForDate(sections, dateStr, date)
    const dateEvents = parsePlanFile(dateStr)
    return [...scheduleEvents, ...dateEvents]
  }

  function reload() {
    const exists = dirExists(PLANS_DIR)
    setPlansExist(exists)
    if (exists) {
      migrateKanbanIfNeeded()
      setFileList(loadPlanFiles())
      setEvents(loadEventsForDate(currentDate.get()))
      const boards = listBoards()
      if (boards.length === 0) {
        trackedSave(DEFAULT_BOARD, [])
        setBoardList([DEFAULT_BOARD])
        setActiveBoard(DEFAULT_BOARD)
      } else {
        setBoardList(boards)
        if (!boards.includes(activeBoard.get())) {
          setActiveBoard(boards[0])
        }
      }
      setKanbanTasks(loadKanban(activeBoard.get()))
    } else {
      setEvents([])
      setKanbanTasks([])
      setBoardList([])
    }
  }

  // ── File watching: auto-reload when .plan files edited externally ──
  let fileMonitor: any = null
  let monitorDebounce = 0

  function setupFileWatcher() {
    if (fileMonitor) { try { fileMonitor.cancel() } catch {} }
    if (!dirExists(PLANS_DIR)) return

    try {
      const dir = Gio.File.new_for_path(PLANS_DIR)
      fileMonitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null)
      fileMonitor.set_rate_limit(500)
      fileMonitor.connect("changed", (_m: any, file: any, _o: any, eventType: any) => {
        const name = file.get_basename()
        if (!name || !name.endsWith("_kanban.plan")) return
        // Ignore our own writes (within 2s)
        if (Date.now() - selfWriteTimestamp < 2000) return
        // Debounce rapid changes
        if (monitorDebounce) GLib.source_remove(monitorDebounce)
        monitorDebounce = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
          monitorDebounce = 0
          const boardName = name.replace(/_kanban\.plan$/, "")
          if (boardName === activeBoard.get()) {
            setKanbanTasks(loadKanban(boardName))
          }
          // Also refresh board list in case new boards were added/removed
          setBoardList(listBoards())
          return GLib.SOURCE_REMOVE
        })
      })
    } catch (e) {
      print(`File watcher setup failed: ${e}`)
    }
  }

  // ── Task-switch popup: detect when the current calendar event changes ──
  let lastActiveTaskDesc = ""

  function getCurrentTaskDesc(): string {
    if (!isToday(currentDate.get())) return ""
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const evList = events.get()
    // Find the event whose time range contains "now"
    for (const ev of evList) {
      if (nowMin >= ev.startMin && nowMin < ev.endMin) return ev.desc
    }
    return ""
  }

  function checkTaskSwitch() {
    const desc = getCurrentTaskDesc()
    if (desc && desc !== lastActiveTaskDesc) {
      lastActiveTaskDesc = desc
      setTaskPopupTitle(desc)
      setTaskPopupVisible(true)
    } else if (!desc) {
      lastActiveTaskDesc = ""
    }
  }

  // Suppress popup during startup — wait for events to settle
  let startupDone = false
  lastActiveTaskDesc = getCurrentTaskDesc()

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
    lastActiveTaskDesc = getCurrentTaskDesc()
    startupDone = true
    return GLib.SOURCE_REMOVE
  })

  // Check every 30 seconds
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => {
    checkTaskSwitch()
    return GLib.SOURCE_CONTINUE
  })

  // Also re-check when events change (e.g. file edit)
  events.subscribe(() => { if (startupDone) checkTaskSwitch() })

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

  function formatEventLine(startMin: number, endMin: number, desc: string): string {
    if (endMin - startMin <= 15) return `${formatTime(startMin)}  ${desc}`
    return `${formatTime(startMin)}-${formatTime(endMin)}  ${desc}`
  }

  function findScheduleDateSection(lines: string[], dateStr: string): { start: number, end: number } | null {
    const header = `@${dateStr}`
    let start = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === header) { start = i; break }
    }
    if (start < 0) return null
    let end = start + 1
    while (end < lines.length) {
      if (lines[end].trim().startsWith("@")) break
      end++
    }
    return { start, end }
  }

  function addNewEvent(startMin: number, endMin: number, desc: string) {
    const dateStr = getDateStr(currentDate.get())
    if (!GLib.file_test(SCHEDULE_FILE, GLib.FileTest.EXISTS)) return
    const content = readFile(SCHEDULE_FILE) || ""
    const lines = content.split("\n")
    const newLine = formatEventLine(startMin, endMin, desc)

    const section = findScheduleDateSection(lines, dateStr)
    if (section) {
      lines.splice(section.end, 0, newLine)
    } else {
      // Insert new @date section in chronological order among existing date sections
      const datePattern = /^@(\d{4}-\d{2}-\d{2})$/
      let insertBefore = -1
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].trim().match(datePattern)
        if (m && m[1] > dateStr) { insertBefore = i; break }
      }
      if (insertBefore >= 0) {
        lines.splice(insertBefore, 0, `@${dateStr}`, newLine, "")
      } else {
        while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop()
        lines.push("", `@${dateStr}`, newLine)
      }
    }
    writeFile(SCHEDULE_FILE, lines.join("\n") + "\n")
    reload()
  }

  function updateExistingEvent(oldEv: PlanEvent, newStartMin: number, newEndMin: number, newDesc: string) {
    const dateStr = getDateStr(currentDate.get())
    if (!GLib.file_test(SCHEDULE_FILE, GLib.FileTest.EXISTS)) return
    const content = readFile(SCHEDULE_FILE) || ""
    const lines = content.split("\n")
    const newLine = formatEventLine(newStartMin, newEndMin, newDesc)

    const section = findScheduleDateSection(lines, dateStr)
    if (!section) return
    for (let i = section.start + 1; i < section.end; i++) {
      const trimmed = lines[i].trim()
      if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("-")) continue
      const raw = trimmed.startsWith("+") ? trimmed.slice(1).trim() : trimmed
      const parsed = parseEventLine(raw)
      if (parsed && parsed.startMin === oldEv.startMin && parsed.endMin === oldEv.endMin && parsed.desc === oldEv.desc) {
        lines[i] = newLine
        break
      }
    }
    writeFile(SCHEDULE_FILE, lines.join("\n"))
    reload()
  }

  function deleteEvent(ev: PlanEvent) {
    const dateStr = getDateStr(currentDate.get())
    if (!GLib.file_test(SCHEDULE_FILE, GLib.FileTest.EXISTS)) return
    const content = readFile(SCHEDULE_FILE) || ""
    const lines = content.split("\n")

    const section = findScheduleDateSection(lines, dateStr)
    if (!section) return
    for (let i = section.start + 1; i < section.end; i++) {
      const trimmed = lines[i].trim()
      if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("-")) continue
      const raw = trimmed.startsWith("+") ? trimmed.slice(1).trim() : trimmed
      const parsed = parseEventLine(raw)
      if (parsed && parsed.startMin === ev.startMin && parsed.endMin === ev.endMin && parsed.desc === ev.desc) {
        lines.splice(i, 1)
        break
      }
    }
    writeFile(SCHEDULE_FILE, lines.join("\n"))
    reload()
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
      let text = ""
      try { text = entry.get_text().trim() } catch { hideEntry(); return }
      if (!text) {
        // Empty text: delete event if editing existing daily event
        if (!isNew && existingEv && !existingEv.fromSchedule) {
          deleteEvent(existingEv)
        } else {
          hideEntry()
        }
        return
      }

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
        if (finalStart === existingEv.startMin && finalEnd === existingEv.endMin && finalDesc === existingEv.desc) {
          hideEntry()
          return
        }
        updateExistingEvent(existingEv, finalStart, finalEnd, finalDesc)
      }
    }

    let focusReady = false
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      focusReady = true
      return GLib.SOURCE_REMOVE
    })

    entry.connect("activate", () => commit())
    entry.connect("focus-out-event", () => {
      if (committed || !focusReady) return false
      committed = true
      hideEntry()
      return false
    })
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
      const topY = Math.round(minToY(ev.startMin)) + 2
      const botY = Math.round(minToY(ev.endMin)) - 2
      const cardH = Math.max(18, botY - topY)
      const duration = ev.endMin - ev.startMin

      const timeStr = duration <= 15
        ? formatTime(ev.startMin)
        : `${formatTime(ev.startMin)}-${formatTime(ev.endMin)}`

      // Ref for live time updates during drag
      let timeLabelRef: any = null

      // Build popover with imperative widgets (avoids JSX tracking context errors)
      function buildEventPopover(relativeTo: Gtk.Widget): Gtk.Popover {
        const popover = new Gtk.Popover({ relative_to: relativeTo, position: Gtk.PositionType.BOTTOM })
        popover.set_name("planner-popover")
        const menu = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
        menu.set_name("planner-popover-menu")

        const editBtn = new Gtk.Button()
        editBtn.set_name("planner-popover-item")
        const editLabel = new Gtk.Label({ label: "Edit" })
        editLabel.set_halign(Gtk.Align.START)
        editBtn.add(editLabel)
        editBtn.connect("clicked", () => {
          popover.popdown()
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            showEntry(ev.startMin, ev.endMin, ev.desc, false, ev)
            return GLib.SOURCE_REMOVE
          })
        })
        menu.pack_start(editBtn, false, false, 0)

        const delBtn = new Gtk.Button()
        delBtn.set_name("planner-popover-item-danger")
        const delLabel = new Gtk.Label({ label: "Delete" })
        delLabel.set_halign(Gtk.Align.START)
        delBtn.add(delLabel)
        delBtn.connect("clicked", () => { popover.popdown(); deleteEvent(ev) })
        menu.pack_start(delBtn, false, false, 0)

        popover.add(menu)
        menu.show_all()
        return popover
      }

      const cardVisual = (<box name="plan-event" vertical hexpand={true}>
        <box>
          <label name="plan-event-time" label={timeStr} halign={1} valign={1} $={(self) => {
            timeLabelRef = self
          }} />
          <box hexpand={true} />
          {!ev.fromSchedule ? (
            <button name="planner-dots-btn" $={(self) => {
              const popover = buildEventPopover(self)
              self.connect("clicked", () => popover.popup())
            }}>
              <label label="..." />
            </button>
          ) : <box />}
        </box>
        <label name="plan-event-text" label={ev.desc} halign={1} valign={1} hexpand={true} $={(self) => {
          self.set_ellipsize(3)
        }} />
      </box>) as Gtk.Widget
      cardVisual.set_size_request(-1, cardH)
      cardVisual.set_hexpand(true)
      if (ev.fromSchedule) cardVisual.get_style_context().add_class("schedule")

      // Clip container — prevents GTK from expanding card beyond cardH
      const clipScroll = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.NEVER,
      })
      clipScroll.set_size_request(-1, cardH)
      clipScroll.add(cardVisual)

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

      eb.add(clipScroll)
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
        // Schedule events are read-only
        if (ev.fromSchedule) return true

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

  function placeNowLine() {
    if (!gridOverlay) return
    if (nowLineWidget) {
      gridOverlay.remove(nowLineWidget)
      nowLineWidget.destroy()
      nowLineWidget = null
    }
    if (!isToday(currentDate.get())) return
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const y = Math.round(minToY(nowMin))
    const line = (<box name="plan-now-line" hexpand={true} $={(self) => {
      self.set_size_request(-1, 2)
      self.set_valign(Gtk.Align.START)
      self.set_margin_top(y)
    }} />) as Gtk.Widget
    nowLineWidget = line
    gridOverlay.add_overlay(line)
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

          gridSelf.pack_start(row, false, false, 0)
          if (today && hr === nowHour) {
            scrollTarget = row
          }
        }

        const lastLine = (<box name="plan-gridline" />) as Gtk.Widget
        gridSelf.pack_start(lastLine, false, false, 0)
        gridSelf.show_all()

        // Defer event overlay placement until after allocation
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
          if (buildVersion !== thisVersion) return GLib.SOURCE_REMOVE
          placeEventOverlays()
          placeNowLine()
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

      // Update now-line every 60 seconds
      const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60000, () => {
        placeNowLine()
        return GLib.SOURCE_CONTINUE
      })
      gridSelf.connect("destroy", () => GLib.source_remove(timerId))
    }} />) as Gtk.Widget

    return grid
  }

  function handleCreate() { createPlansDir(); reload() }
  function prevDay() {
    const d = new Date(currentDate.get()); d.setDate(d.getDate() - 1)
    setCurrentDate(d); setEvents(loadEventsForDate(d))
  }
  function nextDay() {
    const d = new Date(currentDate.get()); d.setDate(d.getDate() + 1)
    setCurrentDate(d); setEvents(loadEventsForDate(d))
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

  // ── Build card for a kanban task ──
  function buildCard(task: KanbanTask, container: Gtk.Box) {
    const card = (<box name="kanban-card" vertical>
      <box>
        <label name="kanban-card-title" halign={1} $={(self) => {
          self.set_label(task.title)
          self.set_ellipsize(3)
          self.set_max_width_chars(20)
        }} />
        <box hexpand={true} />
        <button name="planner-dots-btn" $={(self) => {
          const popover = new Gtk.Popover({ relative_to: self, position: Gtk.PositionType.BOTTOM })
          popover.set_name("planner-popover")
          const menu = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
          menu.set_name("planner-popover-menu")

          function addItem(label: string, name: string, cb: () => void) {
            const btn = new Gtk.Button()
            btn.set_name(name)
            const lbl = new Gtk.Label({ label })
            lbl.set_halign(Gtk.Align.START)
            btn.add(lbl)
            btn.connect("clicked", () => { popover.popdown(); cb() })
            menu.pack_start(btn, false, false, 0)
          }

          if (task.status !== "todo")
            addItem(`Move to ${task.status === "done" ? "DOING" : "TODO"}`, "planner-popover-item", () => moveTaskBack(task.id))
          if (task.status !== "done")
            addItem(`Move to ${task.status === "todo" ? "DOING" : "DONE"}`, "planner-popover-item", () => moveTaskForward(task.id))
          addItem("Delete", "planner-popover-item-danger", () => deleteTask(task.id))

          popover.add(menu)
          menu.show_all()
          self.connect("clicked", () => popover.popup())
        }}>
          <label label="..." />
        </button>
      </box>
      {(() => {
        const items = parseChecklist(task.description)
        if (items.length === 0) return <box />
        return <box vertical name="kanban-card-checklist-box">
          {items.map(item => (
            <box name="kanban-card-check-row">
              <label name="kanban-card-check-icon" halign={1}
                label={item.checked ? "[x]" : "[ ]"} />
              <label name="kanban-card-check-label" halign={1} $={(self) => {
                self.set_label(item.text)
                self.set_ellipsize(3)
                self.set_max_width_chars(18)
                if (item.checked) self.get_style_context().add_class("checked")
              }} />
            </box>
          ))}
        </box>
      })()}
      {task.assignment ? (
        <label name="kanban-card-badge" halign={1} label={task.assignment} />
      ) : <box />}
    </box>) as Gtk.Widget

    if (task.status === "done") card.get_style_context().add_class("done")

    // Click card to open detail modal
    const eb = new Gtk.EventBox()
    eb.add(card)
    eb.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
    eb.connect("button-press-event", (_w: any, ev: any) => {
      const [, button] = ev.get_button()
      if (button === 1) { openCardDetail(task.id); return true }
      return false
    })
    container.pack_start(eb, false, false, 0)
  }

  // ── Build the card list for a status column ──
  function buildCardList(status: "todo" | "doing" | "done", container: Gtk.Box) {
    container.get_children().forEach((c: Gtk.Widget) => c.destroy())
    const tasks = kanbanTasks.get()
      .filter(t => t.status === status)
      .sort((a, b) => a.order - b.order)
    for (const task of tasks) buildCard(task, container)

    // "+ Add item" button
    let addEntryActive = false
    const addBtn = (<button name="kanban-add-btn" onClicked={() => {
      if (addEntryActive) return
      addEntryActive = true
      addBtn.hide()
      addEntry.show()
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
        addEntry.grab_focus()
        return GLib.SOURCE_REMOVE
      })
    }}>
      <label label="+ Add item" />
    </button>) as Gtk.Widget

    const addEntry = new Gtk.Entry()
    addEntry.set_name("kanban-add-entry")
    addEntry.set_placeholder_text("Task title...")
    addEntry.set_hexpand(true)
    addEntry.set_no_show_all(true)
    addEntry.hide()

    let committed = false
    function commitAdd() {
      if (committed) return
      committed = true
      let text = ""
      try { text = addEntry.get_text().trim() } catch {}
      addEntry.hide()
      addBtn.show()
      addEntryActive = false
      if (text) addTask(text, status)
      committed = false
    }
    addEntry.connect("activate", () => commitAdd())
    addEntry.connect("focus-out-event", () => {
      if (!committed) { committed = true; addEntry.hide(); addBtn.show(); addEntryActive = false; committed = false }
      return false
    })
    addEntry.connect("key-press-event", (_w: any, ev: any) => {
      if (ev.get_keyval()[1] === Gdk.KEY_Escape) {
        committed = true; addEntry.hide(); addBtn.show(); addEntryActive = false; committed = false
        return true
      }
      return false
    })

    container.pack_start(addBtn, false, false, 0)
    container.pack_start(addEntry as Gtk.Widget, false, false, 0)
    container.show_all()
    addEntry.hide()
  }

  // ── Card detail modal ──
  const [cardDetailVisible, setCardDetailVisible] = createState(false)
  const [cardDetailTaskId, setCardDetailTaskId] = createState("")

  function openCardDetail(id: string) {
    setCardDetailTaskId(id)
    setCardDetailVisible(true)
  }

  function closeCardDetail() {
    setCardDetailVisible(false)
  }

  // ── Board modal (new / delete) ──
  const [boardModalVisible, setBoardModalVisible] = createState(false)
  const [boardModalMode, setBoardModalMode] = createState<"new" | "delete">("new")
  let boardModalEntryRef: Gtk.Entry | null = null

  function showBoardModal(mode: "new" | "delete") {
    setBoardModalMode(mode)
    setBoardModalVisible(true)
    if (mode === "new" && boardModalEntryRef) {
      boardModalEntryRef.set_text("")
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
        boardModalEntryRef?.grab_focus()
        return GLib.SOURCE_REMOVE
      })
    }
  }

  function closeBoardModal() {
    setBoardModalVisible(false)
  }

  const boardModal = (
    <window
      visible={boardModalVisible}
      monitor={0}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_: any, event: any) => {
        if (event.get_keyval()[1] === Gdk.KEY_Escape) { closeBoardModal(); return true }
        return false
      }}
    >
      <box name="board-modal-backdrop" expand hexpand vexpand $={(self) => {
        const eb = new Gtk.EventBox({ visible_window: false })
        eb.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        eb.connect("button-press-event", () => { closeBoardModal(); return true })

        const center = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER })
        const modal = (<box name="board-modal" vertical halign={3} valign={3} $={(modalSelf) => {
          modalSelf.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
          modalSelf.connect("button-press-event", () => true)
        }}>
              <label name="board-modal-title" $={(self) => {
                boardModalMode.subscribe(() => {
                  self.set_label(boardModalMode.get() === "new" ? "NEW BOARD" : "DELETE BOARD")
                })
                self.set_label("NEW BOARD")
              }} />

              <box name="board-modal-content" vertical $={(self) => {
                function rebuild() {
                  self.get_children().forEach((c: Gtk.Widget) => c.destroy())
                  if (boardModalMode.get() === "new") {
                    const entry = new Gtk.Entry()
                    entry.set_name("kanban-add-entry")
                    entry.set_placeholder_text("Board name...")
                    entry.set_width_chars(20)
                    boardModalEntryRef = entry
                    entry.connect("activate", () => {
                      let text = ""
                      try { text = entry.get_text().trim() } catch {}
                      if (text) { closeBoardModal(); createBoard(text) }
                    })
                    self.pack_start(entry as Gtk.Widget, false, false, 0)

                    const btnRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
                    btnRow.set_halign(Gtk.Align.CENTER)
                    const cancelBtn = (<button name="planner-nav-btn" onClicked={closeBoardModal}><label label="Cancel" /></button>) as Gtk.Widget
                    const createBtn = (<button name="planner-inner-tab" onClicked={() => {
                      let text = ""
                      try { text = entry.get_text().trim() } catch {}
                      if (text) { closeBoardModal(); createBoard(text) }
                    }}><label label="Create" /></button>) as Gtk.Widget
                    btnRow.pack_start(cancelBtn, false, false, 4)
                    btnRow.pack_start(createBtn, false, false, 4)
                    self.pack_start(btnRow, false, false, 8)
                  } else {
                    const msg = new Gtk.Label({ label: `Are you sure you want to delete "${activeBoard.get()}"?` })
                    msg.set_name("board-modal-msg")
                    self.pack_start(msg, false, false, 8)

                    const btnRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
                    btnRow.set_halign(Gtk.Align.CENTER)
                    const cancelBtn = (<button name="planner-nav-btn" onClicked={closeBoardModal}><label label="Cancel" /></button>) as Gtk.Widget
                    const delBtn = (<button name="planner-popover-item-danger" onClicked={() => {
                      closeBoardModal()
                      removeBoardAndSwitch(activeBoard.get())
                    }}><label label="Delete" /></button>) as Gtk.Widget
                    btnRow.pack_start(cancelBtn, false, false, 4)
                    btnRow.pack_start(delBtn, false, false, 4)
                    self.pack_start(btnRow, false, false, 0)
                  }
                  self.show_all()
                }
                boardModalMode.subscribe(rebuild)
                rebuild()
              }} />
            </box>) as Gtk.Widget
        center.pack_start(modal, false, false, 0)
        eb.add(center)
        self.pack_start(eb as Gtk.Widget, true, true, 0)
        self.show_all()
      }} />
    </window>
  )

  const cardDetailModal = (
    <window
      visible={cardDetailVisible}
      monitor={0}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_: any, event: any) => {
        if (event.get_keyval()[1] === Gdk.KEY_Escape) { closeCardDetail(); return true }
        return false
      }}
    >
      <box name="cd-backdrop" expand hexpand vexpand $={(self) => {
        const eb = new Gtk.EventBox({ visible_window: false })
        eb.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        eb.connect("button-press-event", () => { closeCardDetail(); return true })

        const center = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER })
        const modalEB = new Gtk.EventBox({ visible_window: true })
        modalEB.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        modalEB.connect("button-press-event", () => true)
        forceColor(modalEB, undefined, CD_BG)
        const modal = (<box name="cd-panel" vertical>
          <box name="cd-body" vertical $={(self) => {

            function rebuild() {
              self.get_children().forEach((c: Gtk.Widget) => c.destroy())

              const taskId = cardDetailTaskId.get()
              if (!taskId) return
              const task = kanbanTasks.get().find(t => t.id === taskId)
              if (!task) { closeCardDetail(); return }

              const { notes, checklist } = parseDescription(task.description)

              // GitHub colors for forceColor
              const GH_WHITE = gtkRGBA(0xe6/255, 0xed/255, 0xf3/255)
              const GH_DIM = gtkRGBA(0x8b/255, 0x94/255, 0x9e/255)
              const GH_DIMMER = gtkRGBA(0x6e/255, 0x76/255, 0x81/255)
              const GH_GREEN = gtkRGBA(0x3f/255, 0xb9/255, 0x50/255)
              const GH_RED = gtkRGBA(0xf8/255, 0x51/255, 0x49/255)
              const GH_BLUE = gtkRGBA(0x58/255, 0xa6/255, 0xff/255)
              const GH_BG = gtkRGBA(0x0d/255, 0x11/255, 0x17/255)
              const GH_SURFACE = gtkRGBA(0x16/255, 0x1b/255, 0x22/255)

              // ═══════════════════════════════════════════
              // TOP: Title + close button (like GitHub header)
              // ═══════════════════════════════════════════
              const titleRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
              titleRow.set_name("cd-title-row")

              const titleBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
              titleBox.set_hexpand(true)

              function showTitleLabel() {
                titleBox.get_children().forEach((c: Gtk.Widget) => c.destroy())
                const titleLabel = new Gtk.Label({ label: task.title })
                titleLabel.set_name("cd-title")
                titleLabel.set_halign(Gtk.Align.START)
                titleLabel.set_hexpand(true)
                titleLabel.set_line_wrap(true)
                titleLabel.set_max_width_chars(80)
                forceColor(titleLabel, GH_WHITE)
                const titleClickEB = new Gtk.EventBox()
                titleClickEB.add(titleLabel)
                titleClickEB.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
                titleClickEB.connect("button-press-event", () => { showTitleEntry(); return true })
                titleBox.pack_start(titleClickEB as Gtk.Widget, true, true, 0)
                titleBox.show_all()
              }

              function showTitleEntry() {
                titleBox.get_children().forEach((c: Gtk.Widget) => c.destroy())
                const titleEntry = new Gtk.Entry()
                titleEntry.set_name("cd-title-entry")
                titleEntry.set_text(task.title)
                titleEntry.set_hexpand(true)
                let committed = false
                function save() {
                  if (committed) return
                  committed = true
                  let t = ""; try { t = titleEntry.get_text().trim() } catch {}
                  if (t && t !== task.title) updateTask(task.id, { title: t })
                  else showTitleLabel()
                }
                titleEntry.connect("activate", save)
                titleEntry.connect("focus-out-event", () => { save(); return false })
                titleEntry.connect("key-press-event", (_w: any, ev: any) => {
                  if (ev.get_keyval()[1] === Gdk.KEY_Escape) { committed = true; showTitleLabel(); return true }
                  return false
                })
                titleBox.pack_start(titleEntry as Gtk.Widget, true, true, 0)
                titleBox.show_all()
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                  titleEntry.grab_focus()
                  return GLib.SOURCE_REMOVE
                })
              }

              showTitleLabel()
              titleRow.pack_start(titleBox, true, true, 0)

              // Close X button (top right like GitHub)
              const closeLbl = new Gtk.Label({ label: "\u2715" })
              forceColor(closeLbl, GH_DIM)
              const closeBtn = new Gtk.Button()
              closeBtn.set_name("cd-close-btn")
              closeBtn.add(closeLbl)
              closeBtn.connect("clicked", () => closeCardDetail())
              titleRow.pack_end(closeBtn, false, false, 0)

              self.pack_start(titleRow, false, false, 0)

              // Badge row: status + board path (like GitHub "Open" badge + repo)
              const badgeRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
              badgeRow.set_name("cd-badge-row")

              const statusBadge = new Gtk.Label({ label: task.status === "todo" ? "\u25CB Todo" : task.status === "doing" ? "\u25CF Doing" : "\u2713 Done" })
              statusBadge.set_name("cd-status-badge")
              statusBadge.get_style_context().add_class(task.status)
              badgeRow.pack_start(statusBadge, false, false, 0)

              const pathLabel = new Gtk.Label({ label: activeBoard.get() })
              pathLabel.set_name("cd-path-label")
              forceColor(pathLabel, GH_DIM)
              badgeRow.pack_start(pathLabel, false, false, 0)

              self.pack_start(badgeRow, false, false, 0)

              // Separator
              const headerSep = new Gtk.Box()
              headerSep.set_name("cd-separator")
              headerSep.set_size_request(-1, 1)
              self.pack_start(headerSep, false, false, 0)

              // ═══════════════════════════════════════════
              // TWO COLUMNS: Main content + Sidebar
              // ═══════════════════════════════════════════
              const columns = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
              columns.set_name("cd-columns")
              columns.set_vexpand(true)

              // ── LEFT COLUMN (main content) ──
              const leftScroll = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
              })
              leftScroll.set_hexpand(true)
              leftScroll.set_vexpand(true)
              const left = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
              left.set_name("cd-left")

              // Description comment box (like GitHub comment)
              const descBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
              descBox.set_name("cd-desc-box")

              // Comment header bar (like "AngeloNicolson opened on...")
              const descHeader = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
              descHeader.set_name("cd-desc-header")
              forceColor(descHeader, undefined, GH_SURFACE)
              const descHeaderLbl = new Gtk.Label({ label: "Description" })
              forceColor(descHeaderLbl, GH_DIM)
              descHeader.pack_start(descHeaderLbl, false, false, 0)
              descBox.pack_start(descHeader, false, false, 0)

              // Description textarea
              const descScroll = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
              })
              descScroll.set_name("cd-desc-scroll")
              descScroll.set_size_request(-1, 180)
              const descView = new Gtk.TextView()
              descView.set_name("cd-desc-view")
              descView.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)
              descView.set_left_margin(16)
              descView.set_right_margin(16)
              descView.set_top_margin(14)
              descView.set_bottom_margin(14)
              // Force dark bg on textview (CSS alone doesn't work in GTK3)
              forceColor(descView, GH_WHITE, GH_BG)
              descView.set_cursor_visible(true)
              // Set cursor color via override so it's visible on dark bg
              const cursorCSS = new Gtk.CssProvider()
              cursorCSS.load_from_data(`textview text { caret-color: #58a6ff; }`, -1)
              descView.get_style_context().add_provider(cursorCSS, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1)
              const buf = descView.get_buffer()
              buf.set_text(notes || "No description provided.", -1)
              descScroll.add(descView)
              forceColor(descScroll as Gtk.Widget, undefined, GH_BG)
              descBox.pack_start(descScroll as Gtk.Widget, false, false, 0)

              let lastSaved = notes
              descView.connect("focus-out-event", () => {
                const si = buf.get_start_iter()
                const ei = buf.get_end_iter()
                let newNotes = buf.get_text(si, ei, false)
                if (newNotes === "No description provided.") newNotes = ""
                if (newNotes !== lastSaved) {
                  lastSaved = newNotes
                  const cur = parseDescription(kanbanTasks.get().find(t => t.id === taskId)?.description || "")
                  updateTask(taskId, { description: serializeDescription(newNotes, cur.checklist) })
                }
                return false
              })

              left.pack_start(descBox, false, false, 0)

              // Checklist section (like GitHub "Add a comment" area)
              if (checklist.length > 0 || true) {
                const checkSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
                checkSection.set_name("cd-check-section")

                const checkHeader = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
                checkHeader.set_name("cd-check-header-row")
                const checkLbl = new Gtk.Label({ label: "Sub Items" })
                checkLbl.set_name("cd-section-label")
                forceColor(checkLbl, GH_WHITE)
                checkHeader.pack_start(checkLbl, false, false, 0)
                if (checklist.length > 0) {
                  const done = checklist.filter(i => i.checked).length
                  const cntLbl = new Gtk.Label({ label: `${done}/${checklist.length}` })
                  forceColor(cntLbl, GH_DIM)
                  checkHeader.pack_end(cntLbl, false, false, 0)
                }
                checkSection.pack_start(checkHeader, false, false, 0)

                // Progress bar
                if (checklist.length > 0) {
                  const pbar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
                  pbar.set_name("cd-progress-bar")
                  pbar.set_size_request(-1, 8)
                  const done = checklist.filter(i => i.checked).length
                  const pct = done / checklist.length
                  const fill = new Gtk.Box()
                  fill.set_name("cd-progress-fill")
                  const empty = new Gtk.Box()
                  empty.set_name("cd-progress-empty")
                  empty.set_hexpand(true)
                  pbar.pack_start(fill, false, false, 0)
                  pbar.pack_start(empty, true, true, 0)
                  pbar.connect("size-allocate", (_w: any, alloc: any) => {
                    fill.set_size_request(Math.round(alloc.width * pct), 8)
                  })
                  checkSection.pack_start(pbar, false, false, 4)
                }

                // Checklist items
                for (let i = 0; i < checklist.length; i++) {
                  const item = checklist[i]
                  const idx = i
                  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
                  row.set_name("cd-check-row")

                  const icon = new Gtk.Label({ label: item.checked ? "\u2611" : "\u2610" })
                  forceColor(icon, item.checked ? GH_GREEN : GH_DIMMER)
                  const iconBtn = new Gtk.Button()
                  iconBtn.set_name("cd-checkbox")
                  iconBtn.add(icon)
                  iconBtn.connect("clicked", () => {
                    const p = parseDescription(kanbanTasks.get().find(t => t.id === taskId)?.description || "")
                    if (idx < p.checklist.length) {
                      p.checklist[idx].checked = !p.checklist[idx].checked
                      updateTask(taskId, { description: serializeDescription(p.notes, p.checklist) })
                    }
                  })

                  const textLabel = new Gtk.Label({ label: item.text })
                  textLabel.set_halign(Gtk.Align.START)
                  textLabel.set_hexpand(true)
                  textLabel.set_line_wrap(true)
                  textLabel.set_max_width_chars(70)
                  forceColor(textLabel, item.checked ? GH_DIMMER : GH_WHITE)
                  if (item.checked) textLabel.get_style_context().add_class("checked")

                  row.pack_start(iconBtn, false, false, 0)
                  row.pack_start(textLabel, true, true, 0)

                  const rmLbl = new Gtk.Label({ label: "\u2715" })
                  forceColor(rmLbl, GH_DIMMER)
                  const rmBtn = new Gtk.Button()
                  rmBtn.set_name("cd-remove-btn")
                  rmBtn.add(rmLbl)
                  rmBtn.connect("clicked", () => {
                    const p = parseDescription(kanbanTasks.get().find(t => t.id === taskId)?.description || "")
                    p.checklist.splice(idx, 1)
                    updateTask(taskId, { description: serializeDescription(p.notes, p.checklist) })
                  })
                  row.pack_end(rmBtn, false, false, 0)

                  checkSection.pack_start(row, false, false, 0)
                }

                // Add item entry
                const addEntry = new Gtk.Entry()
                addEntry.set_name("cd-add-entry")
                addEntry.set_placeholder_text("Add sub item...")
                addEntry.set_hexpand(true)
                forceColor(addEntry as Gtk.Widget, GH_DIM, GH_BG)
                addEntry.connect("activate", () => {
                  let text = ""; try { text = addEntry.get_text().trim() } catch {}
                  if (!text) return
                  addEntry.set_text("")
                  const p = parseDescription(kanbanTasks.get().find(t => t.id === taskId)?.description || "")
                  p.checklist.push({ checked: false, text })
                  updateTask(taskId, { description: serializeDescription(p.notes, p.checklist) })
                })
                checkSection.pack_start(addEntry as Gtk.Widget, false, false, 6)

                left.pack_start(checkSection, false, false, 0)
              }

              leftScroll.add(left)
              columns.pack_start(leftScroll as Gtk.Widget, true, true, 0)

              // ── RIGHT SIDEBAR (GitHub sidebar clone) ──
              // Use an EventBox to create a visible left border (CSS borders unreliable on GtkBox)
              const GH_BORDER = gtkRGBA(0x21/255, 0x26/255, 0x2d/255)
              const GH_BTN_BG = gtkRGBA(0x21/255, 0x26/255, 0x2d/255)

              const sidebarOuter = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
              // Visible left border line
              const sidebarBorderLine = new Gtk.EventBox({ visible_window: true })
              sidebarBorderLine.set_size_request(1, -1)
              forceColor(sidebarBorderLine as Gtk.Widget, undefined, GH_BORDER)
              sidebarOuter.pack_start(sidebarBorderLine as Gtk.Widget, false, false, 0)

              const sidebar = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
              sidebar.set_name("cd-sidebar")
              forceColor(sidebar, undefined, GH_BG)

              // Separator line widget
              function sidebarLine(): Gtk.Widget {
                const line = new Gtk.EventBox({ visible_window: true })
                line.set_size_request(-1, 1)
                forceColor(line as Gtk.Widget, undefined, GH_BORDER)
                return line as Gtk.Widget
              }

              // GitHub sidebar section: dim header (with optional dots menu), value, separator
              function sidebarSection(headerText: string, valueWidget: Gtk.Widget, dotsMenu?: Gtk.Popover): void {
                const headerRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
                const header = new Gtk.Label({ label: headerText })
                header.set_halign(Gtk.Align.START)
                header.set_name("cd-sidebar-header")
                forceColor(header, GH_DIM) // GitHub uses muted gray for section headers
                headerRow.pack_start(header, true, true, 0)
                if (dotsMenu) {
                  const dotsLbl = new Gtk.Label({ label: "\u22EF" })
                  forceColor(dotsLbl, GH_DIM)
                  const dotsBtn = new Gtk.Button()
                  dotsBtn.set_name("cd-dots-btn")
                  dotsBtn.add(dotsLbl)
                  dotsMenu.set_relative_to(dotsBtn)
                  dotsBtn.connect("clicked", () => dotsMenu.popup())
                  headerRow.pack_end(dotsBtn, false, false, 0)
                }
                sidebar.pack_start(headerRow, false, false, 0)
                sidebar.pack_start(valueWidget, false, false, 4)
                sidebar.pack_start(sidebarLine(), false, false, 12)
              }

              // ── Assignees
              const assignVal = new Gtk.Label({ label: task.assignment || "No one — assign yourself" })
              assignVal.set_halign(Gtk.Align.START)
              assignVal.set_name("cd-sidebar-value")
              forceColor(assignVal, task.assignment ? GH_WHITE : GH_DIMMER)
              sidebarSection("Assignees", assignVal)

              // ── Status section with 3-dot dropdown for move options
              const statusVal = new Gtk.Label({ label: task.status === "todo" ? "\u25CB Todo" : task.status === "doing" ? "\u25CF In Progress" : "\u2713 Done" })
              statusVal.set_halign(Gtk.Align.START)
              statusVal.set_name("cd-status-badge")
              statusVal.get_style_context().add_class(task.status)

              // Build popover with move options
              const statusPopover = new Gtk.Popover({ position: Gtk.PositionType.BOTTOM })
              const popoverContent = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
              const statuses: Array<{ label: string, value: "todo" | "doing" | "done" }> = [
                { label: "\u25CB  Todo", value: "todo" },
                { label: "\u25CF  In Progress", value: "doing" },
                { label: "\u2713  Done", value: "done" },
              ]
              for (const s of statuses) {
                const itemLbl = new Gtk.Label({ label: s.label })
                itemLbl.set_halign(Gtk.Align.START)
                const itemBtn = new Gtk.Button()
                itemBtn.set_name(s.value === task.status ? "planner-popover-item" : "planner-popover-item")
                if (s.value === task.status) {
                  forceColor(itemLbl, GH_BLUE)
                } else {
                  forceColor(itemLbl, GH_WHITE)
                }
                itemBtn.add(itemLbl)
                itemBtn.connect("clicked", () => {
                  statusPopover.popdown()
                  if (s.value !== task.status) updateTask(task.id, { status: s.value })
                })
                popoverContent.pack_start(itemBtn, false, false, 0)
              }
              statusPopover.add(popoverContent)
              popoverContent.show_all()

              sidebarSection("Status", statusVal, statusPopover)

              // ── Board
              const boardVal = new Gtk.Label({ label: activeBoard.get() })
              boardVal.set_halign(Gtk.Align.START)
              boardVal.set_name("cd-sidebar-value")
              forceColor(boardVal, GH_WHITE)
              sidebarSection("Board", boardVal)

              // ── Checklist summary
              if (checklist.length > 0) {
                const done = checklist.filter(i => i.checked).length
                const checkVal = new Gtk.Label({ label: `${done} of ${checklist.length} complete` })
                checkVal.set_halign(Gtk.Align.START)
                checkVal.set_name("cd-sidebar-value")
                forceColor(checkVal, GH_DIM)
                sidebarSection("Sub Items", checkVal)
              }

              // ── Delete card (red, at bottom — push to end with spacer)
              const spacer = new Gtk.Box()
              spacer.set_vexpand(true)
              sidebar.pack_start(spacer, true, true, 0)
              const delLbl = new Gtk.Label({ label: "Delete card" })
              forceColor(delLbl, GH_RED)
              const deleteBtn = new Gtk.Button()
              deleteBtn.set_name("cd-delete-btn")
              deleteBtn.add(delLbl)
              deleteBtn.connect("clicked", () => { deleteTask(taskId); closeCardDetail() })
              sidebar.pack_start(deleteBtn, false, false, 0)

              sidebarOuter.pack_start(sidebar, false, false, 0)
              columns.pack_start(sidebarOuter, false, false, 0)
              self.pack_start(columns, true, true, 0)

              self.show_all()
            }

            kanbanTasks.subscribe(rebuild)
            cardDetailTaskId.subscribe(rebuild)
            rebuild()
          }} />
        </box>) as Gtk.Widget
        modalEB.add(modal)
        center.pack_start(modalEB as Gtk.Widget, false, false, 0)
        eb.add(center)
        self.pack_start(eb as Gtk.Widget, true, true, 0)
        self.show_all()
      }} />
    </window>
  )

  // ── Board selector dropdown ──
  function buildBoardSelector(): Gtk.Widget {
    let popover: Gtk.Popover | null = null
    const menu = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    menu.set_name("planner-popover-menu")

    const btn = (<button name="kanban-board-selector" onClicked={() => { if (popover) popover.popup() }}>
      <label label={activeBoard.get().toUpperCase()} />
    </button>) as Gtk.Button

    popover = new Gtk.Popover({ relative_to: btn, position: Gtk.PositionType.BOTTOM })
    popover.set_name("planner-popover")

    const btnLabel = btn.get_child() as Gtk.Label

    function rebuildMenu() {
      menu.get_children().forEach((c: Gtk.Widget) => c.destroy())
      const boards = boardList.get()
      const current = activeBoard.get()

      for (const name of boards) {
        const itemBtn = new Gtk.Button()
        itemBtn.set_name("planner-popover-item")
        const lbl = new Gtk.Label({ label: name === current ? `> ${name}` : `  ${name}` })
        lbl.set_halign(Gtk.Align.START)
        itemBtn.add(lbl)
        itemBtn.connect("clicked", () => {
          popover!.popdown()
          if (name !== current) switchBoard(name)
        })
        menu.pack_start(itemBtn, false, false, 0)
      }

      const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL })
      menu.pack_start(sep, false, false, 4)

      const newBtn = new Gtk.Button()
      newBtn.set_name("planner-popover-item")
      const newLabel = new Gtk.Label({ label: "+ New board" })
      newLabel.set_halign(Gtk.Align.START)
      newBtn.add(newLabel)
      newBtn.connect("clicked", () => { popover!.popdown(); showBoardModal("new") })
      menu.pack_start(newBtn, false, false, 0)

      if (boards.length > 1) {
        const delBtn = new Gtk.Button()
        delBtn.set_name("planner-popover-item-danger")
        const delLabel = new Gtk.Label({ label: `Delete "${current}"` })
        delLabel.set_halign(Gtk.Align.START)
        delBtn.add(delLabel)
        delBtn.connect("clicked", () => { popover!.popdown(); showBoardModal("delete") })
        menu.pack_start(delBtn, false, false, 0)
      }

      menu.show_all()
    }

    boardList.subscribe(rebuildMenu)
    activeBoard.subscribe(() => { btnLabel.set_label(activeBoard.get().toUpperCase()); rebuildMenu() })
    rebuildMenu()
    popover.add(menu)

    return btn as Gtk.Widget
  }

  // ── Build the board pane ──
  function buildBoardPane(): Gtk.Widget {
    const cardContainers: Record<string, Gtk.Box> = {}
    const subpaneStack = new Gtk.Stack({
      transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
      transition_duration: 150,
    })

    for (const status of ["todo", "doing", "done"] as const) {
      const cardBox = (<box vertical />) as Gtk.Box
      cardContainers[status] = cardBox

      const scrollable = (<scrollable hscroll={1} vscroll={2} vexpand={true}>
        {cardBox}
      </scrollable>) as Gtk.Widget

      subpaneStack.add_named(scrollable, status)
    }

    // Wire subpane switching
    activeSubpane.subscribe(() => {
      subpaneStack.set_visible_child_name(activeSubpane.get())
    })

    // Rebuild card lists when tasks change
    kanbanTasks.subscribe(() => {
      for (const status of ["todo", "doing", "done"] as const) {
        buildCardList(status, cardContainers[status])
      }
    })

    // Initial build
    for (const status of ["todo", "doing", "done"] as const) {
      buildCardList(status, cardContainers[status])
    }

    const pane = (<box vertical vexpand={true}>
      {subpaneStack as Gtk.Widget}
    </box>) as Gtk.Widget

    subpaneStack.show_all()
    return pane
  }

  let infoPanelRef: Gtk.Widget | null = null

  // ── Calendar pane (extracted from old contentView) ──
  const calendarPane = (<box vertical vexpand={true}>
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
            placeNowLine()
            return GLib.SOURCE_REMOVE
          })
        }
      })
      const grid = buildGrid()
      overlay.add(grid)
      self.add(overlay)
      overlay.show_all()
    }} />

  </box>) as Gtk.Widget

  // ── Board pane ──
  const boardPane = buildBoardPane()

  // ── Inner stack (calendar / board) ──
  const contentInnerStack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
    transition_duration: 200,
  })
  contentInnerStack.add_named(calendarPane, "calendar")
  contentInnerStack.add_named(boardPane, "board")
  contentInnerStack.show_all()

  activeInnerTab.subscribe(() => {
    contentInnerStack.set_visible_child_name(activeInnerTab.get())
  })

  // ── Inner tab bar (in header) ──
  const innerTabBar = (<box name="planner-inner-tabs" halign={3}>
    {(["calendar", "board"] as const).map(tab => {
      const label = tab === "calendar" ? "CAL" : "BOARD"
      return (
        <button name="planner-inner-tab" onClicked={() => setActiveInnerTab(tab)} $={(self) => {
          function update() {
            const ctx = self.get_style_context()
            if (activeInnerTab.get() === tab) ctx.add_class("active")
            else ctx.remove_class("active")
          }
          activeInnerTab.subscribe(update)
          update()
        }}>
          <label label={label} />
        </button>
      )
    })}
  </box>) as Gtk.Widget

  // ── Nav row: date nav for CAL, board selector + subpane nav for BOARD ──
  const calNav = (<box name="planner-date-nav" halign={3}>
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
  </box>) as Gtk.Widget

  const boardSelectorWidget = buildBoardSelector()
  boardSelectorWidget.set_opacity(0)
  boardSelectorWidget.set_sensitive(false)
  activeInnerTab.subscribe(() => {
    const isBoard = activeInnerTab.get() === "board"
    boardSelectorWidget.set_opacity(isBoard ? 1 : 0)
    boardSelectorWidget.set_sensitive(isBoard)
  })

  const boardSelectorRow = (<box name="kanban-board-header" halign={3}>
    {boardSelectorWidget}
  </box>) as Gtk.Widget

  const boardNav = (<box name="planner-date-nav" halign={3}>
    <button name="planner-nav-btn" onClicked={prevSubpane}>
      <label label="<" />
    </button>
    <label name="planner-date" $={(self) => {
      function update() {
        const s = activeSubpane.get()
        const display = s === "todo" ? "TODO" : s === "doing" ? "DOING" : "DONE"
        const count = kanbanTasks.get().filter(t => t.status === s).length
        self.set_label(`${display} (${count})`)
      }
      activeSubpane.subscribe(update)
      kanbanTasks.subscribe(update)
      update()
    }} />
    <button name="planner-nav-btn" onClicked={nextSubpane}>
      <label label=">" />
    </button>
  </box>) as Gtk.Widget

  // Show/hide nav rows based on active tab
  calNav.set_no_show_all(false)
  boardNav.set_no_show_all(true)
  boardNav.set_visible(false)
  activeInnerTab.subscribe(() => {
    const isBoard = activeInnerTab.get() === "board"
    calNav.set_visible(!isBoard)
    calNav.set_no_show_all(isBoard)
    boardNav.set_visible(isBoard)
    boardNav.set_no_show_all(!isBoard)
  })

  const contentView = (
    <box vertical name="planner-page" vexpand={true}>
      <box name="planner-header" halign={3}>
        {innerTabBar}
      </box>

      <box name="planner-info-panel" vertical $={(self) => {
        infoPanelRef = self
        self.set_no_show_all(true)
        self.set_visible(false)
      }}>
        <label name="planner-info-text" halign={1} $={(self) => {
          self.set_markup(PLAN_HEADER.replace(/^# ?/gm, "").trim())
          self.set_selectable(true)
        }} />
      </box>

      {boardSelectorRow}
      {calNav}
      {boardNav}
      {contentInnerStack as Gtk.Widget}

      <box name="planner-footer-bar">
        <label name="planner-footer" $={(self) => {
          function update() {
            if (activeInnerTab.get() === "calendar") {
              self.set_label(`${fileList.get().length} plans`)
            } else {
              self.set_label(`${activeBoard.get()}: ${kanbanTasks.get().length} tasks`)
            }
          }
          activeInnerTab.subscribe(update)
          fileList.subscribe(update)
          kanbanTasks.subscribe(update)
          activeBoard.subscribe(update)
          update()
        }} />
        <box hexpand={true} />
        <button name="planner-info-btn" onClicked={() => {
          if (infoPanelRef) infoPanelRef.set_visible(!infoPanelRef.get_visible())
        }}>
          <label label="i" />
        </button>
        <button name="planner-reload-btn" onClicked={() => reload()}>
          <label label="R" />
        </button>
      </box>
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
  setupFileWatcher()

  return innerStack
}

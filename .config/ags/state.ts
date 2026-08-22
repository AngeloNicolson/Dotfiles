import { createState } from "ags"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=3.0"
import { getFocusedMonitorName } from "./compositor"
import { pageIds, LEGACY_PAGE_IDS } from "./pages"

// Persisted UI state — survives AGS restart / reboot. Lives in the XDG state
// dir (machine-local), NOT the config dir, which is a symlink into the dotfiles
// repo — state files don't belong in git.
const STATE_DIR = GLib.get_user_state_dir() + "/ags"
const UI_STATE_FILE = STATE_DIR + "/ui-state.json"
const LEGACY_UI_STATE_FILE = GLib.get_user_config_dir() + "/ags/ui-state.json"

function tryRead(path: string): string {
  try {
    return readFile(path) || ""
  } catch {
    return ""
  }
}

function loadUiState(): Record<string, any> {
  try {
    const raw = tryRead(UI_STATE_FILE) || tryRead(LEGACY_UI_STATE_FILE)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

const uiState = loadUiState()

function saveUiState() {
  try {
    GLib.mkdir_with_parents(STATE_DIR, 0o755)
    writeFile(UI_STATE_FILE, JSON.stringify(uiState))
  } catch (e) {
    console.error("Failed to persist UI state:", e)
  }
}

const HOME_PAGE = pageIds[0]

// Map any persisted pre-registry page id ("page1".."page6") to its new name.
function normalizePageId(id: string | null): string | null {
  if (id === null) return null
  return LEGACY_PAGE_IDS[id] ?? (pageIds.includes(id) ? id : HOME_PAGE)
}

// Bar visibility state. Starts true because GTK's show_all() reveals the
// sidebar on startup regardless — false here just desyncs state from screen
// until the first toggle.
export const [barVisible, setBarVisible] = createState(true)

// Destination menu visibility state
export const [destinationVisible, setDestinationVisible] = createState(false)

// Galaxy overlay visibility state
export const [galaxyVisible, setGalaxyVisible] = createState(false)

// Periodic table visibility state
export const [periodicTableVisible, setPeriodicTableVisible] = createState(false)

// Break popup visibility state (Pomodoro)
export const [breakPopupVisible, setBreakPopupVisible] = createState(false)

// PlanSync state
export const [syncConnected, setSyncConnected] = createState(false)
export const [syncPeerCount, setSyncPeerCount] = createState(0)
export const [syncPeers, setSyncPeers] = createState<string[]>([])
export const [pendingChangeRequests, setPendingChangeRequests] = createState(0)
export const [syncDialogVisible, setSyncDialogVisible] = createState(false)

// Sidebar pinned — when on, bar has exclusive zone and pushes windows away
export const [sidebarPinned, setSidebarPinned] = createState(true)

// Focused page — when set, bar always opens to this page. Defaults to HOME;
// the user's FOCUS choice is remembered across reboots.
const [focusedPage, setFocusedPageState] = createState<string | null>(
  uiState.focusedPage !== undefined ? normalizePageId(uiState.focusedPage) : HOME_PAGE
)
export { focusedPage }

export function setFocusedPage(pageId: string | null) {
  setFocusedPageState(pageId)
  uiState.focusedPage = pageId
  saveUiState()
}

export function toggleFocusedPage(pageId: string) {
  if (focusedPage.get() === pageId) {
    setFocusedPage(null)
  } else {
    setFocusedPage(pageId)
  }
}

export function togglePeriodicTable() {
  const newVisible = !periodicTableVisible.get()
  print(`togglePeriodicTable: setting visible to ${newVisible}`)
  setPeriodicTableVisible(newVisible)
}

export function toggleDestination() {
  const newVisible = !destinationVisible.get()
  print(`toggleDestination: setting visible to ${newVisible}`)
  // Close galaxy if opening destination
  if (newVisible && galaxyVisible.get()) {
    setGalaxyVisible(false)
  }
  setDestinationVisible(newVisible)
}

export function toggleGalaxy() {
  const newVisible = !galaxyVisible.get()
  print(`toggleGalaxy: setting visible to ${newVisible}`)
  // Close destination if opening galaxy
  if (newVisible && destinationVisible.get()) {
    setDestinationVisible(false)
  }
  setGalaxyVisible(newVisible)
}

export function toggleBar() {
  const newVisible = !barVisible.get()

  if (newVisible) {
    // Set page BEFORE showing bar to avoid flicker
    const targetPage = focusedPage.get() || HOME_PAGE
    const targetIndex = pages.indexOf(targetPage)
    sidebarStacks.forEach((stack, monitorName) => {
      stack.set_visible_child_name(targetPage)
      pageIndices.set(monitorName, targetIndex)
      const [, setPageState] = getPageState(monitorName)
      setPageState(targetPage)
    })
    setBarVisible(true)
  } else {
    setBarVisible(false)
    // Reset to home after hiding so stack is pre-positioned
    sidebarStacks.forEach((stack, monitorName) => {
      stack.set_visible_child_name(HOME_PAGE)
      pageIndices.set(monitorName, 0)
      const [, setPageState] = getPageState(monitorName)
      setPageState(HOME_PAGE)
    })
  }
}

// Page cycling state - track all sidebar stacks by monitor NAME (stable identifier)
const sidebarStacks: Map<string, Gtk.Stack> = new Map()
export const pages = pageIds
const pageIndices: Map<string, number> = new Map()

// Reactive state for current page per monitor - components can subscribe to this
const pageStates: Map<string, ReturnType<typeof createState<string>>> = new Map()

export function getPageState(monitorName: string) {
  if (!pageStates.has(monitorName)) {
    pageStates.set(monitorName, createState(HOME_PAGE))
  }
  return pageStates.get(monitorName)!
}

export function clearSidebarStacks() {
  sidebarStacks.clear()
  pageIndices.clear()
  pageStates.clear()
}

export function removeSidebarStack(monitorName: string) {
  console.log(`Removing stack for monitor: ${monitorName}`)
  sidebarStacks.delete(monitorName)
  pageIndices.delete(monitorName)
  pageStates.delete(monitorName)
}

export function setSidebarStack(monitorName: string, stack: Gtk.Stack) {
  console.log(`Registering stack for monitor: ${monitorName}`)
  sidebarStacks.set(monitorName, stack)
  if (!pageIndices.has(monitorName)) {
    pageIndices.set(monitorName, 0)
  }
}

export function getSidebarStacks() {
  return sidebarStacks
}

// Monitor whose sidebar cycling commands should act on: the focused one, or
// the only registered one when the compositor can't tell us focus.
function targetMonitorName(): string | null {
  const focused = getFocusedMonitorName()
  if (focused && sidebarStacks.has(focused)) return focused
  const first = sidebarStacks.keys().next()
  return first.done ? null : first.value
}

function cycleBy(delta: number) {
  const monitorName = targetMonitorName()
  if (!monitorName) {
    console.error("cyclePage: no sidebar stacks registered")
    return
  }
  const stack = sidebarStacks.get(monitorName)!
  const currentIndex = pageIndices.get(monitorName) || 0
  const nextIndex = (currentIndex + delta + pages.length) % pages.length
  pageIndices.set(monitorName, nextIndex)
  stack.set_visible_child_name(pages[nextIndex])

  // Update reactive state so buttons reflect the change
  const [, setPageState] = getPageState(monitorName)
  setPageState(pages[nextIndex])
}

export function cyclePage() {
  cycleBy(1)
}

export function cyclePageBack() {
  cycleBy(-1)
}

// Set page directly (used by tab buttons)
export function setPage(monitorName: string, pageId: string) {
  const stack = sidebarStacks.get(monitorName)
  if (stack) {
    stack.set_visible_child_name(pageId)
    const pageIndex = pages.indexOf(pageId)
    if (pageIndex !== -1) {
      pageIndices.set(monitorName, pageIndex)
    }
    const [, setPageState] = getPageState(monitorName)
    setPageState(pageId)
  }
}

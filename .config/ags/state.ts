import { createState } from "ags"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=3.0"
import { getFocusedMonitorName } from "./compositor"
import { pageIds, LEGACY_PAGE_IDS } from "./pages"
import { CENTERED, closeFlyout, type Placement } from "./flyout"

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

// Settings window (SettingsWindow.tsx) and its current page
export const [settingsVisible, setSettingsVisible] = createState(false)
export const [settingsPage, setSettingsPage] = createState("system")
export function toggleSettings(page?: string) {
  if (page) setSettingsPage(page)
  setSettingsVisible(page ? true : !settingsVisible.get())
}

// Wallpaper carousel overlay (WallpaperCarousel.tsx)
export const [wallpapersVisible, setWallpapersVisible] = createState(false)
export function toggleWallpapers() {
  setWallpapersVisible(!wallpapersVisible.get())
}

// Starred wallpapers, stored relative to the wallpaper dir so they survive a
// home-dir rename. Shown first in the carousel and in the CORE page list.
export const [favouriteWallpapers, setFavouriteWallpapersState] = createState<string[]>(
  Array.isArray(uiState.favouriteWallpapers) ? uiState.favouriteWallpapers : [],
)
export function setFavouriteWallpapers(list: string[]) {
  uiState.favouriteWallpapers = list
  setFavouriteWallpapersState(list)
  saveUiState()
}

// Display arranger overlay visibility state
export const [displaysVisible, setDisplaysVisible] = createState(false)

// Break popup visibility state (Pomodoro)
export const [breakPopupVisible, setBreakPopupVisible] = createState(false)

// PlanSync state
export const [syncConnected, setSyncConnected] = createState(false)
export const [syncPeerCount, setSyncPeerCount] = createState(0)
export const [pendingChangeRequests, setPendingChangeRequests] = createState(0)
export const [syncDialogVisible, setSyncDialogVisible] = createState(false)

// Sidebar pinned — when on, bar has exclusive zone and pushes windows away.
// The DOCK choice is remembered across restarts/reboots.
const [sidebarPinned, setSidebarPinnedState] = createState<boolean>(
  uiState.sidebarPinned ?? true
)
export { sidebarPinned }

export function setSidebarPinned(pinned: boolean) {
  setSidebarPinnedState(pinned)
  uiState.sidebarPinned = pinned
  saveUiState()
}

// ── Bar style (Settings → Bar Studio) ───────────────────────────────────────
// frame:   Sumi-style band round the desktop + left rail (no page sidebar)
// shield:  Halo-themed top bar: three pills, workspace compass in the centre
export type BarStyle = "frame" | "shield"
export const BAR_STYLES: BarStyle[] = ["frame", "shield"]

export interface FrameConfig { thickness: number, radius: number, opacity: number, rail: number }
export interface ShieldConfig { color: "theme" | "reach" }
const FRAME_DEFAULTS: FrameConfig = { thickness: 6, radius: 14, opacity: 0.92, rail: 44 }
const SHIELD_DEFAULTS: ShieldConfig = { color: "reach" }

const [barStyle, setBarStyleState] = createState<BarStyle>(
  BAR_STYLES.includes(uiState.barStyle) ? uiState.barStyle : "shield"
)
const [frameConfig, setFrameConfigState] = createState<FrameConfig>({ ...FRAME_DEFAULTS, ...uiState.frame })
const [shieldConfig, setShieldConfigState] = createState<ShieldConfig>({ ...SHIELD_DEFAULTS, ...uiState.shield })
export { barStyle, frameConfig, shieldConfig, FRAME_DEFAULTS, SHIELD_DEFAULTS }

export function setBarStyle(style: BarStyle) {
  if (!BAR_STYLES.includes(style)) return
  uiState.barStyle = style
  saveUiState()
  setBarStyleState(style)
}

export function setFrameConfig(patch: Partial<FrameConfig>) {
  const next = { ...frameConfig.get(), ...patch }
  uiState.frame = next
  saveUiState()
  setFrameConfigState(next)
}

export function setShieldConfig(patch: Partial<ShieldConfig>) {
  const next = { ...shieldConfig.get(), ...patch }
  uiState.shield = next
  saveUiState()
  setShieldConfigState(next)
}

// Edge tab (EdgeTab.tsx): which page is slid out of the right edge, or null —
// per monitor NAME, so opening a page on one screen leaves the others tucked.
const edgePageStates: Map<string, ReturnType<typeof createState<string | null>>> = new Map()
export function getEdgePageState(monitorName: string) {
  if (!edgePageStates.has(monitorName)) {
    edgePageStates.set(monitorName, createState<string | null>(null))
  }
  return edgePageStates.get(monitorName)!
}

// Shield morph panel (ShieldBar.tsx): which surface is grown out, or null.
export type ShieldPanel = "media" | "calendar" | "controls" | null
export const [shieldPanel, setShieldPanel] = createState<ShieldPanel>(null)

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

// Bluetooth manager overlay visibility state
export const [bluetoothWindowVisible, setBluetoothWindowVisible] = createState(false)

// Where each flyout opens: centred (keybind/IPC) or attached to the sidebar
// widget whose pop-out button was pressed. Always a fresh object so the
// window's monitor binding re-evaluates on every open.
export const [bluetoothPlacement, setBluetoothPlacement] = createState<Placement>(CENTERED)
export const [displaysPlacement, setDisplaysPlacement] = createState<Placement>(CENTERED)

export function toggleBluetoothWindow(placement: Placement = CENTERED) {
  if (bluetoothWindowVisible.get()) return closeFlyout("bluetooth", () => setBluetoothWindowVisible(false))
  setBluetoothPlacement({ ...placement })
  setBluetoothWindowVisible(true)
}

export function toggleDisplays(placement: Placement = CENTERED) {
  if (displaysVisible.get()) return closeFlyout("displays", () => setDisplaysVisible(false))
  setDisplaysPlacement({ ...placement })
  setDisplaysVisible(true)
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

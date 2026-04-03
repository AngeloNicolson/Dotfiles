import { createState } from "ags"
import Gtk from "gi://Gtk?version=3.0"
import AstalHyprland from "gi://AstalHyprland"

// Bar visibility state
export const [barVisible, setBarVisible] = createState(false)

// Destination menu visibility state
export const [destinationVisible, setDestinationVisible] = createState(false)

// Galaxy overlay visibility state
export const [galaxyVisible, setGalaxyVisible] = createState(false)

// Periodic table visibility state
export const [periodicTableVisible, setPeriodicTableVisible] = createState(false)

// Break popup visibility state (Pomodoro)
export const [breakPopupVisible, setBreakPopupVisible] = createState(false)

// Task popup visibility state (Planner — shown when calendar event switches)
export const [taskPopupVisible, setTaskPopupVisible] = createState(false)
export const [taskPopupTitle, setTaskPopupTitle] = createState("")

// PlanSync state
export const [syncConnected, setSyncConnected] = createState(false)
export const [syncPeerCount, setSyncPeerCount] = createState(0)
export const [syncPeers, setSyncPeers] = createState<string[]>([])
export const [pendingChangeRequests, setPendingChangeRequests] = createState(0)
export const [syncDialogVisible, setSyncDialogVisible] = createState(false)

// Sidebar pinned — when on, bar has exclusive zone and pushes windows away
export const [sidebarPinned, setSidebarPinned] = createState(true)

// Focused page — when set, bar always opens to this page
export const [focusedPage, setFocusedPage] = createState<string | null>("page2")

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
    const targetPage = focusedPage.get() || "page1"
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
      stack.set_visible_child_name("page1")
      pageIndices.set(monitorName, 0)
      const [, setPageState] = getPageState(monitorName)
      setPageState("page1")
    })
  }
}

// Page cycling state - track all sidebar stacks by monitor NAME (stable identifier)
const sidebarStacks: Map<string, Gtk.Stack> = new Map()
export const pages = ["page1", "page2", "page3", "page4", "page5", "page6"]
const pageIndices: Map<string, number> = new Map()

// Reactive state for current page per monitor - components can subscribe to this
const pageStates: Map<string, ReturnType<typeof createState<string>>> = new Map()

export function getPageState(monitorName: string) {
  if (!pageStates.has(monitorName)) {
    pageStates.set(monitorName, createState("page1"))
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

export function cyclePage() {
  const hyprland = AstalHyprland.get_default()
  const focusedWorkspace = hyprland.get_focused_workspace()
  if (!focusedWorkspace) {
    console.error("cyclePage: No focused workspace")
    return
  }

  const focusedMonitor = focusedWorkspace.get_monitor()
  if (!focusedMonitor) {
    console.error("cyclePage: No focused monitor")
    return
  }

  const monitorName = focusedMonitor.get_name()
  console.log(`cyclePage: Focused monitor: ${monitorName}`)
  console.log(`cyclePage: Available stacks:`, Array.from(sidebarStacks.keys()))

  const stack = sidebarStacks.get(monitorName)

  if (stack) {
    const currentIndex = pageIndices.get(monitorName) || 0
    const nextIndex = (currentIndex + 1) % pages.length
    pageIndices.set(monitorName, nextIndex)
    console.log(`cyclePage: Cycling from ${pages[currentIndex]} to ${pages[nextIndex]}`)
    stack.set_visible_child_name(pages[nextIndex])

    // Update reactive state so buttons reflect the change
    const [, setPage] = getPageState(monitorName)
    setPage(pages[nextIndex])
  } else {
    console.error(`cyclePage: No stack found for monitor ${monitorName}`)
  }
}

export function cyclePageBack() {
  const hyprland = AstalHyprland.get_default()
  const focusedWorkspace = hyprland.get_focused_workspace()
  if (!focusedWorkspace) return

  const focusedMonitor = focusedWorkspace.get_monitor()
  if (!focusedMonitor) return

  const monitorName = focusedMonitor.get_name()
  const stack = sidebarStacks.get(monitorName)

  if (stack) {
    const currentIndex = pageIndices.get(monitorName) || 0
    const prevIndex = (currentIndex - 1 + pages.length) % pages.length
    pageIndices.set(monitorName, prevIndex)
    stack.set_visible_child_name(pages[prevIndex])

    const [, setPage] = getPageState(monitorName)
    setPage(pages[prevIndex])
  }
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

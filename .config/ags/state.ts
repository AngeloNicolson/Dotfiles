import { createState } from "ags"
import Gtk from "gi://Gtk?version=3.0"
import AstalHyprland from "gi://AstalHyprland"

// Bar visibility state
export const [barVisible, setBarVisible] = createState(true)

export function toggleBar() {
  const newVisible = !barVisible.get()
  print(`toggleBar: setting visible to ${newVisible}`)
  setBarVisible(newVisible)

  // Reset to home page when opening the bar
  if (newVisible) {
    print(`toggleBar: resetting to home, stacks: ${sidebarStacks.size}`)
    sidebarStacks.forEach((stack, monitorName) => {
      print(`resetting ${monitorName} to page1`)
      stack.set_visible_child_name("page1")
      pageIndices.set(monitorName, 0)
      const [, setPageState] = getPageState(monitorName)
      setPageState("page1")
    })
  }
}

// Page cycling state - track all sidebar stacks by monitor NAME (stable identifier)
const sidebarStacks: Map<string, Gtk.Stack> = new Map()
export const pages = ["page1", "page2", "page3", "page4", "page5"]
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

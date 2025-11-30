import { createState } from "ags"
import Gtk from "gi://Gtk?version=3.0"
import AstalHyprland from "gi://AstalHyprland"

// Bar visibility state
export const [barVisible, setBarVisible] = createState(true)

export function toggleBar() {
  setBarVisible(!barVisible.get())
}

// Page cycling state - track all sidebar stacks by monitor
const sidebarStacks: Map<number, Gtk.Stack> = new Map()
const pages = ["page1", "page2", "page3", "page4"]
const pageIndices: Map<number, number> = new Map()

export function setSidebarStack(monitorId: number, stack: Gtk.Stack) {
  sidebarStacks.set(monitorId, stack)
  if (!pageIndices.has(monitorId)) {
    pageIndices.set(monitorId, 0)
  }
}

export function cyclePage() {
  const hyprland = AstalHyprland.get_default()
  const focusedWorkspace = hyprland.get_focused_workspace()
  if (!focusedWorkspace) return

  const focusedMonitor = focusedWorkspace.get_monitor()
  if (!focusedMonitor) return

  const monitorId = focusedMonitor.get_id()
  const stack = sidebarStacks.get(monitorId)

  if (stack) {
    const currentIndex = pageIndices.get(monitorId) || 0
    const nextIndex = (currentIndex + 1) % pages.length
    pageIndices.set(monitorId, nextIndex)
    stack.set_visible_child_name(pages[nextIndex])
  }
}

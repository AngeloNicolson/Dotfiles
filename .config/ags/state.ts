import { createState } from "ags"
import Gtk from "gi://Gtk?version=3.0"

// Bar visibility state
export const [barVisible, setBarVisible] = createState(true)

export function toggleBar() {
  setBarVisible(!barVisible.get())
}

// Page cycling state
let sidebarStack: Gtk.Stack | null = null
const pages = ["page1", "page2", "page3"]
let currentPageIndex = 0

export function setSidebarStack(stack: Gtk.Stack) {
  sidebarStack = stack
}

export function cyclePage() {
  currentPageIndex = (currentPageIndex + 1) % pages.length
  if (sidebarStack) {
    sidebarStack.set_visible_child_name(pages[currentPageIndex])
  }
}

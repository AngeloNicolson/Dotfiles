import Gtk from "gi://Gtk?version=3.0"
import { setSidebarStack } from "../state"
import Home from "./Home"
import ThemeSwitcher from "./ThemeSwitcher"
import AppLauncher from "./AppLauncher"
import AstalHyprland from "gi://AstalHyprland"

export default function Sidebar({ gdkMonitorIndex }: { gdkMonitorIndex: number }) {
  const stack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
    transition_duration: 300,
  })

  const homePage = <Home />
  const themePage = <ThemeSwitcher />
  const appPage = <AppLauncher />

  const settingsPage = (
    <box vertical name="page-box">
      <label name="title-blue" label="Settings" />
      <label name="subtitle" label="Coming soon..." />
    </box>
  )

  stack.add_named(homePage, "page1")
  stack.add_named(themePage, "page2")
  stack.add_named(appPage, "page3")
  stack.add_named(settingsPage, "page4")
  stack.set_visible_child_name("page1")
  stack.show_all()

  // Get the Hyprland monitor ID from GDK monitor index
  const hyprland = AstalHyprland.get_default()
  const hyprMonitors = hyprland.get_monitors()

  // Find the corresponding Hyprland monitor
  // The inverted mapping: gdkIndex 0 -> hyprMonitor[1], gdkIndex 1 -> hyprMonitor[0]
  const numMonitors = hyprMonitors.length
  const hyprIndex = (numMonitors - 1) - gdkMonitorIndex
  const hyprMonitor = hyprMonitors[hyprIndex]

  if (hyprMonitor) {
    setSidebarStack(hyprMonitor.get_id(), stack)
  }

  return (
    <box name="sidebar-bg">
      {stack}
    </box>
  )
}

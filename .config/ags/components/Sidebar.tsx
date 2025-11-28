import Gtk from "gi://Gtk?version=3.0"
import { setSidebarStack } from "../state"
import Home from "./Home"
import ThemeSwitcher from "./ThemeSwitcher"

export default function Sidebar() {
  const stack = new Gtk.Stack({
    transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
    transition_duration: 300,
  })

  const homePage = <Home />
  const themePage = <ThemeSwitcher />

  const settingsPage = (
    <box vertical name="page-box">
      <label name="title-blue" label="Settings" />
      <label name="subtitle" label="Coming soon..." />
    </box>
  )

  stack.add_named(homePage, "page1")
  stack.add_named(themePage, "page2")
  stack.add_named(settingsPage, "page3")
  stack.set_visible_child_name("page1")
  stack.show_all()

  setSidebarStack(stack)

  return (
    <box name="sidebar-bg">
      {stack}
    </box>
  )
}

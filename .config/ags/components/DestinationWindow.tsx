import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { destinationVisible, setDestinationVisible } from "../state"
import DestinationMenu from "./DestinationMenu"
import Gdk from "gi://Gdk?version=3.0"
import AstalHyprland from "gi://AstalHyprland"

export default function DestinationWindow(gdkMonitor: number) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor
  const hyprland = AstalHyprland.get_default()

  // Close on workspace change
  hyprland.connect("notify::focused-workspace", () => {
    if (destinationVisible.get()) {
      setDestinationVisible(false)
    }
  })

  return (
    <window
      visible={destinationVisible}
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => {
        const keyval = event.get_keyval()[1]
        // Close on Escape
        if (keyval === Gdk.KEY_Escape) {
          setDestinationVisible(false)
          return true
        }
        return false
      }}
      // onFocusOutEvent={() => {
      //   // Close when focus leaves the window
      //   setDestinationVisible(false)
      //   return false
      // }}
    >
      <box name="destination-menu-window" expand hexpand vexpand>
        <DestinationMenu />
      </box>
    </window>
  )
}

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { galaxyVisible, setGalaxyVisible } from "../state"
import GalaxyOverlay from "./GalaxyOverlay"
import Gdk from "gi://Gdk?version=3.0"
import AstalHyprland from "gi://AstalHyprland"

export default function GalaxyWindow(gdkMonitor: number) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor
  const hyprland = AstalHyprland.get_default()

  // Close on workspace change
  hyprland.connect("notify::focused-workspace", () => {
    if (galaxyVisible.get()) {
      setGalaxyVisible(false)
    }
  })

  return (
    <window
      visible={galaxyVisible}
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => {
        const keyval = event.get_keyval()[1]
        if (keyval === Gdk.KEY_Escape) {
          setGalaxyVisible(false)
          return true
        }
        return false
      }}
      onFocusOutEvent={() => {
        setGalaxyVisible(false)
        return false
      }}
    >
      <box name="galaxy-window" expand hexpand vexpand>
        <GalaxyOverlay />
      </box>
    </window>
  )
}

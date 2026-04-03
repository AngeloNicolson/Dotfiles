import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import Gtk from "gi://Gtk?version=3.0"
import { activeSubmap, submapVisible } from "../state"

interface KeyBind {
  key: string
  action: string
}

const SUBMAP_CONFIG: Record<string, { icon: string; label: string; binds: KeyBind[] }> = {
  "window": {
    icon: "",
    label: "WINDOW",
    binds: [
      { key: "H/J/K/L", action: "resize" },
      { key: "F", action: "float" },
      { key: "P", action: "pin" },
      { key: "X", action: "kill" },
      { key: "⏎", action: "fullscreen" },
      { key: "S", action: "split" },
      { key: "N", action: "→ move" },
      { key: "ESC", action: "exit" },
    ],
  },
  "move": {
    icon: "",
    label: "MOVE",
    binds: [
      { key: "H/J/K/L", action: "direction" },
      { key: "1-5", action: "workspace" },
      { key: "B", action: "browser" },
      { key: "D", action: "document" },
      { key: "M", action: "media" },
      { key: "S", action: "special" },
      { key: "W", action: "→ window" },
      { key: "ESC", action: "exit" },
    ],
  },
}

export default function SubmapIndicator(gdkMonitor: number) {
  const { BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  const win = (
    <window
      visible={false}
      monitor={gdkMonitor}
      anchor={BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      application={app}
    >
      <box name="submap-bar" hexpand>
        <label
          name="submap-icon"
          label={activeSubmap.as((s) => SUBMAP_CONFIG[s]?.icon || "")}
        />
        <label
          name="submap-label"
          label={activeSubmap.as((s) => SUBMAP_CONFIG[s]?.label || s.toUpperCase())}
        />
        <box name="submap-separator" />
        <label
          name="submap-binds"
          label={activeSubmap.as((s) => {
            const config = SUBMAP_CONFIG[s]
            if (!config) return ""
            return config.binds.map(b => `${b.key} ${b.action}`).join("    ")
          })}
        />
      </box>
    </window>
  ) as Gtk.Window

  win.show_all()
  win.visible = false

  submapVisible.subscribe(() => {
    win.visible = submapVisible.get()
  })

  return win
}

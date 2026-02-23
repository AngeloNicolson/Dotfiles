import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { taskPopupVisible, setTaskPopupVisible, taskPopupTitle } from "../state"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"

let autoDismissTimer = 0

function scheduleAutoDismiss() {
  if (autoDismissTimer) GLib.source_remove(autoDismissTimer)
  autoDismissTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => {
    setTaskPopupVisible(false)
    autoDismissTimer = 0
    return GLib.SOURCE_REMOVE
  })
}

taskPopupVisible.subscribe((visible) => {
  if (visible) scheduleAutoDismiss()
})

export default function TaskPopupWindow(gdkMonitor: number) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible={taskPopupVisible}
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => {
        const keyval = event.get_keyval()[1]
        if (keyval === Gdk.KEY_Escape) {
          setTaskPopupVisible(false)
          return true
        }
        return false
      }}
    >
      <box name="task-popup-overlay" expand hexpand vexpand>
        <box hexpand />
        <box vertical>
          <box vexpand />
          <box name="task-popup-panel" vertical>
            <label name="task-popup-label" label="UP NEXT" />
            <label
              name="task-popup-title"
              label={taskPopupTitle.as((t) => t.toUpperCase())}
            />
            <label name="task-popup-hint" label="ESC TO DISMISS" />
          </box>
          <box vexpand />
        </box>
        <box hexpand />
      </box>
    </window>
  )
}

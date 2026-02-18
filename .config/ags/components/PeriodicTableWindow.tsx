import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { periodicTableVisible, setPeriodicTableVisible } from "../state"
import PeriodicTable from "./PeriodicTable"
import Gdk from "gi://Gdk?version=3.0"
import Gtk from "gi://Gtk?version=3.0"

export default function PeriodicTableWindow(gdkMonitor: number) {
  return (
    <window
      visible={periodicTableVisible}
      monitor={gdkMonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
      layer={Astal.Layer.TOP}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT}
      marginLeft={100}
      marginTop={100}
      onKeyPressEvent={(_, event) => {
        const keyval = event.get_keyval()[1]
        if (keyval === Gdk.KEY_Escape) {
          setPeriodicTableVisible(false)
          return true
        }
        return false
      }}
    >
      <box name="periodic-table-window" vertical>
        {/* Header with close button */}
        <box name="periodic-header">
          <label name="periodic-title" label="Periodic Table" hexpand halign={Gtk.Align.START} />
          <button
            name="close-button"
            onClicked={() => setPeriodicTableVisible(false)}
          >
            <label label="" />
          </button>
        </box>

        {/* Periodic table content */}
        <PeriodicTable />
      </box>
    </window>
  )
}

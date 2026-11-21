import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { periodicTableVisible, setPeriodicTableVisible } from "../state"
import PeriodicTable from "./PeriodicTable"
import Gdk from "gi://Gdk?version=3.0"
import Gtk from "gi://Gtk?version=3.0"

// gdkMonitor may be a literal index or a reactive accessor so the window can
// follow the focused monitor. No anchor → the layer surface is centred.
export default function PeriodicTableWindow(gdkMonitor: number | any) {
  return (
    <window
      name="periodic"
      visible={periodicTableVisible}
      monitor={gdkMonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
      layer={Astal.Layer.TOP}
      onKeyPressEvent={(_, event) => {
        const keyval = event.get_keyval()[1]
        if (keyval === Gdk.KEY_Escape) {
          setPeriodicTableVisible(false)
          return true
        }
        return false
      }}
    >
      <box name="pt-window" vertical>
        <box name="pt-header">
          <label name="pt-title" label="//PERIODIC TABLE" />
          <label name="pt-subtitle" label="118 ELEMENTS · IUPAC STANDARD ATOMIC WEIGHTS" hexpand xalign={0} />
          <button name="pt-close" valign={Gtk.Align.CENTER} onClicked={() => setPeriodicTableVisible(false)}>
            <label label={"\u{f0156}"} />
          </button>
        </box>
        <PeriodicTable />
      </box>
    </window>
  )
}

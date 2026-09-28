// Settings page: screen layout and Bluetooth. The Displays and
// Bluetooth panels each have a pop-out button (󰁌) that opens their full
// overlay window.

import Gtk from "gi://Gtk?version=3.0"
import BluetoothPanel from "./BluetoothPanel"
import { toggleSettings } from "../state"
import { DisplaysPanel } from "./DisplayLayout"

export default function Settings() {
  return (
    <box vertical name="home-page">
      <box>
        <label name="section-header" label="//SETTINGS" hexpand halign={Gtk.Align.START} />
        <button name="core-reload-btn" tooltipText="Open Settings (SUPER+,)" onClicked={() => toggleSettings()}>
          <label label={"\u{f013}"} />
        </button>
      </box>
      <DisplaysPanel />
      <BluetoothPanel />
    </box>
  )
}

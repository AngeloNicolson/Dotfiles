import Gtk from "gi://Gtk?version=3.0"

export default function Calendar() {
  return (
    <box class="calendar-popup">
      <Gtk.Calendar />
    </box>
  )
}

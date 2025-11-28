import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { barVisible, toggleBar } from "../state"
import Sidebar from "./Sidebar"

export default function Bar(monitor = 0) {
  const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor

  return (
    <window
      visible
      monitor={monitor}
      anchor={TOP | LEFT | BOTTOM}
      application={app}
    >
      <box>
        <revealer
          revealChild={barVisible}
          transitionType="slide_right"
          transitionDuration={300}
        >
          <Sidebar />
        </revealer>
        <eventbox onButtonPressEvent={() => toggleBar()}>
          <box name="edge-strip" />
        </eventbox>
      </box>
    </window>
  )
}

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { barVisible, sidebarPinned } from "../state"
import Sidebar from "./Sidebar"

export default function Bar(gdkMonitor: number, monitorName: string) {
  const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor

  return (
    <window
      visible
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM}
      exclusivity={sidebarPinned.as((p) => p ? Astal.Exclusivity.EXCLUSIVE : Astal.Exclusivity.NORMAL)}
      application={app}
      keymode={Astal.Keymode.ON_DEMAND}
    >
      <box>
        <revealer
          revealChild={barVisible}
          transitionType="slide_right"
          transitionDuration={300}
        >
          <Sidebar monitorName={monitorName} />
        </revealer>
      </box>
    </window>
  )
}

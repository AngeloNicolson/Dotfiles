import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { breakPopupVisible, setBreakPopupVisible } from "../state"
import { secondsRemaining, currentBlock, totalBlocks, studyBlockMode } from "./Pomodoro"
import Gdk from "gi://Gdk?version=3.0"

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export default function BreakPopupWindow(gdkMonitor: number) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible={breakPopupVisible}
      monitor={gdkMonitor}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => {
        const keyval = event.get_keyval()[1]
        if (keyval === Gdk.KEY_Escape) {
          setBreakPopupVisible(false)
          return true
        }
        return false
      }}
    >
      <box name="break-popup-overlay" expand hexpand vexpand>
        <box hexpand />
        <box vertical>
          <box vexpand />
          <box name="break-popup-panel" vertical>
            <label name="break-popup-title" label="BREAK TIME" />
            <label
              name="break-popup-timer"
              label={secondsRemaining.as((s) => formatTime(s))}
            />
            <label
              name="break-popup-block-label"
              label={currentBlock.as((cb) => {
                if (!studyBlockMode.get()) return ""
                return `BLOCK ${cb + 1} / ${totalBlocks.get()}`
              })}
            />
            <label name="break-popup-hint" label="PRESS ESC TO DISMISS" />
          </box>
          <box vexpand />
        </box>
        <box hexpand />
      </box>
    </window>
  )
}

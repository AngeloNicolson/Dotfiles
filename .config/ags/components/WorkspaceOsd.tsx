import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { createState } from "ags"
import AstalHyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"

// Brief HUD readout showing which workspace just came up. Listens to raw
// Hyprland socket2 events so special-workspace toggles are caught too
// (they don't always fire notify::focused-workspace).

const HOLD_MS = 1200

// Special workspace name -> display label
const SPECIAL_LABELS: Record<string, string> = {
  nvim: "CODE",
  browser: "BROWSER",
  document: "DOCS",
  media: "MEDIA",
  kondor: "KONDOR",
}

const [osdLabel, setOsdLabel] = createState("")
const [osdVisible, setOsdVisible] = createState(false)

let hideTimer = 0

function flash(label: string) {
  setOsdLabel(label)
  setOsdVisible(true)
  if (hideTimer) GLib.source_remove(hideTimer)
  hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOLD_MS, () => {
    setOsdVisible(false)
    hideTimer = 0
    return GLib.SOURCE_REMOVE
  })
}

function initListener() {
  const hyprland = AstalHyprland.get_default()
  hyprland.connect("event", (_h, event: string, args: string) => {
    if (event === "workspacev2") {
      // args: "ID,NAME"
      const name = args.split(",")[1] ?? ""
      if (name) flash(`WS ${name}`)
    } else if (event === "activespecial") {
      // args: "NAME,MONITOR" — NAME is empty when the overlay closes
      const raw = args.split(",")[0] ?? ""
      if (!raw) return
      const key = raw.replace(/^special:/, "")
      flash(SPECIAL_LABELS[key] ?? key.toUpperCase())
    }
  })
}

export default function WorkspaceOsdWindow(gdkMonitor: number | any) {
  initListener()
  const { TOP } = Astal.WindowAnchor

  return (
    <window
      visible
      monitor={gdkMonitor}
      anchor={TOP}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      layer={Astal.Layer.OVERLAY}
      application={app}
      namespace="workspace_osd"
    >
      <revealer
        revealChild={osdVisible}
        transitionType="slide_down"
        transitionDuration={180}
      >
        <box name="ws-osd">
          <label name="ws-osd-brackets" label="◢" />
          <label name="ws-osd-label" label={osdLabel} />
          <label name="ws-osd-brackets" label="◣" />
        </box>
      </revealer>
    </window>
  )
}

// Small pieces shared by the FRAME rail and the SHIELD top bar: workspace pips,
// a clock, and status glyphs (volume, Bluetooth, Wi-Fi, battery).
// Each takes `vertical` so the same widget works on a side rail or a top bar.

import Gtk from "gi://Gtk?version=3.0"
import Gdk from "gi://Gdk?version=3.0"
import GLib from "gi://GLib"
import { createRoot, createBinding } from "gnim"
import { createPoll } from "ags/time"
import Wp from "gi://AstalWp"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import Battery from "gi://AstalBattery"
import * as compositor from "../compositor"
import { toggleBluetoothWindow, toggleSettings } from "../state"

export function Workspaces({ vertical = false }: { vertical?: boolean }) {
  const box = (<box name="bw-workspaces" vertical={vertical} />) as Gtk.Box
  let dispose: (() => void) | null = null
  const build = () => {
    dispose?.()
    box.get_children().forEach((c) => c.destroy())
    const focused = compositor.getFocusedWorkspaceId()
    // Always show 1..7 (it's always 7) so the strip doesn't jitter, plus any higher ones in use.
    const ids = Array.from(new Set([1, 2, 3, 4, 5, 6, 7, ...compositor.getWorkspaceIds()])).sort((a, b) => a - b)
    const used = new Set(compositor.getWorkspaceIds())
    createRoot((d) => {
      dispose = d
      for (const id of ids) {
        const cls = id === focused ? "active" : used.has(id) ? "occupied" : ""
        box.add(
          <button name="bw-ws" class={cls} tooltipText={id === 7 ? "Workspace 7 · it's always 7" : `Workspace ${id}`}
            onClicked={() => compositor.focusWorkspace(id)}>
            <box name="bw-ws-pip" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
          </button> as Gtk.Widget)
      }
    })
    box.show_all()
  }
  build()
  const off = compositor.onWorkspacesChanged(() =>
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => { build(); return GLib.SOURCE_REMOVE }))
  box.connect("destroy", () => off())
  return box
}

const now = (fmt: string) => GLib.DateTime.new_now_local().format(fmt) ?? ""

export function Clock({ vertical = false }: { vertical?: boolean }) {
  const hh = createPoll(now("%H"), 1000, () => now("%H"))
  const mm = createPoll(now("%M"), 1000, () => now("%M"))
  if (vertical) {
    return (
      <box name="bw-clock" vertical>
        <label name="bw-clock-h" label={hh} />
        <label name="bw-clock-m" label={mm} />
      </box>
    )
  }
  const date = createPoll(now("%a %d"), 30000, () => now("%a %d").toUpperCase())
  return (
    <box name="bw-clock">
      <label name="bw-clock-h" label={hh.as((h) => `${h}:`)} />
      <label name="bw-clock-m" label={mm} />
      <label name="bw-clock-date" label={date} />
    </box>
  )
}

function Glyph({ icon, tip, onClick, cls }: {
  icon: any, tip: any, onClick: () => void, cls?: any,
}) {
  return (
    <button name="bw-glyph" class={cls ?? ""} tooltipText={tip} onClicked={onClick}>
      <label label={icon} />
    </button>
  )
}

function VolumeGlyph() {
  const speaker = Wp.get_default()?.audio?.default_speaker
  if (!speaker) return <box />
  const vol = createBinding(speaker, "volume")
  const mute = createBinding(speaker, "mute")
  const icon = mute.as((m) => m ? "\u{f075f}" : "\u{f057e}")
  return (
    <eventbox onScrollEvent={(_s, e) => {
      // Wheel clicks report a direction; smooth scrolling (touchpad, hi-res
      // wheels) reports only deltas, with direction SMOOTH.
      const [hasDir, dir] = e.get_scroll_direction()
      let up: boolean
      if (hasDir && dir !== Gdk.ScrollDirection.SMOOTH) {
        if (dir !== Gdk.ScrollDirection.UP && dir !== Gdk.ScrollDirection.DOWN) return false
        up = dir === Gdk.ScrollDirection.UP
      } else {
        const [, , dy] = e.get_scroll_deltas()
        if (dy === 0) return true
        up = dy < 0
      }
      speaker.volume = Math.max(0, Math.min(1.5, speaker.volume + (up ? 0.05 : -0.05)))
      return true
    }}>
      <Glyph icon={icon} cls={mute.as((m) => m ? "dim" : "")}
        tip={vol.as((v) => `Volume ${Math.round(v * 100)}% (scroll to change, click to mute)`)}
        onClick={() => { speaker.mute = !speaker.mute }} />
    </eventbox>
  )
}

function BluetoothGlyph() {
  const bt = Bluetooth.get_default()
  if (!bt?.adapter) return <box />
  const connected = createBinding(bt, "is_connected")
  const powered = createBinding(bt.adapter, "powered")
  return <Glyph icon={connected.as((c) => c ? "\u{f00b1}" : "\u{f00af}")}
    cls={powered.as((p) => p ? "" : "dim")}
    tip="Bluetooth" onClick={() => toggleBluetoothWindow()} />
}

function WifiGlyph() {
  const wifi = Network.get_default()?.wifi
  if (!wifi) return <box />
  const ssid = createBinding(wifi, "ssid")
  const enabled = createBinding(wifi, "enabled")
  return <Glyph icon={enabled.as((e) => e ? "\u{f05a9}" : "\u{f05aa}")}
    cls={enabled.as((e) => e ? "" : "dim")}
    tip={ssid.as((s) => s ? `Wi-Fi: ${s}` : "Wi-Fi")} onClick={() => toggleSettings("network")} />
}

function BatteryGlyph({ vertical }: { vertical: boolean }) {
  const bat = Battery.get_default()
  if (!bat?.is_present) return <box />
  const pct = createBinding(bat, "percentage").as((p) => Math.round(p * 100))
  const charging = createBinding(bat, "charging")
  return (
    <box name="bw-battery" vertical={vertical} class={pct.as((p) => p <= 20 ? "low" : "")}>
      <label name="bw-battery-icon" label={charging.as((c) => c ? "\u{f0084}" : "\u{f0079}")} />
      <label name="bw-battery-pct" label={pct.as((p) => `${p}`)} />
    </box>
  )
}

export function StatusGlyphs({ vertical = false }: { vertical?: boolean }) {
  return (
    <box name="bw-status" vertical={vertical}>
      <VolumeGlyph />
      <BluetoothGlyph />
      <WifiGlyph />
      <BatteryGlyph vertical={vertical} />
    </box>
  )
}

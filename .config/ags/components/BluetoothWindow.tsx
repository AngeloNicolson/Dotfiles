// Bluetooth manager overlay — the pop-out version of the Home page's
// BluetoothPanel: adapter switches (power / visible / pairable / scan), every
// device with connect, trust, re-pair and forget, and the audio profile
// (hi-fi vs. call mode) of connected headsets.
// Opened from the ⤢ button in the Home BLUETOOTH panel or
// `ags request toggle-bluetooth`.

import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"
import { execAsync } from "ags/process"
import { createRoot } from "gnim"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=3.0"
import Gtk from "gi://Gtk?version=3.0"
import Bluetooth from "gi://AstalBluetooth"
import { bluetoothWindowVisible, setBluetoothWindowVisible, bluetoothPlacement, barVisible } from "../state"
import { makeClip, preparePanel, openPanel, closePanel, clickedOutside, registerCloser, closeFlyout } from "../flyout"
import { px } from "../scale"
import {
  listable, deviceSortKey, deviceClass, toggleDevice, forgetDevice, repairDevice,
} from "./BluetoothPanel"

function deviceIcon(dev: Bluetooth.Device): string {
  const i = dev.icon || ""
  if (/headset|headphone|audio/.test(i)) return "󰋋"
  if (/phone/.test(i)) return "󰏲"
  if (/keyboard/.test(i)) return "󰌌"
  if (/mouse/.test(i)) return "󰍽"
  if (/gaming|joystick/.test(i)) return "󰊴"
  if (/computer/.test(i)) return "󰍹"
  return "󰂯"
}

function statusLine(dev: Bluetooth.Device): string {
  const bits: string[] = []
  if (dev.connecting) bits.push("LINKING…")
  else if (dev.connected) bits.push("CONNECTED")
  else if (dev.paired) bits.push("PAIRED")
  else bits.push("NEW")
  if (dev.connected && dev.battery_percentage > 0) bits.push(`${Math.round(dev.battery_percentage * 100)}%`)
  if (dev.trusted) bits.push("TRUSTED")
  if (dev.blocked) bits.push("BLOCKED")
  return bits.join(" · ")
}

// pactl card for a BT device: bluez_card.8C_0D_D9_E6_A1_68
interface Card { name: string, active: string, profiles: { id: string, desc: string, available: boolean }[] }

async function audioCard(addr: string): Promise<Card | null> {
  try {
    const cards: any[] = JSON.parse(await execAsync(["pactl", "-f", "json", "list", "cards"]))
    const c = cards.find((c) => c.name === `bluez_card.${addr.replace(/:/g, "_")}`)
    if (!c) return null
    return {
      name: c.name,
      active: c.active_profile,
      profiles: Object.entries(c.profiles ?? {})
        .filter(([id]) => id !== "off")
        .map(([id, p]: [string, any]) => ({ id, desc: p.description ?? id, available: p.available !== false })),
    }
  } catch {
    return null
  }
}

// "a2dp-sink-aac" → "HI-FI (AAC)", "headset-head-unit-msbc" → "CALL + MIC (mSBC)"
function profileLabel(id: string): string {
  const codec = id.match(/-(sbc_xq|sbc|aac|aptx_hd|aptx_ll|aptx|ldac|lc3|msbc|cvsd|opus.*)$/)?.[1]
  const base = id.startsWith("a2dp") ? "HI-FI" : id.startsWith("headset") ? "CALL + MIC" : id.toUpperCase()
  return codec ? `${base} (${codec.toUpperCase()})` : base
}

// `active`: when embedded (Settings → Bluetooth), whether that page is showing.
export function BluetoothManager(active?: () => boolean) {
  const shown = () => bluetoothWindowVisible.get() || (active?.() ?? false)
  const bluetooth = Bluetooth.get_default()
  const adapter = bluetooth?.adapter ?? null

  const adapterRow = (<box name="btw-adapter-row" />) as Gtk.Box
  const listBox = (<box name="btw-list" vertical />) as Gtk.Box
  const notice = (<label name="btw-notice" label="" xalign={0} hexpand wrap />) as Gtk.Label

  const scroll = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    propagate_natural_height: true,
    max_content_height: px(460),
  })
  scroll.add(listBox)
  scroll.show_all()

  let noticeTimer = 0
  function setNotice(text: string, clearAfterMs = 0) {
    if (noticeTimer) { GLib.source_remove(noticeTimer); noticeTimer = 0 }
    notice.set_label(text)
    if (text && clearAfterMs) {
      noticeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, clearAfterMs, () => {
        noticeTimer = 0
        notice.set_label("")
        return GLib.SOURCE_REMOVE
      })
    }
  }

  // Profile rows are filled in async after pactl answers; keyed by address.
  const cards = new Map<string, Card | null>()
  function refreshCards() {
    if (!bluetooth) return
    const connected = bluetooth.get_devices().filter((d) => d.connected)
    Promise.all(connected.map(async (d) => [d.address, await audioCard(d.address)] as const))
      .then((pairs) => {
        const before = JSON.stringify([...cards])
        cards.clear()
        for (const [addr, c] of pairs) cards.set(addr, c)
        if (JSON.stringify([...cards]) !== before) scheduleRebuild()
      })
  }

  function toggleBtn(label: string, on: boolean, onClick: () => void, tip: string): Gtk.Widget {
    return (
      <button name="displays-toggle" class={on ? "active" : ""} hexpand tooltipText={tip} onClicked={onClick}>
        <label label={`${label}  ${on ? "ON" : "OFF"}`} />
      </button>
    ) as Gtk.Widget
  }

  function buildAdapterRow() {
    if (!adapter) return
    const safe = (fn: () => void) => () => { try { fn() } catch (e) { setNotice(`FAILED: ${String(e).slice(0, 60)}`, 6000) } }
    adapterRow.add(toggleBtn("POWER", adapter.powered, safe(() => adapter.set_powered(!adapter.powered)),
      "Bluetooth radio on/off"))
    adapterRow.add(toggleBtn("VISIBLE", adapter.discoverable, safe(() => adapter.set_discoverable(!adapter.discoverable)),
      "Let other devices find this laptop (for pairing from a phone)"))
    adapterRow.add(toggleBtn("PAIRABLE", adapter.pairable, safe(() => adapter.set_pairable(!adapter.pairable)),
      "Accept incoming pairing requests"))
    adapterRow.add(toggleBtn("SCAN", adapter.discovering, safe(() => {
      if (!adapter.powered) adapter.set_powered(true)
      if (adapter.discovering) adapter.stop_discovery()
      else adapter.start_discovery()
    }), "Search for new devices (put the device in pairing mode first)"))
  }

  function actionBtn(label: string, tip: string, onClick: () => void, cls = ""): Gtk.Widget {
    return (
      <button name="btw-action" class={cls} tooltipText={tip} onClicked={onClick}>
        <label label={label} />
      </button>
    ) as Gtk.Widget
  }

  // Two-click forget: first click arms it for 3s, second click removes.
  let armedForget = ""
  let armTimer = 0
  function forgetBtn(dev: Bluetooth.Device): Gtk.Widget {
    const armed = armedForget === dev.address
    return actionBtn(armed ? "󰅖 SURE?" : "󰅖 FORGET",
      dev.paired ? "Unpair and remove this device" : "Remove this device from the list",
      () => {
        if (armTimer) { GLib.source_remove(armTimer); armTimer = 0 }
        if (armed) {
          armedForget = ""
          forgetDevice(dev, adapter!)
          setNotice(`FORGOT ${(dev.alias || dev.address).toUpperCase()}`, 4000)
        } else {
          armedForget = dev.address
          armTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
            armTimer = 0
            armedForget = ""
            scheduleRebuild()
            return GLib.SOURCE_REMOVE
          })
        }
        scheduleRebuild()
      }, armed ? "forget armed" : "forget")
  }

  function buildList() {
    if (!bluetooth || !adapter) {
      listBox.add(<label name="btw-empty" label="NO BLUETOOTH ADAPTER" /> as Gtk.Widget)
      return
    }
    if (!adapter.powered) {
      listBox.add(<label name="btw-empty" label="BLUETOOTH IS OFF — TURN ON POWER ABOVE" /> as Gtk.Widget)
      return
    }
    const devices = bluetooth.get_devices()
      .filter(listable)
      .sort((a, b) =>
        deviceSortKey(a) - deviceSortKey(b) ||
        (a.alias || a.address).localeCompare(b.alias || b.address))
    if (devices.length === 0) {
      listBox.add(<label name="btw-empty" label="NO DEVICES — HIT SCAN AND PUT YOUR DEVICE IN PAIRING MODE" /> as Gtk.Widget)
    }

    for (const dev of devices) {
      const card = (<box name="btw-device" class={deviceClass(dev)} vertical />) as Gtk.Box
      const top = (<box />) as Gtk.Box
      top.add(<label name="btw-icon" label={deviceIcon(dev)} /> as Gtk.Widget)
      top.add(
        <box vertical hexpand>
          <label name="btw-name" label={dev.alias || dev.name || dev.address} xalign={0} />
          <label name="btw-meta" label={`${dev.address}  ·  ${statusLine(dev)}`} xalign={0} />
        </box> as Gtk.Widget)

      const actions = (<box name="btw-actions" />) as Gtk.Box
      const err = (m: string) => setNotice(m, 10000)
      if (dev.paired) {
        actions.add(actionBtn(dev.connected ? "DISCONNECT" : "CONNECT",
          dev.connected ? "Disconnect" : "Connect",
          () => toggleDevice(dev, adapter, err), dev.connected ? "" : "primary"))
        actions.add(actionBtn(dev.trusted ? "TRUSTED" : "TRUST",
          "Trusted devices may reconnect on their own",
          () => { try { dev.set_trusted(!dev.trusted) } catch (e) { err(`TRUST FAILED: ${e}`) } },
          dev.trusted ? "on" : ""))
        actions.add(actionBtn("󰑐 RE-PAIR",
          "Forget and pair fresh — fixes 'key missing' after using the device on Windows",
          () => repairDevice(dev, adapter, setNotice), "repair"))
      } else {
        actions.add(actionBtn("PAIR", "Pair and connect (device must be in pairing mode)",
          () => toggleDevice(dev, adapter, err), "primary"))
      }
      actions.add(forgetBtn(dev))
      top.add(actions)
      card.add(top)

      // Audio profile switcher for connected headsets
      const c = dev.connected ? cards.get(dev.address) : null
      if (c && c.profiles.length > 1) {
        const prow = (<box name="btw-profiles" />) as Gtk.Box
        prow.add(<label name="btw-profile-label" label="AUDIO" /> as Gtk.Widget)
        for (const p of c.profiles) {
          prow.add(
            <button
              name="btw-action"
              class={p.id === c.active ? "on" : ""}
              sensitive={p.available}
              tooltipText={p.desc}
              onClicked={() => {
                execAsync(["pactl", "set-card-profile", c.name, p.id])
                  .then(() => { c.active = p.id; scheduleRebuild() })
                  .catch((e) => err(`PROFILE FAILED: ${String(e).slice(0, 50)}`))
              }}
            >
              <label label={profileLabel(p.id)} />
            </button> as Gtk.Widget)
        }
        card.add(prow)
      }
      listBox.add(card)
    }
  }

  let rootDispose: (() => void) | null = null
  function rebuild() {
    rootDispose?.()  // before destroying: its cleanup touches the old widgets
    for (const box of [adapterRow, listBox]) box.get_children().forEach((c) => c.destroy())
    createRoot((dispose) => {
      rootDispose = dispose
      buildAdapterRow()
      buildList()
    })
    adapterRow.show_all()
    listBox.show_all()
  }

  let rebuildTimer = 0
  function scheduleRebuild() {
    if (rebuildTimer || !shown()) return
    rebuildTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
      rebuildTimer = 0
      rebuild()
      return GLib.SOURCE_REMOVE
    })
  }

  const DEVICE_NOTIFIES = [
    "notify::paired", "notify::name", "notify::alias", "notify::connected",
    "notify::connecting", "notify::trusted", "notify::battery-percentage",
  ]
  const hooked = new WeakSet<Bluetooth.Device>()
  function hookDevices() {
    for (const d of bluetooth?.get_devices() ?? []) {
      if (hooked.has(d)) continue
      hooked.add(d)
      for (const sig of DEVICE_NOTIFIES) d.connect(sig, scheduleRebuild)
      d.connect("notify::connected", () => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => { refreshCards(); return GLib.SOURCE_REMOVE }))
    }
  }
  if (bluetooth) {
    bluetooth.connect("device-added", () => { hookDevices(); scheduleRebuild() })
    bluetooth.connect("device-removed", scheduleRebuild)
    hookDevices()
  }
  if (adapter) {
    for (const sig of ["notify::powered", "notify::discoverable", "notify::pairable", "notify::discovering"])
      adapter.connect(sig, scheduleRebuild)
  }

  function show() {
    hookDevices()
    refreshCards()
    rebuild()
  }
  function hide() {
    // Don't leave a scan running in the background
    try { if (adapter?.discovering) adapter.stop_discovery() } catch {}
  }
  if (!active) bluetoothWindowVisible.subscribe(() => bluetoothWindowVisible.get() ? show() : hide())

  const title = adapter ? `${adapter.alias || adapter.name}  ·  ${adapter.address}` : ""

  const widget = (
    <box name="displays-panel" class={active ? "btw-panel embedded" : "btw-panel"} vertical>
      <box>
        <label name="section-header" label="//BLUETOOTH" xalign={0} />
        <label name="btw-adapter" label={title} xalign={1} hexpand />
      </box>
      {adapterRow}
      {scroll}
      <label
        name="btw-hint"
        label={"Headset won't connect (\"key missing\")? Hit RE-PAIR, then hold an earbud ~3s until \"Ready to pair\".\n" +
          "Also use it on Windows? Pair here first, then on Windows, then run  sudo bt-winkey-sync  back on Linux."}
        xalign={0}
        wrap
      />
      <box name="displays-actions">
        {notice}
        {active ? <box /> : (
          <button name="displays-btn" onClicked={() => closeFlyout("bluetooth", () => setBluetoothWindowVisible(false))}>
            <label label="CLOSE" />
          </button>
        )}
      </box>
    </box>
  ) as Gtk.Widget

  return { widget, show, hide }
}

export default function BluetoothWindow(gdkMonitor: number | any) {
  const { TOP, LEFT, BOTTOM, RIGHT } = Astal.WindowAnchor
  const focusedMonitor = () => typeof gdkMonitor === "number" ? gdkMonitor : gdkMonitor.get()
  const panel = BluetoothManager().widget
  const clip = makeClip(panel)
  const close = () => closeFlyout("bluetooth", () => setBluetoothWindowVisible(false))

  let closing = false
  registerCloser("bluetooth", () => {
    if (closing || !bluetoothWindowVisible.get()) return
    closing = true
    closePanel(clip, bluetoothPlacement.get(), () => { closing = false; setBluetoothWindowVisible(false) })
  })

  const frame = (
    <eventbox
      name="displays-overlay"
      expand hexpand vexpand
      onButtonPressEvent={(self, event) => {
        // Flyout: a click beside it closes it.
        if (bluetoothPlacement.get().x !== undefined && clickedOutside(clip, self, event)) {
          close()
          return true
        }
        return false
      }}
    >
      <box>{clip}</box>
    </eventbox>
  ) as Gtk.Widget

  bluetoothPlacement.subscribe(() => preparePanel(frame, clip, panel, bluetoothPlacement.get()))
  // Grown out of the sidebar → goes away with it.
  barVisible.subscribe(() => {
    if (!barVisible.get() && bluetoothWindowVisible.get() && bluetoothPlacement.get().x !== undefined) close()
  })
  bluetoothWindowVisible.subscribe(() => {
    if (!bluetoothWindowVisible.get()) return
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      openPanel(frame, clip, panel, bluetoothPlacement.get())
      return GLib.SOURCE_REMOVE
    })
  })

  return (
    <window
      name="bluetooth"
      visible={bluetoothWindowVisible}
      monitor={bluetoothPlacement.as((p) => p.monitor ?? focusedMonitor())}
      anchor={TOP | LEFT | BOTTOM | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      layer={Astal.Layer.OVERLAY}
      onKeyPressEvent={(_, event) => {
        if (event.get_keyval()[1] !== Gdk.KEY_Escape) return false
        close()
        return true
      }}
    >
      {frame}
    </window>
  )
}

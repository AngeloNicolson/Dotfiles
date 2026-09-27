import Gtk from "gi://Gtk?version=3.0"
import GLib from "gi://GLib"
import Bluetooth from "gi://AstalBluetooth"
import { execAsync } from "ags/process"
import { px } from "../scale"
import { toggleBluetoothWindow } from "../state"

// Devices with no name (bare addresses) are ambient BLE noise during a scan;
// only paired ones are worth listing without a name.
export function listable(dev: Bluetooth.Device): boolean {
  return dev.paired || !!dev.name
}

export function deviceSortKey(dev: Bluetooth.Device): number {
  if (dev.connected) return 0
  if (dev.paired) return 1
  return 2
}

export function deviceStatus(dev: Bluetooth.Device): string {
  if (dev.connecting) return "LINKING…"
  if (dev.connected) {
    const b = dev.battery_percentage
    return b > 0 ? `◆ ${Math.round(b * 100)}%` : "◆ LINK"
  }
  return dev.paired ? "PAIRED" : "NEW"
}

export function deviceClass(dev: Bluetooth.Device): string {
  if (dev.connected) return "connected"
  if (dev.connecting) return "connecting"
  return ""
}

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/^.*org\.bluez\.Error\./, "").replace(/\s+/g, " ").trim().substring(0, 40)
}

export function toggleDevice(
  dev: Bluetooth.Device,
  adapter: Bluetooth.Adapter,
  onError: (msg: string) => void = () => {},
) {
  // BlueZ misbehaves when connecting mid-discovery
  try { if (adapter.discovering) adapter.stop_discovery() } catch {}

  if (dev.connected) {
    dev.disconnect_device((_d, res) => {
      try { dev.disconnect_device_finish(res) } catch (e) {
        console.error("BT disconnect failed:", e)
        onError(`DISCONNECT FAILED: ${errText(e)}`)
      }
    })
  } else if (dev.paired) {
    dev.connect_device((_d, res) => {
      try { dev.connect_device_finish(res) } catch (e) {
        console.error("BT connect failed:", e)
        const msg = errText(e)
        // Link key rejected — usually re-paired on the Windows dual-boot or reset.
        onError(/key-missing|Permission denied/i.test(msg)
          ? "PAIRING KEY STALE — HIT RE-PAIR 󰑐"
          : `CONNECT FAILED: ${msg}`)
      }
    })
  } else {
    // bluetoothctl brings its own agent, which unpaired devices need
    const addr = dev.address
    execAsync(["bash", "-c",
      `bluetoothctl pair ${addr} && bluetoothctl trust ${addr}; bluetoothctl connect ${addr}`,
    ]).catch((e) => {
      console.error("BT pair/connect failed:", e)
      const msg = errText(e)
      onError(/Authentication/i.test(msg)
        ? "PAIR REFUSED — PUT HEADSET IN PAIRING MODE"
        : `PAIR FAILED: ${msg}`)
    })
  }
}

export function forgetDevice(dev: Bluetooth.Device, adapter: Bluetooth.Adapter) {
  try { if (adapter.discovering) adapter.stop_discovery() } catch {}
  try { adapter.remove_device(dev) } catch (e) {
    console.error("BT forget failed:", e)
  }
}

// Pair/trust retry loop: the device only becomes pairable once the user puts
// it in pairing mode and discovery finds it again, so poll for ~60s.
export const REPAIR_SCRIPT = `
addr="$1"
for _ in $(seq 1 12); do
  bluetoothctl pair "$addr" && bluetoothctl trust "$addr" && exit 0
  sleep 5
done
exit 1`

// Forget the bond on our side, rediscover, and pair fresh. Fixes the
// "br-connection-key-missing" state a headset lands in after being paired
// on another OS sharing this adapter (dual-boot).
let repairing = false
export function repairDevice(
  dev: Bluetooth.Device,
  adapter: Bluetooth.Adapter,
  setNotice: (text: string, clearAfterMs?: number) => void,
) {
  if (repairing) return
  repairing = true
  const addr = dev.address
  const name = (dev.alias || dev.name || addr).substring(0, 20)
  forgetDevice(dev, adapter)
  setNotice(`PUT ${name.toUpperCase()} IN PAIRING MODE…`)
  try { adapter.set_pairable(true) } catch {}
  try { adapter.start_discovery() } catch (e) { console.error("BT discovery failed:", e) }

  execAsync(["bash", "-c", REPAIR_SCRIPT, "repair", addr])
    .then(() => {
      // BlueZ misbehaves when connecting mid-discovery
      try { if (adapter.discovering) adapter.stop_discovery() } catch {}
      setNotice(`PAIRED ${name.toUpperCase()} — LINKING…`)
      return execAsync(["bluetoothctl", "connect", addr])
    })
    .then(() => setNotice(`${name.toUpperCase()} READY`, 4000))
    .catch((e) => {
      console.error("BT re-pair failed:", e)
      try { if (adapter.discovering) adapter.stop_discovery() } catch {}
      setNotice(`RE-PAIR FAILED — ${name.toUpperCase()} NOT IN PAIRING MODE?`, 8000)
    })
    .finally(() => { repairing = false })
}

export default function BluetoothPanel() {
  const bluetooth = Bluetooth.get_default()
  const adapter = bluetooth?.adapter ?? null

  if (!adapter) {
    return (
      <box name="eq-panel" vertical>
        <box name="control-header">
          <label name="control-icon" label="󰂲" />
          <label name="control-label" label="BLUETOOTH" />
          <box hexpand />
          <label name="control-value" label="NO ADAPTER" />
        </box>
      </box>
    )
  }

  // Rows carry no gnim bindings (they're built outside a tracking context, so
  // bindings would leak on every rebuild) — instead every relevant device
  // notify triggers a debounced full rebuild. Device counts are tiny.
  const listBox = (<box name="bt-list" vertical />) as Gtk.Box
  // Grows with its rows up to a cap, then scrolls internally — a discovery
  // flood must not push the home page past one screen
  const listScroll = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    propagate_natural_height: true,
    max_content_height: px(120),
  })
  listScroll.add(listBox)
  const hooked = new WeakSet<Bluetooth.Device>()
  let rebuildTimer = 0

  // Transient one-line status under the list (re-pair progress). Managed
  // imperatively; no_show_all keeps the parent's show_all from revealing it.
  const notice = (<label name="bt-notice" label="" halign="start" xalign={0} />) as Gtk.Label
  notice.no_show_all = true
  let noticeTimer = 0
  function setNotice(text: string, clearAfterMs = 0) {
    if (noticeTimer) { GLib.source_remove(noticeTimer); noticeTimer = 0 }
    notice.set_label(text)
    notice.set_visible(!!text)
    if (text && clearAfterMs) {
      noticeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, clearAfterMs, () => {
        noticeTimer = 0
        notice.set_visible(false)
        return GLib.SOURCE_REMOVE
      })
    }
  }

  const repair = (dev: Bluetooth.Device) => repairDevice(dev, adapter!, setNotice)

  const DEVICE_NOTIFIES = [
    "notify::paired", "notify::name", "notify::connected",
    "notify::connecting", "notify::battery-percentage",
  ]

  function rebuild() {
    listBox.get_children().forEach((c) => c.destroy())
    const devices = bluetooth.get_devices()
      .filter(listable)
      .sort((a, b) =>
        deviceSortKey(a) - deviceSortKey(b) ||
        (a.alias || a.address).localeCompare(b.alias || b.address))

    if (devices.length === 0) {
      listBox.add(<label name="bt-empty" label="NO DEVICES — SCAN TO DISCOVER" /> as Gtk.Widget)
    }
    for (const dev of devices) {
      if (!hooked.has(dev)) {
        hooked.add(dev)
        for (const sig of DEVICE_NOTIFIES) dev.connect(sig, scheduleRebuild)
      }
      const row = (<box name="bt-row" />) as Gtk.Box
      row.add(
        <button
          name="bt-device"
          class={deviceClass(dev)}
          hexpand
          onClicked={() => toggleDevice(dev, adapter, (m) => setNotice(m, 8000))}
        >
          <box>
            <label
              name="bt-device-name"
              label={(dev.alias || dev.name || dev.address).substring(0, 24)}
              halign="start"
              hexpand
              xalign={0}
            />
            <label name="bt-device-status" label={deviceStatus(dev)} />
          </box>
        </button> as Gtk.Widget,
      )
      if (dev.paired) {
        row.add(
          <button
            name="bt-device-action"
            class="repair"
            tooltipText="Forget and pair again"
            onClicked={() => repair(dev)}
          >
            <label label="󰑐" />
          </button> as Gtk.Widget,
        )
      }
      row.add(
        <button
          name="bt-device-action"
          class="forget"
          tooltipText="Forget device"
          onClicked={() => forgetDevice(dev, adapter)}
        >
          <label label="󰅖" />
        </button> as Gtk.Widget,
      )
      listBox.add(row)
    }
    listBox.show_all()
  }

  // discovery floods device-added; coalesce rebuilds
  function scheduleRebuild() {
    if (rebuildTimer) return
    rebuildTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      rebuildTimer = 0
      rebuild()
      return GLib.SOURCE_REMOVE
    })
  }

  bluetooth.connect("device-added", scheduleRebuild)
  bluetooth.connect("device-removed", scheduleRebuild)
  rebuild()

  // Scan button updated imperatively for the same no-tracking-context reason
  const scanLabel = (<label name="bt-scan-label" label="SCAN" />) as Gtk.Label
  const scanBtn = (
    <button name="bt-scan-btn" onClicked={() => {
      try {
        if (!adapter.powered) adapter.set_powered(true)
        if (adapter.discovering) adapter.stop_discovery()
        else adapter.start_discovery()
      } catch (e) {
        console.error("BT scan toggle failed:", e)
      }
    }}>
      {scanLabel}
    </button>
  ) as Gtk.Button

  function syncScanBtn() {
    const d = adapter!.discovering
    scanLabel.set_label(d ? "◈ SCANNING" : "SCAN")
    const ctx = scanBtn.get_style_context()
    if (d) ctx.add_class("scanning")
    else ctx.remove_class("scanning")
  }
  adapter.connect("notify::discovering", syncScanBtn)
  syncScanBtn()

  return (
    <box name="eq-panel" vertical>
      <box name="control-header">
        <label name="control-icon" label="󰂯" />
        <label name="control-label" label="BLUETOOTH" />
        <box hexpand />
        {scanBtn}
        <button name="bt-scan-btn" tooltipText="Open Bluetooth manager" onClicked={toggleBluetoothWindow}>
          <label name="bt-scan-label" label="󰁌" />
        </button>
      </box>
      {listScroll}
      {notice}
    </box>
  )
}

// Async BlueZ calls. AstalBluetooth's adapter methods (start/stop_discovery,
// remove_device) and its property setters (powered, discoverable, pairable,
// trusted) are synchronous D-Bus round-trips, and BlueZ can sit on them for
// seconds (powering off with a headset attached, forgetting a device that is
// mid-connect) — long enough to freeze the whole shell. Everything here goes
// through Gio.DBusConnection.call() and resolves on the main loop instead.
// The Astal objects still pick up the result via PropertiesChanged, so the
// existing notify:: hooks keep working.

import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Bluetooth from "gi://AstalBluetooth"

const BLUEZ = "org.bluez"
const ADAPTER_IFACE = "org.bluez.Adapter1"
const DEVICE_IFACE = "org.bluez.Device1"
const PROPS_IFACE = "org.freedesktop.DBus.Properties"

function call(path: string, iface: string, method: string,
  params: GLib.Variant | null = null, timeoutMs = 60_000): Promise<GLib.Variant> {
  return new Promise((resolve, reject) => {
    Gio.DBus.system.call(BLUEZ, path, iface, method, params, null,
      Gio.DBusCallFlags.NONE, timeoutMs, null, (conn, res) => {
        try { resolve(conn!.call_finish(res)) } catch (e) { reject(e) }
      })
  })
}

function setProp(path: string, iface: string, prop: string, value: GLib.Variant): Promise<void> {
  return call(path, PROPS_IFACE, "Set", new GLib.Variant("(ssv)", [iface, prop, value])).then(() => {})
}

// Strip the D-Bus noise off a BlueZ error for the notice line.
export function bluezError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m
    .replace(/^.*org\.bluez\.Error\./, "")
    .replace(/^GDBus\.Error:[^:]*:\s*/, "")
    .replace(/\s+/g, " ").trim().substring(0, 40)
}

// Astal's Adapter doesn't carry its object path; devices do (dev.adapter).
// With no device known yet, ask BlueZ's ObjectManager, matching on address.
let adapterPath: string | null = null
async function pathOf(adapter: Bluetooth.Adapter): Promise<string> {
  if (adapterPath) return adapterPath
  const fromDevice = Bluetooth.get_default()?.get_devices()[0]?.adapter
  if (fromDevice) return (adapterPath = fromDevice)
  try {
    const [objects] = (await call("/", "org.freedesktop.DBus.ObjectManager", "GetManagedObjects"))
      .recursiveUnpack() as [Record<string, Record<string, Record<string, unknown>>>]
    for (const [path, ifaces] of Object.entries(objects)) {
      if (ifaces[ADAPTER_IFACE]?.Address === adapter.address) return (adapterPath = path)
    }
  } catch (e) {
    console.error("bluez: GetManagedObjects failed:", e)
  }
  return "/org/bluez/hci0"
}

function devicePath(dev: Bluetooth.Device): string {
  return `${dev.adapter}/dev_${dev.address.replace(/:/g, "_")}`
}

export async function setAdapterProp(adapter: Bluetooth.Adapter,
  prop: "Powered" | "Discoverable" | "Pairable", on: boolean): Promise<void> {
  await setProp(await pathOf(adapter), ADAPTER_IFACE, prop, new GLib.Variant("b", on))
}

export async function startDiscovery(adapter: Bluetooth.Adapter): Promise<void> {
  if (adapter.discovering) return
  await call(await pathOf(adapter), ADAPTER_IFACE, "StartDiscovery")
}

// Quiet when nothing was running: BlueZ answers "No discovery started".
export async function stopDiscovery(adapter: Bluetooth.Adapter): Promise<void> {
  if (!adapter.discovering) return
  try { await call(await pathOf(adapter), ADAPTER_IFACE, "StopDiscovery") } catch (e) {
    if (!/No discovery started/.test(String(e))) throw e
  }
}

// Unpairs too (BlueZ disconnects first, which is the slow part).
export async function removeDevice(adapter: Bluetooth.Adapter, dev: Bluetooth.Device): Promise<void> {
  const path = devicePath(dev)
  await call(await pathOf(adapter), ADAPTER_IFACE, "RemoveDevice", new GLib.Variant("(o)", [path]))
}

export function setTrusted(dev: Bluetooth.Device, on: boolean): Promise<void> {
  return setProp(devicePath(dev), DEVICE_IFACE, "Trusted", new GLib.Variant("b", on))
}

// Promise wrappers over Astal's (already async) connect/disconnect.
export function connectDevice(dev: Bluetooth.Device): Promise<void> {
  return new Promise((resolve, reject) => {
    dev.connect_device((_d, res) => {
      try { dev.connect_device_finish(res); resolve() } catch (e) { reject(e) }
    })
  })
}

export function disconnectDevice(dev: Bluetooth.Device): Promise<void> {
  return new Promise((resolve, reject) => {
    dev.disconnect_device((_d, res) => {
      try { dev.disconnect_device_finish(res); resolve() } catch (e) { reject(e) }
    })
  })
}

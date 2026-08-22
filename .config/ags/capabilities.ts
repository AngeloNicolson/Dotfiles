// Host capability probing — one sync sweep at startup so every widget can ask
// "does this machine have X?" instead of assuming this laptop's hardware/stack.
// Everything here is cheap (PATH lookups + sysfs stats); nothing shells out.

import GLib from "gi://GLib"

export function hasCmd(cmd: string): boolean {
  return GLib.find_program_in_path(cmd) !== null
}

export function pathExists(p: string): boolean {
  return GLib.file_test(p, GLib.FileTest.EXISTS)
}

function listDir(dir: string): string[] {
  try {
    const d = GLib.Dir.open(dir, 0)
    const out: string[] = []
    let name: string | null
    while ((name = d.read_name()) !== null) out.push(name)
    d.close()
    return out
  } catch {
    return []
  }
}

export function readSysfs(p: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(p)
    if (ok) return new TextDecoder().decode(bytes).trim()
  } catch {}
  return ""
}

const PSU_DIR = "/sys/class/power_supply"

function findBattery(): string | null {
  for (const name of listDir(PSU_DIR)) {
    if (readSysfs(`${PSU_DIR}/${name}/type`) === "Battery") return `${PSU_DIR}/${name}`
  }
  return null
}

function findMainsAdapter(): string | null {
  for (const name of listDir(PSU_DIR)) {
    if (readSysfs(`${PSU_DIR}/${name}/type`) === "Mains") return `${PSU_DIR}/${name}`
  }
  return null
}

// USB-C PD source power supplies (UCSI). Each has online=1 while that port is
// the active power input, letting us tell USB-C charging apart from the barrel.
function findUsbcSources(): string[] {
  return listDir(PSU_DIR)
    .filter((n) => readSysfs(`${PSU_DIR}/${n}/type`) === "USB")
    .map((n) => `${PSU_DIR}/${n}`)
}

function shortCpuName(): string {
  const cpuinfo = readSysfs("/proc/cpuinfo")
  const m = cpuinfo.match(/^model name\s*:\s*(.+)$/m)
  if (!m) return "CPU"
  // "Intel(R) Core(TM) Ultra 9 275HX" -> "Ultra 9 275HX"
  return m[1]
    .replace(/\((R|TM|r|tm)\)/g, "")
    .replace(/\b(Intel|AMD|Core|Ryzen\s?)\b/g, (s) => (s.trim() === "Ryzen" ? s : ""))
    .replace(/\s+/g, " ")
    .replace(/\d+-Core Processor/i, "")
    .trim() || "CPU"
}

// Intel RAPL CPU package energy counter. Present on Intel machines but often
// root-only (post-Platypus lockdown) — callers must tolerate unreadable. A
// tmpfiles.d rule (`z /sys/class/powercap/intel-rapl:0/energy_uj 0444 - - -`)
// makes it readable persistently.
const RAPL_PKG = "/sys/class/powercap/intel-rapl:0"

export const caps = {
  rapl: pathExists(`${RAPL_PKG}/energy_uj`) ? RAPL_PKG : null,
  battery: findBattery(),            // sysfs dir or null (desktop)
  mains: findMainsAdapter(),         // barrel/AC adapter sysfs dir or null
  usbcSources: findUsbcSources(),    // UCSI USB-C PD source entries
  cpuName: shortCpuName(),

  nvidia: hasCmd("nvidia-smi"),
  powerProfiles: hasCmd("powerprofilesctl"),
  dunst: hasCmd("dunstctl"),
  plansync: hasCmd("plansync"),
  mpv: hasCmd("mpv"),
  socat: hasCmd("socat"),
  cava: hasCmd("cava"),
  nmcli: hasCmd("nmcli"),
  bluetoothctl: hasCmd("bluetoothctl"),
}

export default caps

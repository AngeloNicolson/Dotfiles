import { createSubprocess, execAsync } from "ags/process"
import { createState } from "ags"
import {
  setSyncConnected,
  setSyncPeerCount,
  setSyncPeers,
  setPendingChangeRequests,
} from "../state"

interface SyncEvent {
  type: string
  peer?: string
  file?: string
  direction?: string
  error?: string
  id?: string
  from?: string
  device_id?: string
  port?: number
}

const connectedPeers = new Set<string>()
let pendingCRs = 0

// Track last synced file for footer display
export const [lastSyncedFile, setLastSyncedFile] = createState("")
export const [lastSyncTime, setLastSyncTime] = createState("")
export const [daemonRunning, setDaemonRunning] = createState(false)

function updateState() {
  setSyncConnected(connectedPeers.size > 0)
  setSyncPeerCount(connectedPeers.size)
  setSyncPeers(Array.from(connectedPeers))
  setPendingChangeRequests(pendingCRs)
}

// Start daemon subprocess — outputs JSON lines
export const syncDaemon = createSubprocess(
  { type: "starting" } as SyncEvent,
  ["plansync", "daemon"],
  (line: string) => {
    try {
      const ev: SyncEvent = JSON.parse(line)

      switch (ev.type) {
        case "daemon_ready":
          setDaemonRunning(true)
          break
        case "connected":
          if (ev.peer) connectedPeers.add(ev.peer)
          updateState()
          break
        case "disconnected":
          if (ev.peer) connectedPeers.delete(ev.peer)
          updateState()
          break
        case "paired":
          if (ev.peer) connectedPeers.add(ev.peer)
          updateState()
          break
        case "synced":
          if (ev.file) {
            setLastSyncedFile(ev.file)
            setLastSyncTime(new Date().toLocaleTimeString())
          }
          break
        case "change_request":
          pendingCRs++
          updateState()
          break
        case "file_changed":
          // Local file change detected
          break
        case "conflict":
          // Could notify user
          break
        case "error":
          print(`[plansync] error: ${ev.error}`)
          break
      }

      return ev
    } catch {
      return { type: "parse_error" } as SyncEvent
    }
  },
)

// CLI helper — run plansync commands through the daemon's IPC
export async function plansyncCmd(cmd: string): Promise<any> {
  try {
    const out = await execAsync(`plansync ${cmd}`)
    return JSON.parse(out.trim())
  } catch (e) {
    print(`[plansync] command failed: ${cmd} — ${e}`)
    return null
  }
}

export async function generateInvite(role: string = "paired", files?: string[]): Promise<any> {
  let cmd = `invite --role ${role}`
  if (files && files.length > 0) {
    cmd += ` --files ${files.join(",")}`
  }
  return plansyncCmd(cmd)
}

export async function acceptInvite(uri: string): Promise<any> {
  return plansyncCmd(`accept ${uri}`)
}

export async function getPeers(): Promise<any> {
  return plansyncCmd("peers")
}

export async function getStatus(): Promise<any> {
  return plansyncCmd("status")
}

export async function approveChangeRequest(id: string): Promise<any> {
  return plansyncCmd(`approve ${id}`)
}

export async function rejectChangeRequest(id: string): Promise<any> {
  return plansyncCmd(`reject ${id}`)
}

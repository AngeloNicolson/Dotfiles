import app from "ags/gtk3/app"
import { createState } from "ags"
import { createRoot } from "gnim"
import {
  toggleBar, cyclePage, cyclePageBack,
  toggleDestination, toggleGalaxy, togglePeriodicTable, toggleDisplays, toggleBluetoothWindow, toggleWallpapers, toggleSettings, getSidebarStacks,
  barStyle, setBarStyle, BAR_STYLES, frameConfig, type BarStyle,
  shieldPanel, setShieldPanel, getEdgePageState,
} from "./state"
import { initTheme, applyTheme, reapplyCss } from "./theme"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { recomputeScale, uFor, withU, trackWindowScale, refreshWindowScales, px } from "./scale"
import * as compositor from "./compositor"
import FrameBar from "./components/FrameBar"
import ShieldBar from "./components/ShieldBar"
import EdgeTab, { EDGE_PAGES, DEFAULT_EDGE_PAGE } from "./components/EdgeTab"
import DestinationWindow from "./components/DestinationWindow"
import GalaxyWindow from "./components/GalaxyWindow"
import PeriodicTableWindow from "./components/PeriodicTableWindow"
import BreakPopupWindow from "./components/BreakPopupWindow"
import WorkspaceOsdWindow from "./components/WorkspaceOsd"
import DisplayLayoutWindow from "./components/DisplayLayout"
import BluetoothWindow from "./components/BluetoothWindow"
import WallpaperCarouselWindow from "./components/WallpaperCarousel"
import SettingsWindow from "./components/SettingsWindow"
import { toggleHwMute, stepHwVolume } from "./components/AudioEQ"

// `ags request <cmd> [args...]` handlers. Adding a command = adding an entry;
// `ags request help` lists them all.
const commands: Record<string, (args: string[]) => string> = {
  "toggle-bar": () => {
    toggleBar()
    return "toggled"
  },
  "cycle-sidebar": () => {
    cyclePage()
    return "cycled"
  },
  "cycle-sidebar-back": () => {
    cyclePageBack()
    return "cycled back"
  },
  "toggle-destination": () => {
    toggleDestination()
    return "destination toggled"
  },
  "toggle-galaxy": () => {
    toggleGalaxy()
    return "galaxy toggled"
  },
  "toggle-periodic-table": () => {
    togglePeriodicTable()
    return "periodic table toggled"
  },
  "toggle-displays": () => {
    toggleDisplays()
    return "displays toggled"
  },
  "toggle-bluetooth": () => {
    toggleBluetoothWindow()
    return "bluetooth toggled"
  },
  "toggle-wallpapers": () => {
    toggleWallpapers()
    return "wallpapers toggled"
  },
  "toggle-settings": ([page]) => {
    toggleSettings(page)
    return page ? `settings: ${page}` : "settings toggled"
  },
  "bar-style": ([style]) => {
    if (!style) return `bar style: ${barStyle.get()} (options: ${BAR_STYLES.join(", ")})`
    if (!BAR_STYLES.includes(style as BarStyle)) return `unknown style: ${style} (options: ${BAR_STYLES.join(", ")})`
    setBarStyle(style as BarStyle)
    return `bar style set to ${style}`
  },
  "shield-panel": ([panel]) => {
    const panels = ["media", "calendar", "controls"]
    if (panel && !panels.includes(panel)) return `usage: shield-panel [${panels.join("|")}]`
    const next = panel ?? "media"
    setShieldPanel(shieldPanel.get() === next ? null : next as any)
    return `shield panel: ${shieldPanel.get() ?? "closed"}`
  },
  "edge-page": ([page]) => {
    const mon = compositor.getFocusedMonitorName()
    if (!mon) return "no focused monitor"
    const [, setEdgePage] = getEdgePageState(mon)
    if (!page) { setEdgePage(null); return "edge page closed" }
    if (!EDGE_PAGES.includes(page)) return `usage: edge-page [${EDGE_PAGES.join("|")}]`
    setEdgePage(page)
    return `edge page: ${page}`
  },
  "edge-toggle": ([page]) => {
    const mon = compositor.getFocusedMonitorName()
    if (!mon) return "no focused monitor"
    if (page && !EDGE_PAGES.includes(page)) return `usage: edge-toggle [${EDGE_PAGES.join("|")}]`
    const [edgePage, setEdgePage] = getEdgePageState(mon)
    // No page: toggle the panel itself — close it if out, else open the default.
    const next = page
      ? (edgePage.get() === page ? null : page)
      : (edgePage.get() ? null : DEFAULT_EDGE_PAGE)
    setEdgePage(next)
    return next ? `edge page: ${next}` : "edge page closed"
  },
  "debug-stacks": () =>
    `Registered stacks: ${JSON.stringify(Array.from(getSidebarStacks().keys()))}`,
  "theme": ([themeName]) => {
    if (!themeName) return "usage: theme <name>"
    // Same two steps as the Settings picker: in-process writers, then the
    // script for what they don't cover (dunst + app reload hooks).
    applyTheme(themeName)
      .then(() => execAsync([GLib.get_home_dir() + "/.config/themes/apply-theme.sh", themeName]))
      .catch((e) => console.error(`theme ${themeName}: ${e}`))
    return `theme set to ${themeName}`
  },
  // Volume keys (hyprland.lua) come through here so they act on the selected
  // hardware sink, not on @DEFAULT_AUDIO_SINK@ (the EQ filter node while the
  // EQ is on — muting that silenced playback and WirePlumber persisted it).
  "audio-mute": () => { toggleHwMute(); return "audio: mute toggled" },
  "audio-up": () => { stepHwVolume(0.05); return "audio: +5%" },
  "audio-down": () => { stepHwVolume(-0.05); return "audio: -5%" },
  "help": () => `commands: ${Object.keys(commands).sort().join(", ")}`,
}

app.start({
  requestHandler(request: string[], response: (res: string) => void) {
    const [cmd, ...args] = request
    if (!cmd) {
      response("no command provided")
      return
    }
    const handler = commands[cmd]
    response(handler ? handler(args) : `unknown command: ${cmd} (try: help)`)
  },
  main() {
    initTheme()

    // GDK index of the focused monitor — overlays bind to this so they always
    // appear on the screen the user is looking at, not a hardcoded monitor 0.
    const [overlayMonitor, setOverlayMonitor] = createState(0)
    const updateOverlayMonitor = () => {
      const focused = compositor.getFocusedMonitor()
      if (focused) setOverlayMonitor(compositor.gdkIndexFor(focused))
    }

    // Recompute the display scale (U) from the focused monitor and re-apply the
    // rescaled stylesheet if it changed.
    // Monitors changed: the base factor and/or the set of per-monitor sizes
    // may have changed, so rebuild the stylesheet and re-tag windows.
    const updateScale = () => {
      recomputeScale()
      reapplyCss()
      refreshWindowScales()
    }

    // Per monitor (by stable name): the bar style's windows (frame band + rail,
    // or the shield bar), shown on every monitor.
    const bars: Map<string, any[]> = new Map()
    let disposeBars: (() => void) | null = null

    // Sync bars with current monitors and the chosen bar style
    const syncBars = () => {
      // Destroy all existing bars and recreate them
      // GDK monitor indices can shift when monitors are added/removed.
      // Release bindings first, while their widgets still exist.
      disposeBars?.()
      disposeBars = null
      bars.forEach((wins) => wins.forEach((w) => w.destroy()))
      bars.clear()

      const style = barStyle.get()
      // Create bars for all current monitors, in a fresh scope so their
      // bindings are released on the next rebuild.
      createRoot((dispose) => { disposeBars = dispose; compositor.getMonitors().forEach((mon) => {
        const gdkIndex = compositor.gdkIndexFor(mon)
        console.log(`Creating ${style} bar for monitor: ${mon.name} (gdk index: ${gdkIndex})`)
        // Built with this monitor's factor (JS px values) and tagged so the
        // stylesheet's per-size copy applies to it.
        // Plus the edge tab (pomodoro/planner pop-out) on every monitor; under
        // FRAME it grows out of the band's inner edge.
        const wins = withU(uFor(mon), () => [
          ...(style === "frame" ? FrameBar(gdkIndex) : ShieldBar(gdkIndex)),
          ...EdgeTab(gdkIndex, mon.name, style === "frame" ? px(frameConfig.get().thickness) : 0),
        ])
        wins.forEach((w) => trackWindowScale(w))
        bars.set(mon.name, wins)
      }) })

      console.log(`Active bars: ${Array.from(bars.keys()).join(", ")}`)
    }

    // FRAME's compass runs vertically, so workspaces slide up/down there;
    // SHIELD's runs sideways.
    const applySlide = () => compositor.setWorkspaceSlide(barStyle.get() === "frame")
    compositor.onConfigReloaded(applySlide)

    // Bar Studio changes land live.
    barStyle.subscribe(() => { syncBars(); applySlide() })
    frameConfig.subscribe(() => {
      if (barStyle.get() === "frame") syncBars()
    })

    compositor.onMonitorsChanged(() => {
      console.log("Monitor layout changed")
      syncBars()
      updateScale()
      updateOverlayMonitor()
    })

    compositor.onFocusChanged(() => updateOverlayMonitor())

    // Initial setup
    // Recompute U from the now-ready focused monitor before anything is built.
    // initTheme() above ran at import-time U (which falls back to 1 if the
    // monitor dims weren't populated yet); without this, a single-monitor machine
    // that just boots never fires monitor-added/focus events, so U would stay 1 and
    // the whole UI would render at full baseline size (too large on smaller screens).
    updateScale()
    syncBars()
    applySlide()
    updateOverlayMonitor()

    // Overlay windows follow the focused monitor (reactive index) instead of
    // being pinned to monitor 0.
    // Every overlay follows a monitor; keep its size class in sync with it.
    trackWindowScale(DestinationWindow(overlayMonitor))
    trackWindowScale(GalaxyWindow(overlayMonitor))
    trackWindowScale(PeriodicTableWindow(overlayMonitor))
    trackWindowScale(BreakPopupWindow(overlayMonitor))
    trackWindowScale(WorkspaceOsdWindow(overlayMonitor))
    trackWindowScale(DisplayLayoutWindow(overlayMonitor))
    trackWindowScale(BluetoothWindow(overlayMonitor))
    trackWindowScale(WallpaperCarouselWindow(overlayMonitor))
    trackWindowScale(SettingsWindow(overlayMonitor))
  },
})

import { readFile, writeFile } from "ags/file"
import { execAsync } from "ags/process"
import app from "ags/gtk3/app"
import GLib from "gi://GLib"
import { scaleCss } from "./scale"

const THEME_DIR = GLib.get_home_dir() + "/.config/themes"

export interface ThemeColors {
  bg: string
  bg_dark: string
  bg_light: string
  bg_lighter: string
  fg: string
  fg_dim: string
  fg_bright: string
  accent: string
  red: string
  red_bright: string
  green: string
  green_bright: string
  yellow: string
  yellow_bright: string
  blue: string
  blue_bright: string
  magenta: string
  magenta_bright: string
  cyan: string
  cyan_bright: string
  gray: string
}

export interface Theme {
  name: string
  displayName: string
  colors: ThemeColors
  gtk: {
    theme: string
    iconTheme: string
    cursorTheme: string
    colorScheme: string
  }
  hyprland: {
    borderRadius: number
    gapsIn: number
    gapsOut: number
    borderSize: number
  }
}

// Helper to strip # from hex colors
function stripHash(color: string): string {
  return color.replace("#", "")
}

export function loadTheme(themeName: string): Theme | null {
  try {
    const content = readFile(`${THEME_DIR}/${themeName}.json`)
    if (!content) return null
    return JSON.parse(content) as Theme
  } catch (e) {
    print(`Error loading theme ${themeName}: ${e}`)
    return null
  }
}

// The structural stylesheet is static — every color is a GTK named color
// (@bg, @accent, ...) resolved by the @define-color header that generateCSS()
// prepends from the active theme. Swapping themes only swaps that header.
const STATIC_CSS = `
    /* === STAR WARS TERMINAL THEME === */

    * {
      font-family: "JetBrainsMono Nerd Font", "CaskaydiaCove Nerd Font", monospace;
      text-shadow: none;
      -gtk-icon-shadow: none;
    }

    window {
      background: transparent;
    }

    /* Reset default button styles */
    button {
      background: transparent;
      border: none;
      box-shadow: none;
      outline: none;
    }

    /* Reset scrollable styles */
    scrolledwindow,
    scrollable {
      background: transparent;
      border: none;
      box-shadow: none;
      outline: none;
    }
    scrolledwindow frame,
    scrolledwindow viewport,
    scrollable frame,
    scrollable viewport {
      background: transparent;
      border: none;
      box-shadow: none;
    }
    scrollbar {
      opacity: 0;
      min-width: 0;
      min-height: 0;
    }

    /* Sidebar container - Holographic */
    #sidebar-bg {
      background: @bg_dark;
      border-radius: 0;
      padding: 0;
      border: 1px solid @bg_light;
      border-left: 2px solid #3a6080;
    }

    #edge-strip {
      background: transparent;
      min-width: 0;
      margin: 0;
    }

    #page-box {
      padding: 16px 14px;
      min-width: 260px;
      background: @bg_dark;
    }

    /* Tab Bar - Holographic navigation */
    #tab-bar {
      background: @bg_dark;
      border-bottom: 1px solid @bg_light;
      padding: 6px 6px;
    }
    #tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 4px 4px 0 0;
      padding: 7px 8px 5px 8px;
      margin: 0 2px;
      min-width: 48px;
      transition: all 150ms ease;
    }
    #tab-btn:hover {
      background: alpha(@accent, 0.07);
    }
    #tab-btn.active {
      background: linear-gradient(to top, alpha(@accent, 0.16), alpha(@accent, 0.02));
      border-bottom: 2px solid @accent;
      box-shadow: 0 6px 14px -6px alpha(@accent, 0.45);
    }
    #tab-icon {
      font-size: 19px;
      color: @fg_dim;
      margin-bottom: 3px;
    }
    #tab-btn:hover #tab-icon {
      color: @fg;
    }
    #tab-btn.active #tab-icon {
      color: @fg_bright;
    }
    #tab-label {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1px;
      margin-left: 1px;
      color: @fg_dim;
    }
    #tab-btn:hover #tab-label {
      color: @fg;
    }
    #tab-btn.active #tab-label {
      color: @fg_bright;
    }
    #tab-focus-btn {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 8px;
      padding: 1px 8px;
      margin: 3px 6px 0 6px;
      min-height: 14px;
      transition: all 150ms ease;
    }
    #tab-focus-btn:hover {
      border-color: @bg_lighter;
      background: alpha(@accent, 0.05);
    }
    #tab-focus-btn.focused {
      background: alpha(@accent, 0.12);
      border-color: alpha(@accent, 0.6);
      box-shadow: 0 0 10px alpha(@accent, 0.25);
    }
    #tab-focus-btn label {
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 2px;
      margin-left: 2px;
      color: #4a6478;
    }
    #tab-focus-btn:hover label {
      color: @fg;
    }
    #tab-focus-btn.focused label {
      color: @fg_bright;
    }

    /* Typography - terminal style */
    #title {
      color: #50d0d0;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    #subtitle {
      color: #2a4a4a;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 1px;
    }
    #title-blue {
      color: #50d0d0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 3px;
      margin-bottom: 12px;
    }

    /* ============ PLANNER PAGE ============ */
    #planner-page {
      padding: 12px;
      background: @bg_dark;
    }
    #planner-header {
      margin-bottom: 8px;
    }
    #planner-info-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 4px 8px;
      margin-right: 4px;
    }
    #planner-info-btn:hover {
      background: @bg_light;
      border-color: @accent;
    }
    #planner-info-btn label {
      color: @fg_dim;
      font-size: 10px;
      font-weight: 700;
      font-style: italic;
    }
    #planner-info-btn:hover label {
      color: @fg_bright;
    }
    #planner-info-panel {
      background: alpha(@bg, 0.8);
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
      margin: 4px 8px 8px 8px;
    }
    #planner-info-text {
      color: @fg_dim;
      font-size: 10px;
    }
    #planner-reload-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 4px 8px;
    }
    #planner-reload-btn:hover {
      background: @bg_light;
      border-color: @accent;
    }
    #planner-reload-btn label {
      color: @fg_dim;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    #planner-reload-btn:hover label {
      color: @fg_bright;
    }
    #planner-date-nav {
      margin-bottom: 6px;
      padding: 4px 0;
    }
    #planner-nav-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 4px 10px;
      margin: 0 4px;
    }
    #planner-nav-btn:hover {
      background: @bg_light;
      border-color: @accent;
    }
    #planner-nav-btn label {
      color: @fg_dim;
      font-size: 12px;
    }
    #planner-nav-btn:hover label {
      color: @fg_bright;
    }
    #planner-date {
      color: @cyan_bright;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      margin: 0 8px;
      min-width: 200px;
    }

    /* ── Day calendar grid ── */
    #plan-grid {
      padding: 0;
    }

    /* Horizontal grid line between each hour */
    #plan-gridline {
      background: #3a5565;
      min-height: 1px;
    }

    /* Half-hour line (faint) */
    #plan-halfline {
      background: @bg_lighter;
      min-height: 1px;
    }

    /* Vertical divider between hour label and cell */
    #plan-divider {
      background: #3a5565;
      min-width: 1px;
    }

    #plan-row {
      padding: 0;
      margin: 0;
    }

    /* Hour label on the left */
    #plan-hour-label {
      color: #7aabb8;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 2px 6px 0 4px;
      min-width: 32px;
    }

    /* Cell area right of divider */
    #plan-cell {
      padding: 2px 4px;
    }

    /* Event block */
    #plan-event {
      background: #1a3248;
      border-left: 3px solid @accent;
      border-radius: 3px;
      padding: 1px 8px;
    }
    #plan-event-time {
      color: #80a8b8;
      font-size: 10px;
      font-weight: 700;
    }
    #plan-event-text {
      color: @fg_bright;
      font-size: 11px;
      font-weight: 600;
    }

    /* Schedule event (from schedule.plan — read-only, muted template) */
    #plan-event.schedule {
      background: #0c1820;
      border-left: 2px solid #1e3a48;
    }
    #plan-event.schedule #plan-event-time { color: #304858; }
    #plan-event.schedule #plan-event-text { color: #4a6878; }

    /* 3-dot menu button (cal events + kanban cards) */
    #planner-dots-btn {
      background: transparent;
      border: none;
      padding: 0 4px;
      min-width: 16px;
      min-height: 14px;
    }
    #planner-dots-btn:hover {
      background: alpha(@accent, 0.15);
      border-radius: 3px;
    }
    #planner-dots-btn label {
      color: @fg_dim;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    #planner-dots-btn:hover label {
      color: @fg_bright;
    }

    /* Popover menu */
    popover.background {
      background-color: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
    }
    popover contents {
      background-color: transparent;
      padding: 4px 0;
    }
    #planner-popover-item {
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 6px 16px;
    }
    #planner-popover-item:hover {
      background: alpha(@accent, 0.15);
    }
    #planner-popover-item label {
      color: @fg_bright;
      font-size: 11px;
      font-weight: 600;
    }
    #planner-popover-item:hover label {
      color: @fg_bright;
    }
    #planner-popover-item-danger {
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 6px 16px;
    }
    #planner-popover-item-danger:hover {
      background: alpha(#c05050, 0.15);
    }
    #planner-popover-item-danger label {
      color: #a05050;
      font-size: 11px;
      font-weight: 600;
    }
    #planner-popover-item-danger:hover label {
      color: #e08080;
    }

    /* Inline entry for adding/editing events */
    #plan-entry {
      background: #1a3248;
      color: @fg_bright;
      border: 1px solid @accent;
      border-radius: 3px;
      padding: 2px 8px;
      font-size: 10px;
      caret-color: @accent;
    }

    /* Drag guide line — grey dotted, full pane width */
    #plan-drag-guide {
      background: transparent;
      border-top: 1px dotted #808080;
      min-height: 1px;
    }

    /* Burgundy now-line */
    #plan-now-line {
      background: #cc2244;
    }

    /* Empty state */
    #planner-empty {
      padding: 30px 20px;
    }
    #planner-empty-title {
      color: @cyan;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 14px;
    }
    #planner-empty-path {
      color: @cyan_bright;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    #planner-empty-hint {
      color: @fg_dim;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    #planner-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    #planner-create-btn {
      background: @bg;
      border: 1px solid #2a4a35;
      border-radius: 4px;
      padding: 10px 20px;
      margin-top: 16px;
    }
    #planner-create-btn:hover {
      background: #15281c;
      border-color: #50c070;
      box-shadow: inset 0 0 12px alpha(#50c070, 0.3);
    }
    #planner-create-btn label {
      color: #50a060;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    #planner-create-btn:hover label {
      color: #80e0a0;
    }
    #planner-footer-bar {
      padding: 4px 4px;
    }
    #planner-footer {
      color: @fg_dim;
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 2px;
      padding: 0 4px;
    }

    /* ── Inner tabs (CAL / BOARD) ── */
    #planner-inner-tabs {
      padding: 0;
    }
    #planner-inner-tab {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 5px 12px;
      margin: 0 3px;
      min-width: 40px;
    }
    #planner-inner-tab:hover {
      background: @bg_light;
      border-color: @gray;
    }
    #planner-inner-tab.active {
      background: @bg_light;
      border: 1px solid @accent;
    }
    #planner-inner-tab label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #5a7888;
    }
    #planner-inner-tab:hover label {
      color: #90d0e0;
    }
    #planner-inner-tab.active label {
      color: #a0f0ff;
    }

    /* ── Kanban subpane tabs (TODO / DOING / DONE) ── */
    #kanban-subpane-tabs {
      padding: 2px 0 6px 0;
    }
    #kanban-subpane-tab {
      background: alpha(@bg_light, 0.4);
      border: 1px solid @bg_lighter;
      border-radius: 3px;
      padding: 4px 8px;
      margin: 0 2px;
    }
    #kanban-subpane-tab:hover {
      background: alpha(@bg_lighter, 0.6);
      border-color: @gray;
    }
    #kanban-subpane-tab.active {
      background: alpha(#1a3040, 0.7);
      border: 1px solid @accent;
    }
    #kanban-subpane-tab label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #5a7888;
    }
    #kanban-subpane-tab:hover label {
      color: #90d0e0;
    }
    #kanban-subpane-tab.active label {
      color: #a0f0ff;
    }

    /* ── Board selector header ── */
    #kanban-board-header {
      padding: 2px 4px 2px 4px;
      min-height: 28px;
    }
    button#kanban-board-selector {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 2px 10px;
      margin: 0 3px;
      min-width: 40px;
    }
    button#kanban-board-selector:hover {
      background: @bg_light;
      border-color: @accent;
    }
    button#kanban-board-selector label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #5a7888;
    }
    button#kanban-board-selector:hover label {
      color: @fg_bright;
    }
    #board-modal-backdrop {
      background: alpha(#000000, 0.6);
    }
    #board-modal {
      background: #0a1820;
      border: 1px solid @bg_lighter;
      border-radius: 8px;
      padding: 20px 28px;
      min-width: 280px;
    }
    #board-modal-title {
      color: @cyan_bright;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3px;
      margin-bottom: 16px;
    }
    #board-modal-content {
      padding: 0;
    }
    #board-modal-msg {
      color: #90b0c0;
      font-size: 10px;
      letter-spacing: 1px;
    }

    /* ── Kanban card ── */
    #kanban-card {
      background: #1a3248;
      border-left: 3px solid @accent;
      border-radius: 3px;
      padding: 6px 8px;
      margin: 3px 4px;
    }
    #kanban-card.done {
      background: #0c1820;
      border-left: 2px solid #1e3a48;
    }
    #kanban-card-title {
      color: @fg_bright;
      font-size: 11px;
      font-weight: 600;
    }
    #kanban-card.done #kanban-card-title {
      color: #4a6878;
    }
    #kanban-card-desc {
      color: #80a8b8;
      font-size: 9px;
      margin-top: 2px;
    }
    #kanban-card.done #kanban-card-desc {
      color: #304858;
    }
    #kanban-card-badge {
      color: @accent;
      background: alpha(@accent, 0.12);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 1px 6px;
      border-radius: 2px;
      margin-top: 4px;
    }
    #kanban-card.done #kanban-card-badge {
      color: #2a4858;
      background: alpha(#2a4858, 0.12);
    }

    /* Move / delete buttons on cards */
    #kanban-move-btn {
      background: alpha(@bg_light, 0.4);
      border: 1px solid @bg_lighter;
      border-radius: 3px;
      padding: 2px 6px;
      margin: 0 1px;
    }
    #kanban-move-btn:hover {
      background: @bg_light;
      border-color: @accent;
    }
    #kanban-move-btn label {
      font-size: 10px;
      font-weight: 700;
      color: @fg_dim;
    }
    #kanban-move-btn:hover label {
      color: @fg_bright;
    }
    #kanban-delete-btn {
      background: alpha(#2a1a1a, 0.4);
      border: 1px solid #4a2a2a;
      border-radius: 3px;
      padding: 2px 6px;
      margin: 0 1px;
    }
    #kanban-delete-btn:hover {
      background: #271616;
      border-color: #c05050;
    }
    #kanban-delete-btn label {
      font-size: 10px;
      font-weight: 700;
      color: #a05050;
    }
    #kanban-delete-btn:hover label {
      color: #e08080;
    }

    /* ── Add item button + entry ── */
    #kanban-add-btn {
      background: transparent;
      border: 1px dashed @bg_lighter;
      border-radius: 3px;
      padding: 6px 8px;
      margin: 6px 4px;
    }
    #kanban-add-btn:hover {
      background: alpha(@bg_lighter, 0.4);
      border-color: @accent;
    }
    #kanban-add-btn label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #5a7888;
    }
    #kanban-add-btn:hover label {
      color: #a0f0ff;
    }
    #kanban-add-entry {
      background: #1a3248;
      color: @fg_bright;
      border: 1px solid @accent;
      border-radius: 3px;
      padding: 4px 8px;
      margin: 4px 4px;
      font-size: 10px;
      caret-color: @accent;
    }
    /* ── Checklist items on card ── */
    #kanban-card-checklist-box {
      margin-top: 4px;
    }
    #kanban-card-check-row {
      padding: 1px 0;
    }
    #kanban-card-check-icon {
      color: @accent;
      font-size: 8px;
      font-weight: 700;
      margin-right: 4px;
      min-width: 18px;
    }
    #kanban-card-check-label {
      color: #90c0d0;
      font-size: 9px;
      font-weight: 500;
    }
    #kanban-card-check-label.checked {
      color: #4a6878;
    }
    #kanban-card.done #kanban-card-check-icon {
      color: #2a4858;
    }
    #kanban-card.done #kanban-card-check-label {
      color: #304858;
    }

    /* ══════════════════════════════════════════════
       Card detail modal — GitHub Issue exact clone
       bg: @bg_dark  surface: @bg  border: @bg_lighter
       text: #e6edf3  muted: @fg_dim  link: @blue_bright
       ══════════════════════════════════════════════ */
    #cd-backdrop {
      background: alpha(#010409, 0.7);
    }
    #cd-panel {
      background: @bg_dark;
      border: 1px solid @bg_lighter;
      border-radius: 12px;
      padding: 32px 40px;
      min-width: 900px;
      min-height: 600px;
    }
    #cd-body {
      background: transparent;
    }

    /* Title row */
    #cd-title-row {
      margin-bottom: 8px;
    }
    #cd-title {
      color: #e6edf3;
      font-size: 26px;
      font-weight: 600;
    }
    #cd-title-entry {
      background: @bg_dark;
      color: #e6edf3;
      border: 1px solid @blue_bright;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 24px;
      font-weight: 600;
      caret-color: @blue_bright;
    }

    /* Close X button */
    #cd-close-btn {
      background: transparent;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
    }
    #cd-close-btn:hover {
      background: alpha(@fg_dim, 0.12);
    }
    #cd-close-btn label {
      color: @fg_dim;
      font-size: 18px;
    }
    #cd-close-btn:hover label {
      color: #e6edf3;
    }

    /* Badge row (status + board path) */
    #cd-badge-row {
      margin-bottom: 12px;
    }
    #cd-status-badge {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 24px;
    }
    #cd-status-badge.todo {
      background: @bg_lighter;
      color: #e6edf3;
    }
    #cd-status-badge.doing {
      background: alpha(#d29922, 0.2);
      color: #d29922;
    }
    #cd-status-badge.done {
      background: #238636;
      color: #e6edf3;
    }
    #cd-path-label {
      color: @fg_dim;
      font-size: 12px;
      font-weight: 400;
    }

    /* Separator line */
    #cd-separator {
      background: #21262d;
      min-height: 1px;
      margin-bottom: 16px;
    }

    /* Two-column layout */
    #cd-columns {
      background: transparent;
    }

    /* Left column */
    #cd-left {
      padding-right: 32px;
    }

    /* Description box (GitHub comment style) */
    #cd-desc-box {
      border: 1px solid @bg_lighter;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    #cd-desc-header {
      background: @bg;
      border-bottom: 1px solid @bg_lighter;
      border-radius: 6px 6px 0 0;
      padding: 10px 16px;
    }
    #cd-desc-header label {
      font-size: 13px;
      font-weight: 600;
      color: @fg_dim;
    }
    #cd-desc-scroll {
      background: @bg_dark;
      border: none;
      border-radius: 0 0 6px 6px;
      padding: 0;
    }
    textview#cd-desc-view {
      background: @bg_dark;
      color: #e6edf3;
    }
    textview#cd-desc-view text {
      background: @bg_dark;
      color: #e6edf3;
      caret-color: @blue_bright;
      font-size: 14px;
    }

    /* Checklist section */
    #cd-check-section {
      background: transparent;
      margin-top: 8px;
    }
    #cd-check-header-row {
      margin-bottom: 8px;
    }
    #cd-section-label {
      font-size: 16px;
      font-weight: 600;
      color: #e6edf3;
    }

    /* Progress bar */
    #cd-progress-bar {
      border-radius: 4px;
      margin-bottom: 8px;
    }
    #cd-progress-fill {
      background: #238636;
      border-radius: 4px 0 0 4px;
      min-height: 8px;
    }
    #cd-progress-empty {
      background: #21262d;
      border-radius: 0 4px 4px 0;
      min-height: 8px;
    }

    /* Checklist rows */
    #cd-check-row {
      padding: 6px 8px;
      border-radius: 6px;
    }
    #cd-check-row:hover {
      background: alpha(@bg, 0.8);
    }
    #cd-checkbox {
      background: transparent;
      border: none;
      padding: 2px;
      min-width: 24px;
      min-height: 24px;
      border-radius: 4px;
    }
    #cd-checkbox:hover {
      background: alpha(@bg_lighter, 0.5);
    }
    #cd-checkbox label {
      font-size: 16px;
    }
    .checked {
      color: #484f58;
    }

    /* Remove item button */
    #cd-remove-btn {
      background: transparent;
      border: none;
      padding: 4px 8px;
      border-radius: 6px;
      opacity: 0.3;
    }
    #cd-remove-btn:hover {
      background: alpha(#f85149, 0.1);
      opacity: 1;
    }
    #cd-remove-btn label {
      font-size: 12px;
    }

    /* Add entry */
    #cd-add-entry {
      background: @bg_dark;
      color: @fg_dim;
      border: 1px solid @bg_lighter;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      caret-color: @blue_bright;
    }
    #cd-add-entry:focus {
      background: @bg_dark;
      color: #e6edf3;
      border-color: @blue_bright;
      box-shadow: 0 0 0 3px alpha(@blue_bright, 0.3);
    }

    /* ── Right sidebar (GitHub style) ── */
    #cd-sidebar {
      min-width: 260px;
      padding: 0 0 0 32px;
      border-left: 1px solid #21262d;
    }
    #cd-sidebar-section {
      padding: 16px 0;
      border-bottom: 1px solid #21262d;
    }
    #cd-sidebar-header {
      font-size: 12px;
      font-weight: 600;
      color: #e6edf3;
      margin-bottom: 6px;
    }
    #cd-sidebar-value {
      color: @fg_dim;
      font-size: 13px;
      font-weight: 400;
      margin-top: 2px;
    }

    /* Move buttons in sidebar */
    #cd-move-btn {
      background: #21262d;
      border: 1px solid @bg_lighter;
      border-radius: 6px;
      padding: 6px 16px;
      margin-top: 8px;
    }
    #cd-move-btn:hover {
      background: @bg_lighter;
      border-color: @fg_dim;
    }
    #cd-move-btn label {
      font-size: 12px;
      font-weight: 500;
      color: #c9d1d9;
    }
    #cd-move-btn:hover label {
      color: #e6edf3;
    }

    /* Sidebar 3-dot menu button */
    #cd-dots-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      border-radius: 4px;
    }
    #cd-dots-btn:hover {
      background: alpha(@fg_dim, 0.12);
    }
    #cd-dots-btn label {
      color: @fg_dim;
      font-size: 14px;
      font-weight: 700;
    }
    #cd-dots-btn:hover label {
      color: #e6edf3;
    }

    /* Delete button (red, bottom of sidebar) */
    #cd-delete-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
    }
    #cd-delete-btn:hover {
      background: alpha(#f85149, 0.1);
    }
    #cd-delete-btn label {
      color: #f85149;
      font-size: 12px;
      font-weight: 500;
    }
    #cd-delete-btn:hover label {
      color: #ff7b72;
    }

    #kanban-edit-entry {
      background: #1a3248;
      color: @fg_bright;
      border: 1px solid @accent;
      border-radius: 3px;
      padding: 1px 6px;
      font-size: 10px;
      caret-color: @accent;
      min-width: 60px;
    }

    /* ============ HOME PAGE - Holographic Star Citizen Style ============ */
    #home-page-scroll {
      background: @bg_dark;
    }
    #home-page-scroll scrollbar {
      opacity: 0;
      min-width: 0;
    }
    #home-page {
      padding: 12px;
      background: @bg_dark;
    }

    /* Section Header */
    #section-header {
      color: @cyan;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }

    /* System Toggles Row */
    #sys-toggles-row {
      margin-bottom: 12px;
    }
    #sys-toggle {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 9999px;
      padding: 12px;
      margin: 0 4px;
      min-width: 52px;
      min-height: 52px;
    }
    #sys-toggle:hover {
      background: @bg_light;
      border-color: @gray;
    }
    #sys-toggle.active {
      background: #302200;
      border: 1px solid #f5c842;
      box-shadow: inset 0 0 12px alpha(#f5c842, 0.3);
    }
    #sys-toggle-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      color: @fg_dim;
    }
    #sys-toggle:hover #sys-toggle-label {
      color: @fg;
    }
    #sys-toggle.active #sys-toggle-label {
      color: #f5c842;
    }

    /* Clock Panel */
    #clock-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 14px;
      margin-bottom: 10px;
    }
    #clock-time {
      color: @cyan_bright;
      font-size: 38px;
      font-weight: 700;
      letter-spacing: 4px;
    }
    #clock-date {
      color: #506070;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    #clock-secondary {
      background: alpha(#0a1015, 0.5);
      border-top: 1px solid @bg_lighter;
      padding: 8px 0 0 0;
      margin-top: 6px;
    }
    #clock-alt-label {
      color: @fg_dim;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    #clock-alt-time {
      color: @fg_dim;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 2px;
    }

    /* Control Panels (Brightness/Volume) */
    #control-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    #control-header {
      margin-bottom: 8px;
    }
    #control-icon {
      font-size: 14px;
      color: @fg_dim;
      margin-right: 4px;
    }
    #control-icon-btn {
      background: transparent;
      border: none;
      padding: 2px 4px;
      margin-right: 4px;
    }
    #control-icon-btn:hover #control-icon {
      color: @fg_bright;
    }
    #control-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: @fg_dim;
    }
    #control-value {
      font-size: 11px;
      font-weight: 700;
      color: @cyan_bright;
      letter-spacing: 1px;
    }
    #control-bar-container {
      min-height: 140px;
      padding: 4px 0;
    }
    #control-segment {
      min-height: 5px;
      border-radius: 1px;
      border: none;
      padding: 0;
      margin: 1px 0;
    }
    #control-segment.unlit {
      background: alpha(@bg_lighter, 0.5);
    }
    #control-segment.lit {
      background: @accent;
    }
    #control-segment:hover {
      background: @gray;
    }
    #control-segment.lit:hover {
      background: @fg_bright;
    }

    /* Status Panel (Battery) */
    #status-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
    }
    #status-icon {
      font-size: 14px;
      color: #90c0d0;
      margin-right: 8px;
    }
    #status-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #80a0b0;
    }
    #status-value {
      font-size: 12px;
      font-weight: 700;
      color: #a0e0f0;
      letter-spacing: 1px;
      margin-right: 8px;
    }
    #status-indicator {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #c0f0ff;
      background: alpha(#2a4050, 0.6);
      padding: 2px 6px;
      border-radius: 2px;
    }

    /* Tools Row */
    #tools-row {
      margin-bottom: 12px;
    }
    #tool-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
      margin: 0 4px;
      min-width: 64px;
      transition: all 150ms linear;
    }
    #tool-btn:hover {
      background: @bg_light;
      border-color: @accent;
      box-shadow: inset 0 0 12px alpha(@accent, 0.3);
    }
    #tool-btn-icon {
      font-size: 20px;
      color: @fg_dim;
      margin-bottom: 4px;
    }
    #tool-btn:hover #tool-btn-icon {
      color: @fg_bright;
    }
    #tool-btn-label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
      color: @fg_dim;
    }
    #tool-btn:hover #tool-btn-label {
      color: @fg_bright;
    }

    /* Wallpaper selector styles */
    #core-header {
      padding: 0 8px;
      margin-bottom: 4px;
    }
    #core-reload-btn {
      background: transparent;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 4px 8px;
      transition: all 150ms linear;
    }
    #core-reload-btn:hover {
      background: @bg_light;
      border-color: @accent;
    }
    #core-reload-btn label {
      font-size: 14px;
      color: @fg_dim;
    }
    #core-reload-btn:hover label {
      color: @fg_bright;
    }
    #wallpaper-tab-bar {
      background: @bg_dark;
      border-bottom: 1px solid @bg_light;
      padding: 6px;
      margin-bottom: 4px;
    }
    #wallpaper-sub-tab-bar {
      background: alpha(@bg_dark, 0.6);
      padding: 4px 6px;
      margin-bottom: 4px;
    }
    #wallpaper-sub-tab-btn {
      background: alpha(@bg_light, 0.4);
      border: 1px solid @bg_light;
      border-radius: 3px;
      padding: 4px 8px;
      margin: 0 2px;
      transition: all 150ms linear;
    }
    #wallpaper-sub-tab-btn:hover {
      background: alpha(@bg_lighter, 0.5);
      border-color: @gray;
    }
    #wallpaper-sub-tab-btn.active {
      background: alpha(#1a3040, 0.6);
      border: 1px solid @accent;
    }
    #wallpaper-sub-tab-btn #tab-icon {
      font-size: 12px;
      color: @fg_dim;
      margin-bottom: 1px;
    }
    #wallpaper-sub-tab-btn:hover #tab-icon {
      color: @fg;
    }
    #wallpaper-sub-tab-btn.active #tab-icon {
      color: @fg_bright;
    }
    #wallpaper-sub-tab-btn #tab-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: @fg_dim;
    }
    #wallpaper-sub-tab-btn:hover #tab-label {
      color: @fg;
    }
    #wallpaper-sub-tab-btn.active #tab-label {
      color: @fg_bright;
    }
    #wallpaper-tab-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 8px 12px;
      margin: 0 3px;
      transition: all 150ms linear;
    }
    #wallpaper-tab-btn:hover {
      background: @bg_light;
      border-color: @gray;
    }
    #wallpaper-tab-btn.active {
      background: @bg_light;
      border: 1px solid @accent;
      box-shadow: inset 0 0 12px alpha(@accent, 0.3);
    }
    #wallpaper-tab-btn #tab-icon {
      font-size: 16px;
      color: @fg_dim;
      margin-bottom: 2px;
    }
    #wallpaper-tab-btn:hover #tab-icon {
      color: @fg;
    }
    #wallpaper-tab-btn.active #tab-icon {
      color: @fg_bright;
    }
    #wallpaper-tab-btn #tab-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: @fg_dim;
    }
    #wallpaper-tab-btn:hover #tab-label {
      color: @fg;
    }
    #wallpaper-tab-btn.active #tab-label {
      color: @fg_bright;
    }
    #wallpaper-thumb {
      background: alpha(@bg_light, 0.4);
      border: 1px solid @bg_lighter;
      border-radius: 6px;
      padding: 4px;
      margin: 4px 0;
      transition: all 150ms linear;
    }
    #wallpaper-thumb:hover {
      background: alpha(@bg_lighter, 0.6);
      border-color: @accent;
      box-shadow: 0 0 8px alpha(@accent, 0.2);
    }
    #video-badge {
      background: alpha(#000000, 0.7);
      border-radius: 4px;
      padding: 4px 8px;
      margin: 6px;
    }
    #video-badge label {
      font-size: 12px;
      color: @fg_bright;
    }
    #video-name {
      font-size: 9px;
      font-weight: 600;
      color: @fg_dim;
      margin-top: 4px;
      letter-spacing: 0.5px;
    }
    #wallpaper-empty {
      padding: 40px 20px;
    }
    #wallpaper-empty #status-icon {
      font-size: 32px;
      color: @fg_dim;
      margin-bottom: 12px;
    }
    #wallpaper-empty #status-label {
      font-size: 10px;
      color: @fg_dim;
    }
    #wallpaper-empty #status-sublabel {
      font-size: 8px;
      color: @fg_dim;
      margin-top: 4px;
    }
    #movie-folder {
      margin: 2px 0;
    }
    #movie-folder-header {
      background: alpha(@bg_light, 0.5);
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
      transition: all 150ms linear;
    }
    #movie-folder-header:hover {
      background: @bg_light;
      border-color: @gray;
    }
    #folder-arrow {
      font-size: 10px;
      color: @accent;
      margin-right: 8px;
    }
    #folder-name {
      font-size: 11px;
      font-weight: 700;
      color: #7ab0c0;
      letter-spacing: 0.5px;
    }
    #folder-count {
      font-size: 9px;
      color: @fg_dim;
      margin-right: 4px;
    }
    #movie-folder-content {
      padding: 4px 0 4px 8px;
    }

    /* Destination Overlay - Solar System UI */
    #destination-window {
      background: radial-gradient(ellipse at center, rgba(5, 10, 15, 0.95) 0%, rgba(0, 5, 10, 0.98) 100%);
    }
    #destination-overlay {
      background: transparent;
      border-radius: 20px;
      padding: 40px;
    }
    #destination-center {
      background: radial-gradient(circle at 30% 30%, @accent, #1a4050);
      border: 2px solid @fg_bright;
      border-radius: 50%;
      box-shadow: 0 0 30px rgba(96, 192, 208, 0.5),
                  0 0 60px rgba(96, 192, 208, 0.2),
                  inset 0 0 20px rgba(255, 255, 255, 0.1);
      transition: all 200ms ease;
    }
    #destination-center:hover {
      border-color: #a0f0ff;
      box-shadow: 0 0 40px rgba(96, 192, 208, 0.7),
                  0 0 80px rgba(96, 192, 208, 0.3),
                  inset 0 0 20px rgba(255, 255, 255, 0.2);
    }
    #destination-center.selected {
      border-color: @fg_bright;
      box-shadow: 0 0 50px rgba(160, 240, 255, 0.8),
                  0 0 100px rgba(96, 192, 208, 0.4);
    }
    #destination-center #destination-icon {
      font-size: 32px;
      color: @fg_bright;
    }
    #destination-node {
      background: radial-gradient(circle at 30% 30%, #4a8090, #1a3040);
      border: 2px solid @cyan;
      border-radius: 50%;
      box-shadow: 0 0 15px rgba(80, 144, 160, 0.4),
                  0 0 30px rgba(80, 144, 160, 0.1),
                  inset 0 0 10px rgba(255, 255, 255, 0.05);
      transition: all 200ms ease;
    }
    #destination-node:hover {
      border-color: @fg_bright;
      box-shadow: 0 0 25px rgba(96, 192, 208, 0.6),
                  0 0 50px rgba(96, 192, 208, 0.2),
                  inset 0 0 15px rgba(255, 255, 255, 0.1);
    }
    #destination-node.selected {
      background: radial-gradient(circle at 30% 30%, @accent, #2a5060);
      border-color: #a0f0ff;
      box-shadow: 0 0 30px rgba(160, 240, 255, 0.7),
                  0 0 60px rgba(96, 192, 208, 0.3);
    }
    #destination-node #destination-icon {
      font-size: 20px;
      color: #a0d0e0;
    }
    #destination-node:hover #destination-icon {
      color: @fg_bright;
    }

    /* Legacy styles kept for compatibility */
    #quick-toggles-row {
      padding: 6px 0;
    }
    #toggle-container {
      margin: 4px 6px;
    }
    #quick-toggle {
      background: #0a1214;
      border-radius: 4px;
      padding: 0;
      margin: 0 0 4px 0;
      min-width: 44px;
      min-height: 44px;
      border: 1px solid #331111;
    }
    #quick-toggle:hover {
      background: #110808;
      border-color: #551122;
    }
    #quick-toggle.active {
      background: #110808;
      border: 1px solid @red;
    }
    #quick-toggle.active:hover {
      background: #1a0a0a;
    }
    #toggle-icon {
      font-size: 18px;
      color: #441515;
    }
    #quick-toggle:hover #toggle-icon {
      color: #662222;
    }
    #quick-toggle.active #toggle-icon {
      color: @red;
    }
    #toggle-label-btn {
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      border-radius: 0;
    }
    #toggle-label-btn:hover {
      background: alpha(@red, 0.1);
    }
    #toggle-label {
      font-size: 8px;
      color: #441515;
      font-weight: 700;
      letter-spacing: 1px;
    }
    #toggle-label-btn #toggle-label {
      padding: 2px 4px;
    }

    /* LED Segment Bar - Red terminal style */
    #led-bar {
      margin-top: 6px;
    }
    #led-segment {
      min-width: 8px;
      min-height: 18px;
      border-radius: 2px;
      border: none;
      padding: 0;
      margin: 0 1px;
    }
    #led-segment.unlit {
      background: #1a0a0a;
    }
    #led-segment.lit,
    #led-segment.lit.green,
    #led-segment.lit.yellow,
    #led-segment.lit.red {
      background: @red;
    }
    #led-segment:hover {
      background: #2a1010;
    }
    #led-segment.lit:hover,
    #led-segment.lit.green:hover,
    #led-segment.lit.yellow:hover,
    #led-segment.lit.red:hover {
      background: #cc2244;
    }

    /* Brightness Card - Red terminal panel */
    #brightness-card {
      background: transparent;
      border-radius: 0;
      border: 1px solid #331111;
      border-left: 2px solid @red;
      padding: 10px 12px;
      margin-top: 10px;
    }
    #brightness-header {
      margin-bottom: 8px;
    }
    #brightness-icon {
      font-size: 14px;
      color: @red;
      margin-right: 8px;
    }
    #brightness-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #551122;
    }
    #brightness-percent {
      font-size: 11px;
      font-weight: 700;
      color: @red;
      letter-spacing: 1px;
    }

    /* Volume Card - Red terminal panel */
    #volume-card {
      background: transparent;
      border-radius: 0;
      border: 1px solid #331111;
      border-left: 2px solid @red;
      padding: 10px 12px;
      margin-top: 8px;
    }
    #volume-header {
      margin-bottom: 8px;
    }
    #volume-icon-btn {
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      margin-right: 8px;
    }
    #volume-icon-btn:hover #volume-icon {
      color: #cc2244;
    }
    #volume-icon {
      font-size: 14px;
      color: @red;
    }
    #volume-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #551122;
    }
    #volume-percent {
      font-size: 11px;
      font-weight: 700;
      color: @red;
      letter-spacing: 1px;
    }

    /* Battery Card - Compact style */
    #battery-card {
      background: transparent;
      border-radius: 0;
      border: 1px solid #331111;
      border-left: 2px solid @red;
      padding: 10px 12px;
      margin-top: 10px;
      margin-bottom: 6px;
    }
    #battery-header {
      margin-bottom: 8px;
    }
    #battery-icon {
      font-size: 14px;
      color: @red;
      margin-right: 8px;
    }
    #battery-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #551122;
    }
    #battery-percent {
      font-size: 11px;
      font-weight: 700;
      color: @red;
      letter-spacing: 1px;
    }
    #battery-status-icon {
      font-size: 10px;
      color: @red;
    }
    #battery-level-bar {
      min-height: 8px;
    }
    #battery-level-bar trough {
      background: #0a0505;
      border: 1px solid #331111;
      border-radius: 0;
      min-height: 8px;
    }
    #battery-level-bar block.filled {
      background: @red;
      border-radius: 0;
      min-height: 8px;
    }
    #battery-level-bar block.empty {
      background: transparent;
    }

    /* Power Indicator Page - Holographic Style (matches Home) */
    #power-page {
      padding: 12px;
      min-width: 260px;
      background: @bg_dark;
    }
    #power-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 12px;
    }
    #power-panel-header {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid @bg_lighter;
    }
    #power-panel-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #90d0e0;
    }
    #power-panel-data {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #a0e0f0;
    }

    /* Power bar container */
    #power-bar-container {
      margin: 10px 0;
    }

    /* Scale on left side */
    #power-scale {
      min-width: 40px;
      margin-right: 8px;
      padding: 4px 0;
    }
    #power-scale-mark {
      font-size: 9px;
      font-weight: 600;
      color: #90b0c0;
      letter-spacing: 1px;
    }

    /* The bar frame */
    #power-bar-frame {
      border: 2px solid @accent;
      min-width: 150px;
      min-height: 200px;
      padding: 4px;
      background: alpha(#0a1015, 0.5);
    }
    #power-segments {
      background: transparent;
    }
    #power-segment {
      margin: 2px 0;
      min-height: 16px;
      border-radius: 12px;
    }
    #power-segment.unlit {
      background: alpha(@bg_lighter, 0.5);
    }
    #power-segment.lit {
      background: @accent;
    }
    #power-segment.discharge {
      background: #3a0a0a;
      border: 1px solid #992222;
      margin: 2px 0;
      min-height: 16px;
    }

    /* Header stats + badge */
    #power-header-stat {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #a0e0f0;
      margin: 0 6px;
    }
    #power-status-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      border-radius: 12px;
      padding: 3px 16px;
      margin-left: 6px;
      border: 1px solid transparent;
    }

    /* Right side indicators */
    #power-indicators {
      min-width: 40px;
      margin-left: 8px;
      padding: 4px 0;
    }
    #power-indicator {
      font-size: 9px;
      font-weight: 700;
      color: #90b0c0;
      letter-spacing: 1px;
    }

    /* Big percentage display */
    #power-big-percent {
      font-size: 56px;
      font-weight: 700;
      color: #e0f4f8;
      letter-spacing: 4px;
      margin-top: 10px;
      margin-bottom: 6px;
    }

    /* Footer data row */
    #power-panel-footer {
      padding-top: 8px;
      border-top: 1px solid @bg_lighter;
    }
    #power-footer-data {
      font-size: 9px;
      font-weight: 600;
      color: #90b0c0;
      letter-spacing: 2px;
    }

    /* GPU Power Panel */
    #gpu-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 12px;
      margin-top: 10px;
    }
    #gpu-panel-header {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid @bg_lighter;
    }
    #gpu-mode-buttons {
      margin-top: 6px;
    }
    #gpu-mode-btn {
      background: #0a1015;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 6px;
      margin: 0 3px;
    }
    #gpu-mode-btn.active {
      background: alpha(@accent, 0.15);
      border-color: @accent;
    }
    #gpu-mode-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #90b0c0;
    }
    #gpu-mode-btn.active #gpu-mode-label {
      color: #e0f4f8;
    }
    #gpu-mode-watts {
      font-size: 13px;
      font-weight: 600;
      color: #8095a8;
      letter-spacing: 0;
      margin-top: 2px;
    }
    #gpu-mode-btn.active #gpu-mode-watts {
      color: #a0e0f0;
    }

    /* App Launcher - Holographic Style (matches Home) */
    #search-container {
      margin-bottom: 10px;
    }
    #app-search {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 14px;
      color: @cyan_bright;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1px;
    }
    #app-search:focus {
      background: @bg_light;
      border-color: @accent;
    }
    #app-page-scroll,
    #app-page-scroll frame,
    #app-page-scroll viewport {
      background: transparent;
      border: none;
      box-shadow: none;
      outline: none;
    }
    #app-list {
      margin-top: 10px;
    }
    #app-item {
      background: @bg;
      border: none;
      border-radius: 4px;
      padding: 8px 10px;
      margin: 3px 0;
    }
    #app-item:hover {
      background: alpha(@bg_lighter, 0.8);
    }
    #app-item:active {
      background: alpha(#1a3040, 0.9);
      box-shadow: inset 0 0 12px alpha(@accent, 0.3);
    }
    #app-icon {
      color: @fg_dim;
      font-size: 20px;
      min-width: 20px;
      min-height: 20px;
    }
    #app-item:hover #app-icon {
      color: @cyan_bright;
    }
    #app-name {
      color: @cyan_bright;
      font-size: 10px;
      font-weight: 600;
    }

    /* ============ POMODORO PAGE - Holographic Style ============ */
    #pomo-page {
      padding: 12px;
      background: @bg_dark;
    }

    /* Timer display panel */
    #pomo-timer-panel {
      background: transparent;
      border: none;
      margin-bottom: 10px;
    }
    #pomo-time-display {
      color: #f0f2f4;
      font-size: 56px;
      font-weight: 700;
      letter-spacing: 4px;
    }
    #pomo-phase-label {
      color: @cyan;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-top: 2px;
    }

    /* Mode toggle row */
    #pomo-mode-row {
      margin-bottom: 8px;
    }
    #pomo-mode-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: @fg_dim;
    }
    #pomo-mode-row #sys-toggle.active #pomo-mode-label {
      color: @fg_bright;
    }
    #pomo-mode-row #sys-toggle:hover #pomo-mode-label {
      color: @fg;
    }

    /* Ratio presets row */
    #pomo-presets-row {
      margin-bottom: 8px;
    }
    #pomo-preset-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 6px 8px;
      margin: 0 3px;
      min-width: 44px;
    }
    #pomo-preset-btn:hover {
      background: @bg_light;
      border-color: @gray;
    }
    #pomo-preset-btn.active {
      background: @bg_light;
      border: 1px solid @accent;
      box-shadow: inset 0 0 12px alpha(@accent, 0.3);
    }
    #pomo-preset-btn label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      color: @fg_dim;
    }
    #pomo-preset-btn:hover label {
      color: @fg;
    }
    #pomo-preset-btn.active label {
      color: @fg_bright;
    }

    /* Time adjusters */
    #pomo-adjusters {
      margin-bottom: 8px;
    }
    #pomo-adjuster-row {
      padding: 4px 0;
    }
    #pomo-adj-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: @cyan;
      min-width: 50px;
    }
    #pomo-adj-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 4px 10px;
      margin: 0 2px;
      min-width: 28px;
    }
    #pomo-adj-btn:hover {
      background: @bg_light;
      border-color: @gray;
    }
    #pomo-adj-btn label {
      font-size: 12px;
      font-weight: 700;
      color: @fg_dim;
    }
    #pomo-adj-btn:hover label {
      color: @fg_bright;
    }
    #pomo-adj-value {
      font-size: 14px;
      font-weight: 700;
      color: @cyan_bright;
      letter-spacing: 1px;
      min-width: 40px;
    }

    /* Study block dots */
    #pomo-blocks-row {
      margin-bottom: 8px;
      padding: 6px 0;
    }
    #pomo-block-dot-btn {
      padding: 2px;
      margin: 0 1px;
      background: transparent;
      border: none;
      min-width: 0;
      min-height: 0;
    }
    #pomo-block-dot-btn:hover #pomo-block-dot {
      border-color: #c03030;
    }
    #pomo-block-dot {
      min-width: 10px;
      min-height: 10px;
      border-radius: 5px;
      background: alpha(@bg_lighter, 0.3);
      border: 1px solid @bg_lighter;
    }
    #pomo-block-dot-btn.selected #pomo-block-dot {
      background: #8b0000;
      border: 1px solid #c03030;
      box-shadow: 0 0 6px alpha(#c03030, 0.5);
    }
    #pomo-block-dot-btn.completed #pomo-block-dot {
      background: alpha(@bg_light, 0.2);
      border: 1px solid alpha(@bg_lighter, 0.2);
      box-shadow: none;
    }

    /* Control buttons */
    #pomo-controls-row {
      margin-bottom: 10px;
    }
    #pomo-start-btn {
      background: @bg;
      border: 1px solid #2a4a35;
      border-radius: 4px;
      padding: 10px 14px;
      margin: 0 4px;
    }
    #pomo-start-btn:hover {
      background: #15281c;
      border-color: #50c070;
      box-shadow: inset 0 0 12px alpha(#50c070, 0.3);
    }
    #pomo-start-btn label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #50a060;
    }
    #pomo-start-btn:hover label {
      color: #80e0a0;
    }
    #pomo-start-btn.running label {
      color: #c0a050;
    }
    #pomo-stop-btn {
      background: @bg;
      border: 1px solid #4a2a2a;
      border-radius: 4px;
      padding: 10px 14px;
      margin: 0 4px;
    }
    #pomo-stop-btn:hover {
      background: #271616;
      border-color: #c05050;
      box-shadow: inset 0 0 12px alpha(#c05050, 0.3);
    }
    #pomo-stop-btn label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #a05050;
    }
    #pomo-stop-btn:hover label {
      color: #e08080;
    }

    /* Maintain focus row */
    #pomo-focus-row {
      margin-bottom: 10px;
    }

    /* Audio section */
    #pomo-audio-row {
      margin-bottom: 8px;
    }
    #pomo-theme-name {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      color: @cyan_bright;
      margin: 0 8px;
      min-width: 80px;
    }
    #pomo-volume-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }

    /* Vim focus highlight */
    .focused {
      box-shadow: 0 0 6px alpha(@accent, 0.8), inset 0 0 4px alpha(@accent, 0.3);
      border-color: @fg_bright;
    }

    /* Audio/Voice tab switcher */
    #eq-tab-bar {
      margin-bottom: 0;
    }
    #eq-tab-btn {
      background: #0a1018;
      border: 1px solid @bg_lighter;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      padding: 4px 8px;
      margin: 0 1px;
    }
    #eq-tab-btn:hover {
      background: #152028;
    }
    #eq-tab-btn.active {
      background: @bg;
      border-color: @bg_lighter;
      border-bottom: 1px solid @bg;
    }
    #eq-tab-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: @fg_dim;
    }
    #eq-tab-btn:hover #eq-tab-label {
      color: @fg_dim;
    }
    #eq-tab-btn.active #eq-tab-label {
      color: @cyan_bright;
    }

    /* ============ EQ PANELS (Audio & Display) ============ */
    #eq-panel {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    #eq-panel #control-header {
      margin-bottom: 6px;
    }
    #eq-columns {
      margin-top: 4px;
    }
    #eq-col {
      min-width: 0;
      padding: 0;
      margin: 0 3px;
    }
    #eq-col.disabled {
      opacity: 0.3;
    }
    /* Segment row — single styled bar per segment */
    #eq-seg {
      min-height: 7px;
      min-width: 0;
      padding: 0;
      margin: 0;
      border-radius: 1px;
      border: 1px solid rgba(4, 6, 8, 0.85);
    }
    /* Unlit */
    #eq-seg.unlit {
      background: alpha(@bg_lighter, 0.3);
    }
    /* Default lit (cyan) — fallback */
    #eq-seg.lit {
      background: @accent;
      box-shadow: inset 0 0 2px alpha(@fg_bright, 0.3);
    }
    /* Visualizer tiers — famicom red, fades up */
    #eq-seg.lit-hi {
      background: #c02030;
      box-shadow: inset 0 0 2px alpha(#e03040, 0.3);
    }
    #eq-seg.lit-mid {
      background: alpha(#b01828, 0.7);
    }
    #eq-seg.lit-lo {
      background: alpha(#a01020, 0.45);
    }
    #eq-seg.lit-dim {
      background: alpha(#901020, 0.3);
    }
    /* Peak head — bright red */
    #eq-seg.peak {
      background: #e83030;
      box-shadow: inset 0 0 3px alpha(#ff5050, 0.5), 0 0 4px alpha(#e83030, 0.5);
    }
    /* Gain setting — faded white marker */
    #eq-seg.gain-mark {
      background: alpha(#d0d0d0, 0.5);
    }
    /* Warm (temperature) */
    #eq-seg.lit.eq-warm {
      background: #d0a060;
      box-shadow: inset 0 0 2px alpha(#e0b870, 0.3);
    }
    #eq-seg.peak.eq-warm {
      background: #ffe0a0;
      box-shadow: inset 0 0 3px alpha(@fg_bright, 0.4), 0 0 4px alpha(#d0a060, 0.4);
    }
    /* Gamma (purple) */
    #eq-seg.lit.eq-gamma {
      background: #a080d0;
      box-shadow: inset 0 0 2px alpha(#b090e0, 0.3);
    }
    #eq-seg.peak.eq-gamma {
      background: #d0b0ff;
      box-shadow: inset 0 0 3px alpha(@fg_bright, 0.4), 0 0 4px alpha(#a080d0, 0.4);
    }
    /* Red */
    #eq-seg.lit.eq-red {
      background: #d06060;
      box-shadow: inset 0 0 2px alpha(#e08080, 0.3);
    }
    #eq-seg.peak.eq-red {
      background: #ff9090;
      box-shadow: inset 0 0 3px alpha(@fg_bright, 0.4), 0 0 4px alpha(#d06060, 0.4);
    }
    /* Green */
    #eq-seg.lit.eq-green {
      background: #60d070;
      box-shadow: inset 0 0 2px alpha(#80e090, 0.3);
    }
    #eq-seg.peak.eq-green {
      background: #a0ffa0;
      box-shadow: inset 0 0 3px alpha(@fg_bright, 0.4), 0 0 4px alpha(#60d070, 0.4);
    }
    /* Blue */
    #eq-seg.lit.eq-blue {
      background: #6080d0;
      box-shadow: inset 0 0 2px alpha(#80a0e0, 0.3);
    }
    #eq-seg.peak.eq-blue {
      background: #a0c0ff;
      box-shadow: inset 0 0 3px alpha(@fg_bright, 0.4), 0 0 4px alpha(#6080d0, 0.4);
    }
    /* White cap */
    #eq-seg.lit.eq-cap {
      background: #909898;
      box-shadow: inset 0 0 2px alpha(#b0b8b8, 0.3);
    }
    #eq-seg.peak.eq-cap {
      background: #c0c8c8;
      box-shadow: inset 0 0 3px alpha(@fg_bright, 0.4), 0 0 4px alpha(#909898, 0.4);
    }
    #eq-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: @fg_dim;
      margin-top: 4px;
    }
    /* Horizontal volume/brightness bar */
    #eq-hbar {
      margin-top: 8px;
      min-height: 14px;
    }
    /* Inline bar inside header row */
    #eq-hbar-inline {
      margin: 0 8px;
      min-height: 10px;
    }
    #eq-hbar-inline #eq-hseg {
      min-height: 10px;
    }
    #eq-hseg {
      min-width: 0;
      min-height: 14px;
      border-radius: 1px;
      border: 1px solid rgba(4, 6, 8, 0.85);
      padding: 0;
      margin: 0;
    }
    #eq-hseg.unlit {
      background: alpha(@bg_lighter, 0.3);
    }
    #eq-hseg.lit {
      background: @accent;
      box-shadow: inset 0 0 2px alpha(@fg_bright, 0.3);
    }
    /* Preset buttons */
    #eq-presets {
      margin-top: 8px;
    }
    #eq-preset-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 3px;
      padding: 4px 6px;
      margin: 0 2px;
    }
    #eq-preset-btn:hover {
      background: @bg_light;
      border-color: @gray;
    }
    #eq-preset-btn.active {
      background: @bg_light;
      border: 1px solid @accent;
      box-shadow: inset 0 0 8px alpha(@accent, 0.3);
    }
    #eq-preset-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: @fg_dim;
    }
    #eq-preset-btn:hover #eq-preset-label {
      color: @fg;
    }
    #eq-preset-btn.active #eq-preset-label {
      color: @fg_bright;
    }

    /* Muted state — dims header, red icon */
    #eq-panel #control-header.muted {
      opacity: 0.7;
    }
    #eq-panel #control-header.muted #control-icon {
      color: #c04040;
    }
    #eq-panel #control-header.muted #control-label {
      color: #6a3030;
    }
    #eq-panel #control-header.muted #control-value {
      opacity: 0;
    }
    #control-muted-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #c04040;
    }

    /* Noise cancellation toggle */
    #voice-nc-toggle {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 3px;
      padding: 2px 8px;
      margin-right: 8px;
    }
    #voice-nc-toggle:hover {
      border-color: @gray;
    }
    #voice-nc-toggle.active {
      background: alpha(#40c060, 0.15);
      border-color: #40c060;
    }
    #voice-nc-toggle #control-label {
      color: @fg_dim;
    }
    #voice-nc-toggle.active #control-label {
      color: #40c060;
    }
    #eq-hbar-inline.disabled {
      opacity: 0.3;
    }

    /* Output device selector button */
    #eq-output-selector {
      background: alpha(@bg_light, 0.4);
      border: 1px solid @bg_lighter;
      border-radius: 3px;
      padding: 6px 10px;
      margin-bottom: 4px;
    }
    #eq-output-selector:hover {
      background: alpha(@bg_lighter, 0.6);
      border-color: @gray;
    }
    #eq-output-icon {
      font-size: 12px;
      color: @fg_dim;
      margin-right: 8px;
    }
    #eq-output-name {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      color: @fg_dim;
    }
    #eq-output-selector:hover #eq-output-name {
      color: @fg_bright;
    }
    #eq-output-arrow {
      font-size: 10px;
      color: @fg_dim;
      margin-left: 6px;
    }

    /* Output device overlay dropdown */
    #eq-output-scroll {
      background: @bg;
      border: 1px solid #2a4a5a;
      border-radius: 4px;
      min-width: 216px;
      min-height: 200px;
    }
    #eq-output-list {
      background: transparent;
      padding: 3px;
    }
    #eq-output-btn {
      background: #10202e;
      border: 1px solid @bg_lighter;
      border-radius: 3px;
      padding: 8px 12px;
      margin: 1px 0;
      box-shadow: none;
      transition: none;
    }
    #eq-output-btn:hover {
      background: #1a3040;
      border-color: @gray;
    }
    #eq-output-btn.active {
      background: #1a3040;
      border-color: @accent;
    }
    #eq-output-btn label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #70b0c0;
      transition: none;
    }
    #eq-output-btn:hover label {
      color: @fg_bright;
    }
    #eq-output-btn.active label {
      color: @fg_bright;
    }
    #eq-output-list,
    #eq-output-list * {
      transition: none;
    }

    /* ============ BREAK POPUP OVERLAY ============ */
    #break-popup-overlay {
      background: alpha(@bg_dark, 0.85);
    }
    #break-popup-panel {
      background: alpha(@bg, 0.95);
      border: 2px solid @accent;
      border-radius: 8px;
      padding: 40px 50px;
      box-shadow: 0 0 40px alpha(@accent, 0.3),
                  0 0 80px alpha(@accent, 0.1);
    }
    #break-popup-title {
      color: @fg_bright;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 4px;
      margin-bottom: 16px;
    }
    #break-popup-timer {
      color: @cyan_bright;
      font-size: 56px;
      font-weight: 700;
      letter-spacing: 4px;
      margin-bottom: 12px;
    }
    #break-popup-block-label {
      color: @cyan;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      margin-bottom: 20px;
    }
    #break-popup-hint {
      color: @fg_dim;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 2px;
    }

    /* ============ THEME SELECTOR ============ */
    #theme-selector {
      padding: 4px 12px 10px 12px;
    }
    #theme-header {
      color: @cyan;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 6px;
    }
    #theme-selector flowboxchild {
      background: transparent;
      padding: 0;
      border: none;
    }
    #theme-btn {
      background: @bg;
      border: 1px solid @bg_lighter;
      border-radius: 6px;
      padding: 4px 10px;
      transition: all 150ms ease;
    }
    #theme-btn:hover {
      border-color: @gray;
      background: @bg_light;
    }
    #theme-btn.active {
      border-color: @accent;
      background: @bg_light;
      box-shadow: 0 0 10px alpha(@accent, 0.25);
    }
    #theme-swatch {
      font-size: 11px;
    }
    #theme-name {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1px;
      margin-left: 1px;
      color: @fg_dim;
    }
    #theme-btn.active #theme-name {
      color: @fg_bright;
    }

    /* ============ WORKSPACE OSD ============ */
    #ws-osd {
      background: alpha(@bg, 0.92);
      border: 1px solid @accent;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 8px 22px;
      box-shadow: 0 0 24px alpha(@accent, 0.25),
                  0 0 48px alpha(@accent, 0.08);
    }
    #ws-osd-label {
      color: @fg_bright;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 4px;
      margin: 0 12px;
    }
    #ws-osd-brackets {
      color: @fg_dim;
      font-size: 12px;
    }

    /* ============ TASK POPUP OVERLAY ============ */
    #task-popup-overlay {
      background: alpha(@bg_dark, 0.75);
    }
    #task-popup-panel {
      background: alpha(@bg, 0.95);
      border: 2px solid #d4a847;
      border-radius: 8px;
      padding: 32px 44px;
      box-shadow: 0 0 40px alpha(#d4a847, 0.25),
                  0 0 80px alpha(#d4a847, 0.08);
    }
    #task-popup-label {
      color: #d4a847;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 4px;
      margin-bottom: 12px;
    }
    #task-popup-title {
      color: #f0e6c8;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 16px;
    }
    #task-popup-hint {
      color: @fg_dim;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 2px;
    }
  `

function defineColors(c: ThemeColors): string {
  return (Object.keys(c) as (keyof ThemeColors)[])
    .map((k) => `@define-color ${k} ${c[k]};`)
    .join("\n")
}

function generateCSS(c: ThemeColors): string {
  return defineColors(c) + "\n" + STATIC_CSS
}

// Get current theme name from file, default to mech
function getCurrentThemeName(): string {
  try {
    const current = readFile(`${THEME_DIR}/.current`)
    return current?.trim() || "mech"
  } catch {
    return "mech"
  }
}

// Initialize theme on startup
export function initTheme() {
  const themeName = getCurrentThemeName()
  const theme = loadTheme(themeName)
  if (theme) {
    app.apply_css(scaleCss(generateCSS(theme.colors)), true)
    print(`Loaded theme: ${themeName}`)
  }
}

// Re-apply the current theme's CSS without changing the theme. Used when the
// display scale (U) changes so the regenerated, rescaled stylesheet takes effect.
export function reapplyCss() {
  const theme = loadTheme(getCurrentThemeName())
  if (theme) app.apply_css(scaleCss(generateCSS(theme.colors)), true)
}

export async function applyTheme(themeName: string) {
  const theme = loadTheme(themeName)
  if (!theme) {
    print(`Theme not found: ${themeName}`)
    return
  }

  print(`Applying theme: ${themeName}`)
  const c = theme.colors

  // Update AGS CSS (this will smoothly transition)
  app.apply_css(scaleCss(generateCSS(c)), true)

  // Apply to foot terminal
  const footConfig = GLib.get_home_dir() + "/.config/foot/foot.ini"
  try {
    let foot = readFile(footConfig) || ""
    foot = foot.replace(/^background=.*/m, `background=${stripHash(c.bg)}`)
    foot = foot.replace(/^foreground=.*/m, `foreground=${stripHash(c.fg)}`)
    foot = foot.replace(/^regular0=.*/m, `regular0=${stripHash(c.bg_light)}`)
    foot = foot.replace(/^regular1=.*/m, `regular1=${stripHash(c.red)}`)
    foot = foot.replace(/^regular2=.*/m, `regular2=${stripHash(c.green)}`)
    foot = foot.replace(/^regular3=.*/m, `regular3=${stripHash(c.yellow)}`)
    foot = foot.replace(/^regular4=.*/m, `regular4=${stripHash(c.blue)}`)
    foot = foot.replace(/^regular5=.*/m, `regular5=${stripHash(c.magenta)}`)
    foot = foot.replace(/^regular6=.*/m, `regular6=${stripHash(c.cyan)}`)
    foot = foot.replace(/^regular7=.*/m, `regular7=${stripHash(c.fg_dim)}`)
    foot = foot.replace(/^bright0=.*/m, `bright0=${stripHash(c.gray)}`)
    foot = foot.replace(/^bright1=.*/m, `bright1=${stripHash(c.red_bright)}`)
    foot = foot.replace(/^bright2=.*/m, `bright2=${stripHash(c.green_bright)}`)
    foot = foot.replace(/^bright3=.*/m, `bright3=${stripHash(c.yellow_bright)}`)
    foot = foot.replace(/^bright4=.*/m, `bright4=${stripHash(c.blue_bright)}`)
    foot = foot.replace(/^bright5=.*/m, `bright5=${stripHash(c.magenta_bright)}`)
    foot = foot.replace(/^bright6=.*/m, `bright6=${stripHash(c.cyan_bright)}`)
    foot = foot.replace(/^bright7=.*/m, `bright7=${stripHash(c.fg_bright)}`)
    writeFile(footConfig, foot)
    print("  Updated foot")
  } catch (e) {
    print(`  Error updating foot: ${e}`)
  }

  // Apply GTK settings
  const gtk = theme.gtk
  await execAsync(`gsettings set org.gnome.desktop.interface gtk-theme '${gtk.theme}'`).catch(() => {})
  await execAsync(`gsettings set org.gnome.desktop.interface icon-theme '${gtk.iconTheme}'`).catch(() => {})
  await execAsync(`gsettings set org.gnome.desktop.interface cursor-theme '${gtk.cursorTheme}'`).catch(() => {})
  await execAsync(`gsettings set org.gnome.desktop.interface color-scheme '${gtk.colorScheme}'`).catch(() => {})

  // Force GTK apps to reload theme by toggling it
  await execAsync(`gsettings set org.gnome.desktop.interface gtk-theme ''`).catch(() => {})
  await execAsync(`gsettings set org.gnome.desktop.interface gtk-theme '${gtk.theme}'`).catch(() => {})

  print("  Updated GTK")

  // Apply Hyprland settings
  const hypr = theme.hyprland
  await execAsync(`hyprctl keyword general:gaps_in ${hypr.gapsIn}`).catch(() => {})
  await execAsync(`hyprctl keyword general:gaps_out ${hypr.gapsOut}`).catch(() => {})
  await execAsync(`hyprctl keyword general:border_size ${hypr.borderSize}`).catch(() => {})
  await execAsync(`hyprctl keyword decoration:rounding ${hypr.borderRadius}`).catch(() => {})
  await execAsync(`hyprctl keyword general:col.active_border "rgb(${stripHash(c.bg_dark)})"`).catch(() => {})
  await execAsync(`hyprctl keyword general:col.inactive_border "rgb(${stripHash(c.bg_dark)})"`).catch(() => {})
  await execAsync(`hyprctl setcursor ${gtk.cursorTheme} 20`).catch(() => {})
  print("  Updated Hyprland")

  // Save current theme name
  writeFile(`${THEME_DIR}/.current`, themeName)
  print(`Theme applied: ${themeName}`)
}

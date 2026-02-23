import { readFile, writeFile } from "ags/file"
import { execAsync } from "ags/process"
import app from "ags/gtk3/app"

const THEME_DIR = "/home/Angel/.config/themes"

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

// Generate CSS from theme colors using widget names
function generateCSS(c: ThemeColors): string {
  return `
    /* === STAR WARS TERMINAL THEME === */

    * {
      font-family: "JetBrainsMono Nerd Font", "CaskaydiaCove Nerd Font", monospace;
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
      background: transparent;
      border: none;
    }
    scrollbar trough {
      background: transparent;
      border: none;
    }
    scrollbar slider {
      background: alpha(#3a5060, 0.5);
      border-radius: 4px;
      min-width: 6px;
    }
    scrollbar slider:hover {
      background: alpha(#60c0d0, 0.5);
    }

    /* Sidebar container - Holographic */
    #sidebar-bg {
      background: #040608;
      border-radius: 0;
      padding: 0;
      border: 1px solid #1a2530;
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
      background: #040608;
    }

    /* Tab Bar - Holographic navigation */
    #tab-bar {
      background: #040608;
      border-bottom: 1px solid #1a2530;
      padding: 6px 6px;
    }
    #tab-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 8px 6px;
      margin: 0 3px;
      min-width: 46px;
    }
    #tab-btn:hover {
      background: #1b2730;
      border-color: #3a5060;
    }
    #tab-btn.active {
      background: #152834;
      border: 1px solid #60c0d0;
      box-shadow: inset 0 0 12px alpha(#60d0e0, 0.3);
    }
    #tab-icon {
      font-size: 18px;
      color: #4a6070;
      margin-bottom: 2px;
    }
    #tab-btn:hover #tab-icon {
      color: #6080a0;
    }
    #tab-btn.active #tab-icon {
      color: #80e0f0;
    }
    #tab-label {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #4a6070;
    }
    #tab-btn:hover #tab-label {
      color: #6080a0;
    }
    #tab-btn.active #tab-label {
      color: #80e0f0;
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
      background: #040608;
    }
    #planner-header {
      margin-bottom: 8px;
    }
    #planner-info-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 4px 8px;
      margin-right: 4px;
    }
    #planner-info-btn:hover {
      background: #1b2730;
      border-color: #60c0d0;
    }
    #planner-info-btn label {
      color: #5a8090;
      font-size: 10px;
      font-weight: 700;
      font-style: italic;
    }
    #planner-info-btn:hover label {
      color: #80e0f0;
    }
    #planner-info-panel {
      background: alpha(#0a1520, 0.8);
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 10px 12px;
      margin: 4px 8px 8px 8px;
    }
    #planner-info-text {
      color: #5a8090;
      font-size: 10px;
    }
    #planner-reload-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 4px 8px;
    }
    #planner-reload-btn:hover {
      background: #1b2730;
      border-color: #60c0d0;
    }
    #planner-reload-btn label {
      color: #5a8090;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    #planner-reload-btn:hover label {
      color: #80e0f0;
    }
    #planner-date-nav {
      margin-bottom: 6px;
      padding: 4px 0;
    }
    #planner-nav-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 4px 10px;
      margin: 0 4px;
    }
    #planner-nav-btn:hover {
      background: #1b2730;
      border-color: #60c0d0;
    }
    #planner-nav-btn label {
      color: #5a8090;
      font-size: 12px;
    }
    #planner-nav-btn:hover label {
      color: #80e0f0;
    }
    #planner-date {
      color: #70c0d0;
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
      background: #253540;
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
      border-left: 3px solid #50b8d0;
      border-radius: 3px;
      padding: 1px 8px;
    }
    #plan-event-time {
      color: #80a8b8;
      font-size: 10px;
      font-weight: 700;
    }
    #plan-event-text {
      color: #c0e4f0;
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
      background: alpha(#60c0d0, 0.15);
      border-radius: 3px;
    }
    #planner-dots-btn label {
      color: #5a8090;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    #planner-dots-btn:hover label {
      color: #80e0f0;
    }

    /* Popover menu */
    popover.background {
      background-color: #0a1520;
      border: 1px solid #2a3a45;
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
      background: alpha(#60c0d0, 0.15);
    }
    #planner-popover-item label {
      color: #c0e4f0;
      font-size: 11px;
      font-weight: 600;
    }
    #planner-popover-item:hover label {
      color: #80e0f0;
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
      color: #c0e4f0;
      border: 1px solid #50b8d0;
      border-radius: 3px;
      padding: 2px 8px;
      font-size: 10px;
      caret-color: #50b8d0;
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
      color: #5090a0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 14px;
    }
    #planner-empty-path {
      color: #70c0d0;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    #planner-empty-hint {
      color: #4a6070;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    #planner-panel {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    #planner-create-btn {
      background: #101820;
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
      color: #3a5060;
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
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 5px 12px;
      margin: 0 3px;
      min-width: 40px;
    }
    #planner-inner-tab:hover {
      background: #1b2730;
      border-color: #3a5060;
    }
    #planner-inner-tab.active {
      background: #152834;
      border: 1px solid #60c0d0;
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
      background: alpha(#1a2530, 0.4);
      border: 1px solid #2a3a45;
      border-radius: 3px;
      padding: 4px 8px;
      margin: 0 2px;
    }
    #kanban-subpane-tab:hover {
      background: alpha(#253540, 0.6);
      border-color: #3a5060;
    }
    #kanban-subpane-tab.active {
      background: alpha(#1a3040, 0.7);
      border: 1px solid #60c0d0;
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
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 2px 10px;
      margin: 0 3px;
      min-width: 40px;
    }
    button#kanban-board-selector:hover {
      background: #1b2730;
      border-color: #60c0d0;
    }
    button#kanban-board-selector label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #5a7888;
    }
    button#kanban-board-selector:hover label {
      color: #80e0f0;
    }
    #board-modal-backdrop {
      background: alpha(#000000, 0.6);
    }
    #board-modal {
      background: #0a1820;
      border: 1px solid #2a3a45;
      border-radius: 8px;
      padding: 20px 28px;
      min-width: 280px;
    }
    #board-modal-title {
      color: #70c0d0;
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
      border-left: 3px solid #50b8d0;
      border-radius: 3px;
      padding: 6px 8px;
      margin: 3px 4px;
    }
    #kanban-card.done {
      background: #0c1820;
      border-left: 2px solid #1e3a48;
    }
    #kanban-card-title {
      color: #c0e4f0;
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
      color: #50b8d0;
      background: alpha(#50b8d0, 0.12);
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
      background: alpha(#1a2530, 0.4);
      border: 1px solid #2a3a45;
      border-radius: 3px;
      padding: 2px 6px;
      margin: 0 1px;
    }
    #kanban-move-btn:hover {
      background: #1b2730;
      border-color: #60c0d0;
    }
    #kanban-move-btn label {
      font-size: 10px;
      font-weight: 700;
      color: #5a8090;
    }
    #kanban-move-btn:hover label {
      color: #80e0f0;
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
      border: 1px dashed #2a3a45;
      border-radius: 3px;
      padding: 6px 8px;
      margin: 6px 4px;
    }
    #kanban-add-btn:hover {
      background: alpha(#253540, 0.4);
      border-color: #60c0d0;
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
      color: #c0e4f0;
      border: 1px solid #50b8d0;
      border-radius: 3px;
      padding: 4px 8px;
      margin: 4px 4px;
      font-size: 10px;
      caret-color: #50b8d0;
    }
    /* ── Checklist items on card ── */
    #kanban-card-checklist-box {
      margin-top: 4px;
    }
    #kanban-card-check-row {
      padding: 1px 0;
    }
    #kanban-card-check-icon {
      color: #50b8d0;
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
       bg: #0d1117  surface: #161b22  border: #30363d
       text: #e6edf3  muted: #8b949e  link: #58a6ff
       ══════════════════════════════════════════════ */
    #cd-backdrop {
      background: alpha(#010409, 0.7);
    }
    #cd-panel {
      background: #0d1117;
      border: 1px solid #30363d;
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
      background: #0d1117;
      color: #e6edf3;
      border: 1px solid #58a6ff;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 24px;
      font-weight: 600;
      caret-color: #58a6ff;
    }

    /* Close X button */
    #cd-close-btn {
      background: transparent;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
    }
    #cd-close-btn:hover {
      background: alpha(#8b949e, 0.12);
    }
    #cd-close-btn label {
      color: #8b949e;
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
      background: #30363d;
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
      color: #8b949e;
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
      border: 1px solid #30363d;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    #cd-desc-header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      border-radius: 6px 6px 0 0;
      padding: 10px 16px;
    }
    #cd-desc-header label {
      font-size: 13px;
      font-weight: 600;
      color: #8b949e;
    }
    #cd-desc-scroll {
      background: #0d1117;
      border: none;
      border-radius: 0 0 6px 6px;
      padding: 0;
    }
    textview#cd-desc-view {
      background: #0d1117;
      color: #e6edf3;
    }
    textview#cd-desc-view text {
      background: #0d1117;
      color: #e6edf3;
      caret-color: #58a6ff;
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
      background: alpha(#161b22, 0.8);
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
      background: alpha(#30363d, 0.5);
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
      background: #0d1117;
      color: #8b949e;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      caret-color: #58a6ff;
    }
    #cd-add-entry:focus {
      background: #0d1117;
      color: #e6edf3;
      border-color: #58a6ff;
      box-shadow: 0 0 0 3px alpha(#58a6ff, 0.3);
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
      color: #8b949e;
      font-size: 13px;
      font-weight: 400;
      margin-top: 2px;
    }

    /* Move buttons in sidebar */
    #cd-move-btn {
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 6px 16px;
      margin-top: 8px;
    }
    #cd-move-btn:hover {
      background: #30363d;
      border-color: #8b949e;
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
      background: alpha(#8b949e, 0.12);
    }
    #cd-dots-btn label {
      color: #8b949e;
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
      color: #c0e4f0;
      border: 1px solid #50b8d0;
      border-radius: 3px;
      padding: 1px 6px;
      font-size: 10px;
      caret-color: #50b8d0;
      min-width: 60px;
    }

    /* ============ HOME PAGE - Holographic Star Citizen Style ============ */
    #home-page {
      padding: 12px;
      background: #040608;
    }

    /* Section Header */
    #section-header {
      color: #5090a0;
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
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 9999px;
      padding: 12px;
      margin: 0 4px;
      min-width: 52px;
      min-height: 52px;
    }
    #sys-toggle:hover {
      background: #1b2730;
      border-color: #3a5060;
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
      color: #4a6070;
    }
    #sys-toggle:hover #sys-toggle-label {
      color: #6080a0;
    }
    #sys-toggle.active #sys-toggle-label {
      color: #f5c842;
    }

    /* Clock Panel */
    #clock-panel {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 14px;
      margin-bottom: 10px;
    }
    #clock-time {
      color: #70c0d0;
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
      border-top: 1px solid #2a3a45;
      padding: 8px 0 0 0;
      margin-top: 6px;
    }
    #clock-alt-label {
      color: #4a6070;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    #clock-alt-time {
      color: #5a8090;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 2px;
    }

    /* Control Panels (Brightness/Volume) */
    #control-panel {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    #control-header {
      margin-bottom: 8px;
    }
    #control-icon {
      font-size: 14px;
      color: #5a8090;
      margin-right: 4px;
    }
    #control-icon-btn {
      background: transparent;
      border: none;
      padding: 2px 4px;
      margin-right: 4px;
    }
    #control-icon-btn:hover #control-icon {
      color: #80e0f0;
    }
    #control-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #4a6070;
    }
    #control-value {
      font-size: 11px;
      font-weight: 700;
      color: #70c0d0;
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
      background: alpha(#2a3a45, 0.5);
    }
    #control-segment.lit {
      background: #60c0d0;
    }
    #control-segment:hover {
      background: #3a5060;
    }
    #control-segment.lit:hover {
      background: #80e0f0;
    }

    /* Status Panel (Battery) */
    #status-panel {
      background: #101820;
      border: 1px solid #2a3a45;
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
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 10px 12px;
      margin: 0 4px;
      min-width: 64px;
      transition: all 150ms linear;
    }
    #tool-btn:hover {
      background: #152834;
      border-color: #60c0d0;
      box-shadow: inset 0 0 12px alpha(#60d0e0, 0.3);
    }
    #tool-btn-icon {
      font-size: 20px;
      color: #5a8090;
      margin-bottom: 4px;
    }
    #tool-btn:hover #tool-btn-icon {
      color: #80e0f0;
    }
    #tool-btn-label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #4a6070;
    }
    #tool-btn:hover #tool-btn-label {
      color: #80e0f0;
    }

    /* Wallpaper selector styles */
    #core-header {
      padding: 0 8px;
      margin-bottom: 4px;
    }
    #core-reload-btn {
      background: transparent;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 4px 8px;
      transition: all 150ms linear;
    }
    #core-reload-btn:hover {
      background: #1b2730;
      border-color: #60c0d0;
    }
    #core-reload-btn label {
      font-size: 14px;
      color: #4a6070;
    }
    #core-reload-btn:hover label {
      color: #80e0f0;
    }
    #wallpaper-tab-bar {
      background: #040608;
      border-bottom: 1px solid #1a2530;
      padding: 6px;
      margin-bottom: 4px;
    }
    #wallpaper-sub-tab-bar {
      background: alpha(#040608, 0.6);
      padding: 4px 6px;
      margin-bottom: 4px;
    }
    #wallpaper-sub-tab-btn {
      background: alpha(#1a2530, 0.4);
      border: 1px solid #1a2530;
      border-radius: 3px;
      padding: 4px 8px;
      margin: 0 2px;
      transition: all 150ms linear;
    }
    #wallpaper-sub-tab-btn:hover {
      background: alpha(#253540, 0.5);
      border-color: #3a5060;
    }
    #wallpaper-sub-tab-btn.active {
      background: alpha(#1a3040, 0.6);
      border: 1px solid #60c0d0;
    }
    #wallpaper-sub-tab-btn #tab-icon {
      font-size: 12px;
      color: #4a6070;
      margin-bottom: 1px;
    }
    #wallpaper-sub-tab-btn:hover #tab-icon {
      color: #6080a0;
    }
    #wallpaper-sub-tab-btn.active #tab-icon {
      color: #80e0f0;
    }
    #wallpaper-sub-tab-btn #tab-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #4a6070;
    }
    #wallpaper-sub-tab-btn:hover #tab-label {
      color: #6080a0;
    }
    #wallpaper-sub-tab-btn.active #tab-label {
      color: #80e0f0;
    }
    #wallpaper-tab-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 8px 12px;
      margin: 0 3px;
      transition: all 150ms linear;
    }
    #wallpaper-tab-btn:hover {
      background: #1b2730;
      border-color: #3a5060;
    }
    #wallpaper-tab-btn.active {
      background: #152834;
      border: 1px solid #60c0d0;
      box-shadow: inset 0 0 12px alpha(#60d0e0, 0.3);
    }
    #wallpaper-tab-btn #tab-icon {
      font-size: 16px;
      color: #4a6070;
      margin-bottom: 2px;
    }
    #wallpaper-tab-btn:hover #tab-icon {
      color: #6080a0;
    }
    #wallpaper-tab-btn.active #tab-icon {
      color: #80e0f0;
    }
    #wallpaper-tab-btn #tab-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #4a6070;
    }
    #wallpaper-tab-btn:hover #tab-label {
      color: #6080a0;
    }
    #wallpaper-tab-btn.active #tab-label {
      color: #80e0f0;
    }
    #wallpaper-thumb {
      background: alpha(#1a2530, 0.4);
      border: 1px solid #2a3a45;
      border-radius: 6px;
      padding: 4px;
      margin: 4px 0;
      transition: all 150ms linear;
    }
    #wallpaper-thumb:hover {
      background: alpha(#253540, 0.6);
      border-color: #60c0d0;
      box-shadow: 0 0 8px alpha(#60d0e0, 0.2);
    }
    #video-badge {
      background: alpha(#000000, 0.7);
      border-radius: 4px;
      padding: 4px 8px;
      margin: 6px;
    }
    #video-badge label {
      font-size: 12px;
      color: #80e0f0;
    }
    #video-name {
      font-size: 9px;
      font-weight: 600;
      color: #5a8090;
      margin-top: 4px;
      letter-spacing: 0.5px;
    }
    #wallpaper-empty {
      padding: 40px 20px;
    }
    #wallpaper-empty #status-icon {
      font-size: 32px;
      color: #3a5060;
      margin-bottom: 12px;
    }
    #wallpaper-empty #status-label {
      font-size: 10px;
      color: #4a6070;
    }
    #wallpaper-empty #status-sublabel {
      font-size: 8px;
      color: #3a5060;
      margin-top: 4px;
    }
    #movie-folder {
      margin: 2px 0;
    }
    #movie-folder-header {
      background: alpha(#1a2530, 0.5);
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 10px 12px;
      transition: all 150ms linear;
    }
    #movie-folder-header:hover {
      background: #1b2730;
      border-color: #3a5060;
    }
    #folder-arrow {
      font-size: 10px;
      color: #60c0d0;
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
      color: #4a6070;
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
      background: radial-gradient(circle at 30% 30%, #60c0d0, #1a4050);
      border: 2px solid #80e0f0;
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
      border-color: #ffffff;
      box-shadow: 0 0 50px rgba(160, 240, 255, 0.8),
                  0 0 100px rgba(96, 192, 208, 0.4);
    }
    #destination-center #destination-icon {
      font-size: 32px;
      color: #ffffff;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    }
    #destination-node {
      background: radial-gradient(circle at 30% 30%, #4a8090, #1a3040);
      border: 2px solid #5090a0;
      border-radius: 50%;
      box-shadow: 0 0 15px rgba(80, 144, 160, 0.4),
                  0 0 30px rgba(80, 144, 160, 0.1),
                  inset 0 0 10px rgba(255, 255, 255, 0.05);
      transition: all 200ms ease;
    }
    #destination-node:hover {
      border-color: #80e0f0;
      box-shadow: 0 0 25px rgba(96, 192, 208, 0.6),
                  0 0 50px rgba(96, 192, 208, 0.2),
                  inset 0 0 15px rgba(255, 255, 255, 0.1);
    }
    #destination-node.selected {
      background: radial-gradient(circle at 30% 30%, #60c0d0, #2a5060);
      border-color: #a0f0ff;
      box-shadow: 0 0 30px rgba(160, 240, 255, 0.7),
                  0 0 60px rgba(96, 192, 208, 0.3);
    }
    #destination-node #destination-icon {
      font-size: 20px;
      color: #a0d0e0;
      text-shadow: 0 0 5px rgba(160, 208, 224, 0.3);
    }
    #destination-node:hover #destination-icon {
      color: #ffffff;
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
      border: 1px solid #aa2233;
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
      color: #aa2233;
    }
    #toggle-label-btn {
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      border-radius: 0;
    }
    #toggle-label-btn:hover {
      background: alpha(#aa2233, 0.1);
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
      background: #aa2233;
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
      border-left: 2px solid #aa2233;
      padding: 10px 12px;
      margin-top: 10px;
    }
    #brightness-header {
      margin-bottom: 8px;
    }
    #brightness-icon {
      font-size: 14px;
      color: #aa2233;
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
      color: #aa2233;
      letter-spacing: 1px;
    }

    /* Volume Card - Red terminal panel */
    #volume-card {
      background: transparent;
      border-radius: 0;
      border: 1px solid #331111;
      border-left: 2px solid #aa2233;
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
      color: #aa2233;
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
      color: #aa2233;
      letter-spacing: 1px;
    }

    /* Battery Card - Compact style */
    #battery-card {
      background: transparent;
      border-radius: 0;
      border: 1px solid #331111;
      border-left: 2px solid #aa2233;
      padding: 10px 12px;
      margin-top: 10px;
      margin-bottom: 6px;
    }
    #battery-header {
      margin-bottom: 8px;
    }
    #battery-icon {
      font-size: 14px;
      color: #aa2233;
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
      color: #aa2233;
      letter-spacing: 1px;
    }
    #battery-status-icon {
      font-size: 10px;
      color: #aa2233;
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
      background: #aa2233;
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
      background: #040608;
    }
    #power-panel {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 12px;
    }
    #power-panel-header {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #2a3a45;
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
      border: 2px solid #60c0d0;
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
    }
    #power-segment.unlit {
      background: alpha(#2a3a45, 0.5);
    }
    #power-segment.lit {
      background: #60c0d0;
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
      border-top: 1px solid #2a3a45;
    }
    #power-footer-data {
      font-size: 9px;
      font-weight: 600;
      color: #90b0c0;
      letter-spacing: 2px;
    }

    /* App Launcher - Holographic Style (matches Home) */
    #search-container {
      margin-bottom: 10px;
    }
    #app-search {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 10px 14px;
      color: #70c0d0;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1px;
    }
    #app-search:focus {
      background: #1b2730;
      border-color: #60c0d0;
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
      background: #101820;
      border: none;
      border-radius: 4px;
      padding: 8px 10px;
      margin: 3px 0;
    }
    #app-item:hover {
      background: alpha(#253540, 0.8);
    }
    #app-item:active {
      background: alpha(#1a3040, 0.9);
      box-shadow: inset 0 0 12px alpha(#60d0e0, 0.3);
    }
    #app-icon {
      color: #5a8090;
      font-size: 20px;
      min-width: 20px;
      min-height: 20px;
    }
    #app-item:hover #app-icon {
      color: #70c0d0;
    }
    #app-name {
      color: #70c0d0;
      font-size: 10px;
      font-weight: 600;
    }

    /* ============ POMODORO PAGE - Holographic Style ============ */
    #pomo-page {
      padding: 12px;
      background: #040608;
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
      color: #5090a0;
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
      color: #4a6070;
    }
    #pomo-mode-row #sys-toggle.active #pomo-mode-label {
      color: #80e0f0;
    }
    #pomo-mode-row #sys-toggle:hover #pomo-mode-label {
      color: #6080a0;
    }

    /* Ratio presets row */
    #pomo-presets-row {
      margin-bottom: 8px;
    }
    #pomo-preset-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 6px 8px;
      margin: 0 3px;
      min-width: 44px;
    }
    #pomo-preset-btn:hover {
      background: #1b2730;
      border-color: #3a5060;
    }
    #pomo-preset-btn.active {
      background: #152834;
      border: 1px solid #60c0d0;
      box-shadow: inset 0 0 12px alpha(#60d0e0, 0.3);
    }
    #pomo-preset-btn label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #4a6070;
    }
    #pomo-preset-btn:hover label {
      color: #6080a0;
    }
    #pomo-preset-btn.active label {
      color: #80e0f0;
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
      color: #5090a0;
      min-width: 50px;
    }
    #pomo-adj-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 4px 10px;
      margin: 0 2px;
      min-width: 28px;
    }
    #pomo-adj-btn:hover {
      background: #1b2730;
      border-color: #3a5060;
    }
    #pomo-adj-btn label {
      font-size: 12px;
      font-weight: 700;
      color: #5a8090;
    }
    #pomo-adj-btn:hover label {
      color: #80e0f0;
    }
    #pomo-adj-value {
      font-size: 14px;
      font-weight: 700;
      color: #70c0d0;
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
      background: alpha(#2a3a45, 0.3);
      border: 1px solid #2a3a45;
    }
    #pomo-block-dot-btn.selected #pomo-block-dot {
      background: #8b0000;
      border: 1px solid #c03030;
      box-shadow: 0 0 6px alpha(#c03030, 0.5);
    }
    #pomo-block-dot-btn.completed #pomo-block-dot {
      background: alpha(#1a2530, 0.2);
      border: 1px solid alpha(#2a3a45, 0.2);
      box-shadow: none;
    }

    /* Control buttons */
    #pomo-controls-row {
      margin-bottom: 10px;
    }
    #pomo-start-btn {
      background: #101820;
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
      background: #101820;
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
      color: #70c0d0;
      margin: 0 8px;
      min-width: 80px;
    }
    #pomo-volume-panel {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }

    /* Vim focus highlight */
    .focused {
      box-shadow: 0 0 6px alpha(#60c0d0, 0.8), inset 0 0 4px alpha(#60c0d0, 0.3);
      border-color: #80e0f0;
    }

    /* ============ EQ PANELS (Audio & Display) ============ */
    #eq-panel {
      background: #101820;
      border: 1px solid #2a3a45;
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
      background: alpha(#2a3a45, 0.3);
    }
    /* Default lit (cyan) — fallback */
    #eq-seg.lit {
      background: #60c0d0;
      box-shadow: inset 0 0 2px alpha(#80e0f0, 0.3);
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
      box-shadow: inset 0 0 3px alpha(#ffffff, 0.4), 0 0 4px alpha(#d0a060, 0.4);
    }
    /* Gamma (purple) */
    #eq-seg.lit.eq-gamma {
      background: #a080d0;
      box-shadow: inset 0 0 2px alpha(#b090e0, 0.3);
    }
    #eq-seg.peak.eq-gamma {
      background: #d0b0ff;
      box-shadow: inset 0 0 3px alpha(#ffffff, 0.4), 0 0 4px alpha(#a080d0, 0.4);
    }
    /* Red */
    #eq-seg.lit.eq-red {
      background: #d06060;
      box-shadow: inset 0 0 2px alpha(#e08080, 0.3);
    }
    #eq-seg.peak.eq-red {
      background: #ff9090;
      box-shadow: inset 0 0 3px alpha(#ffffff, 0.4), 0 0 4px alpha(#d06060, 0.4);
    }
    /* Green */
    #eq-seg.lit.eq-green {
      background: #60d070;
      box-shadow: inset 0 0 2px alpha(#80e090, 0.3);
    }
    #eq-seg.peak.eq-green {
      background: #a0ffa0;
      box-shadow: inset 0 0 3px alpha(#ffffff, 0.4), 0 0 4px alpha(#60d070, 0.4);
    }
    /* Blue */
    #eq-seg.lit.eq-blue {
      background: #6080d0;
      box-shadow: inset 0 0 2px alpha(#80a0e0, 0.3);
    }
    #eq-seg.peak.eq-blue {
      background: #a0c0ff;
      box-shadow: inset 0 0 3px alpha(#ffffff, 0.4), 0 0 4px alpha(#6080d0, 0.4);
    }
    #eq-label {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #4a6070;
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
      background: alpha(#2a3a45, 0.3);
    }
    #eq-hseg.lit {
      background: #60c0d0;
      box-shadow: inset 0 0 2px alpha(#80e0f0, 0.3);
    }
    /* Preset buttons */
    #eq-presets {
      margin-top: 8px;
    }
    #eq-preset-btn {
      background: #101820;
      border: 1px solid #2a3a45;
      border-radius: 3px;
      padding: 4px 6px;
      margin: 0 2px;
    }
    #eq-preset-btn:hover {
      background: #1b2730;
      border-color: #3a5060;
    }
    #eq-preset-btn.active {
      background: #152834;
      border: 1px solid #60c0d0;
      box-shadow: inset 0 0 8px alpha(#60d0e0, 0.3);
    }
    #eq-preset-label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #4a6070;
    }
    #eq-preset-btn:hover #eq-preset-label {
      color: #6080a0;
    }
    #eq-preset-btn.active #eq-preset-label {
      color: #80e0f0;
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

    /* Output device selector button */
    #eq-output-selector {
      background: alpha(#1a2530, 0.4);
      border: 1px solid #2a3a45;
      border-radius: 3px;
      padding: 6px 10px;
      margin-bottom: 4px;
    }
    #eq-output-selector:hover {
      background: alpha(#253540, 0.6);
      border-color: #3a5060;
    }
    #eq-output-icon {
      font-size: 12px;
      color: #5a8090;
      margin-right: 8px;
    }
    #eq-output-name {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #5a8090;
    }
    #eq-output-selector:hover #eq-output-name {
      color: #80e0f0;
    }
    #eq-output-arrow {
      font-size: 10px;
      color: #4a6070;
      margin-left: 6px;
    }

    /* Output device overlay dropdown */
    #eq-output-scroll {
      background: #0a1520;
      border: 1px solid #2a4a5a;
      border-radius: 4px;
      min-width: 216px;
    }
    #eq-output-list {
      background: transparent;
      padding: 3px;
    }
    #eq-output-btn {
      background: #10202e;
      border: 1px solid #2a3a45;
      border-radius: 3px;
      padding: 4px 10px;
      margin: 1px 0;
      box-shadow: none;
      transition: none;
    }
    #eq-output-btn:hover {
      background: #1a3040;
      border-color: #3a5060;
    }
    #eq-output-btn.active {
      background: #1a3040;
      border-color: #60c0d0;
    }
    #eq-output-btn label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #70b0c0;
      transition: none;
    }
    #eq-output-btn:hover label {
      color: #80e0f0;
    }
    #eq-output-btn.active label {
      color: #80e0f0;
    }
    #eq-output-list,
    #eq-output-list * {
      transition: none;
    }

    /* ============ BREAK POPUP OVERLAY ============ */
    #break-popup-overlay {
      background: alpha(#040608, 0.85);
    }
    #break-popup-panel {
      background: alpha(#0a1520, 0.95);
      border: 2px solid #60c0d0;
      border-radius: 8px;
      padding: 40px 50px;
      box-shadow: 0 0 40px alpha(#60d0e0, 0.3),
                  0 0 80px alpha(#60d0e0, 0.1);
    }
    #break-popup-title {
      color: #80e0f0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 4px;
      margin-bottom: 16px;
    }
    #break-popup-timer {
      color: #70c0d0;
      font-size: 56px;
      font-weight: 700;
      letter-spacing: 4px;
      margin-bottom: 12px;
    }
    #break-popup-block-label {
      color: #5090a0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      margin-bottom: 20px;
    }
    #break-popup-hint {
      color: #3a5060;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 2px;
    }

    /* ============ TASK POPUP OVERLAY ============ */
    #task-popup-overlay {
      background: alpha(#040608, 0.75);
    }
    #task-popup-panel {
      background: alpha(#0a1520, 0.95);
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
      color: #3a5060;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 2px;
    }
  `
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
    app.apply_css(generateCSS(theme.colors), true)
    print(`Loaded theme: ${themeName}`)
  }
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
  app.apply_css(generateCSS(c), true)

  // Apply to foot terminal
  const footConfig = "/home/Angel/.config/foot/foot.ini"
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

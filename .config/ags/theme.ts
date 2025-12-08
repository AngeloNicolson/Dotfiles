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
    * {
      font-family: "JetBrainsMono Nerd Font", "CaskaydiaCove Nerd Font", monospace;
      transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    window {
      background: transparent;
    }

    /* Sidebar container */
    #sidebar-bg {
      background: ${c.bg};
      border-radius: 0 16px 16px 0;
      padding: 4px;
    }

    #edge-strip {
      background: transparent;
      min-width: 3px;
      border-radius: 0 8px 8px 0;
      margin: 24px 0;
    }
    #edge-strip:hover {
      background: ${c.accent};
    }

    #page-box {
      padding: 24px 20px;
      min-width: 280px;
    }

    /* Typography */
    #title {
      color: ${c.fg};
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    #subtitle {
      color: ${c.fg_dim};
      font-size: 12px;
      font-weight: 400;
    }
    #title-blue {
      color: ${c.accent};
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    /* Theme Switcher */
    #theme-title {
      color: ${c.fg};
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 20px;
    }
    #theme-button {
      background: ${c.bg_light};
      border: none;
      border-radius: 10px;
      padding: 14px 18px;
      margin: 6px 0;
      min-width: 220px;
    }
    #theme-button:hover {
      background: ${c.bg_lighter};
    }
    #theme-button:active {
      background: alpha(${c.accent}, 0.15);
    }
    #theme-button label {
      color: ${c.fg};
      font-size: 13px;
      font-weight: 500;
    }

    /* Clock */
    #clock {
      color: ${c.fg};
      font-size: 56px;
      font-weight: 300;
      letter-spacing: -2px;
      margin-bottom: 2px;
    }
    #date {
      color: ${c.fg_dim};
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.3px;
      margin-bottom: 16px;
    }
    #secondary-clock-box {
      background: alpha(${c.bg_lighter}, 0.5);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 24px;
    }
    #clock-secondary {
      color: ${c.fg};
      font-size: 18px;
      font-weight: 400;
    }
    #clock-location {
      color: ${c.fg_dim};
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    /* Quick Toggles */
    #quick-toggles-row {
      padding: 4px 0;
    }
    #toggle-container {
      margin: 6px 10px;
    }
    #quick-toggle {
      background: ${c.bg_light};
      border-radius: 16px;
      padding: 0;
      margin: 0 0 6px 0;
      min-width: 52px;
      min-height: 52px;
      border: none;
    }
    #quick-toggle:hover {
      background: ${c.bg_lighter};
    }
    #quick-toggle.active {
      background: alpha(${c.accent}, 0.15);
    }
    #quick-toggle.active:hover {
      background: alpha(${c.accent}, 0.22);
    }
    #toggle-icon {
      font-size: 22px;
      color: ${c.fg_dim};
    }
    #quick-toggle:hover #toggle-icon {
      color: ${c.fg};
    }
    #quick-toggle.active #toggle-icon {
      color: ${c.accent};
    }
    #toggle-label-btn {
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      border-radius: 4px;
    }
    #toggle-label-btn:hover {
      background: alpha(${c.fg_dim}, 0.1);
    }
    #toggle-label {
      font-size: 9px;
      color: ${c.fg_dim};
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    #toggle-label-btn #toggle-label {
      padding: 3px 6px;
    }

    /* Sliders */
    #sliders-box {
      margin-top: 20px;
      padding: 0 4px;
    }
    #slider-box {
      margin: 10px 0;
    }
    #slider-icon {
      color: ${c.fg_dim};
      font-size: 16px;
      margin-right: 12px;
    }
    #slider-icon-btn {
      font-size: 16px;
      margin-right: 12px;
      border: none;
      border-radius: 6px;
      padding: 6px 8px;
      background: transparent;
      min-width: 32px;
    }
    #slider-icon-btn:hover {
      background: alpha(${c.fg_dim}, 0.1);
    }
    #slider-icon-btn.active {
      background: alpha(${c.accent}, 0.2);
    }
    #slider-icon-btn.active #slider-icon {
      color: ${c.accent};
    }
    #volume-slider, #brightness-slider {
      min-width: 160px;
      min-height: 4px;
    }
    #volume-slider trough, #brightness-slider trough {
      background: alpha(${c.fg_dim}, 0.15);
      border-radius: 2px;
      min-height: 4px;
    }
    #volume-slider highlight, #brightness-slider highlight {
      background: ${c.accent};
      border-radius: 2px;
    }
    #volume-slider slider, #brightness-slider slider {
      background: ${c.fg};
      border-radius: 50%;
      min-width: 14px;
      min-height: 14px;
      margin: -5px 0;
      box-shadow: 0 1px 4px alpha(black, 0.3);
    }
    #volume-slider slider:hover, #brightness-slider slider:hover {
      background: ${c.fg_bright};
    }

    /* App Launcher */
    #search-container {
      margin-bottom: 12px;
    }
    #app-search {
      background: ${c.bg_light};
      border: none;
      border-radius: 10px;
      padding: 12px 16px;
      color: ${c.fg};
      font-size: 12px;
      font-weight: 500;
    }
    #app-search:focus {
      background: ${c.bg_lighter};
    }
    #app-list-scroll {
      margin-top: 8px;
    }
    #app-item {
      background: transparent;
      border: none;
      border-radius: 10px;
      padding: 10px 12px;
      margin: 2px 0;
      min-width: 240px;
    }
    #app-item:hover {
      background: ${c.bg_light};
    }
    #app-item:active {
      background: ${c.bg_lighter};
    }
    #app-icon-container {
      background: alpha(${c.accent}, 0.1);
      border: none;
      border-radius: 10px;
      padding: 8px;
      min-width: 40px;
      min-height: 40px;
    }
    #app-icon {
      color: ${c.accent};
      font-size: 22px;
    }
    #app-name {
      color: ${c.fg};
      font-size: 12px;
      font-weight: 600;
    }
    #app-description {
      color: ${c.fg_dim};
      font-size: 10px;
      font-weight: 400;
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

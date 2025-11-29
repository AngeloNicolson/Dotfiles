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
      transition: 300ms ease;
    }
    #sidebar-bg {
      background: ${c.bg_light};
    }
    #edge-strip {
      background: ${c.bg_lighter};
      min-width: 4px;
      border-radius: 0 4px 4px 0;
    }
    #page-box {
      padding: 20px;
      min-width: 250px;
      min-height: 400px;
    }
    #title {
      color: ${c.fg};
      font-size: 24px;
    }
    #subtitle {
      color: ${c.fg_dim};
      font-size: 14px;
    }
    #title-blue {
      color: ${c.blue_bright};
      font-size: 24px;
    }
    #theme-title {
      color: ${c.fg};
      font-size: 20px;
      margin-bottom: 16px;
    }
    #theme-button {
      background: ${c.bg_lighter};
      border: none;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 4px 0;
      min-width: 200px;
    }
    #theme-button:hover {
      background: ${c.gray};
    }
    #theme-button label {
      color: ${c.fg};
      font-size: 14px;
    }

    /* Clock */
    #clock {
      color: ${c.fg};
      font-size: 48px;
      font-weight: bold;
    }
    #date {
      color: ${c.fg_dim};
      font-size: 14px;
      margin-bottom: 12px;
    }
    #secondary-clock-box {
      margin-bottom: 20px;
    }
    #clock-secondary {
      color: ${c.fg_dim};
      font-size: 20px;
    }
    #clock-location {
      color: ${c.gray};
      font-size: 11px;
    }

    /* Quick toggles */
    #quick-toggles-row {
      margin: 4px 0;
    }
    #quick-toggle {
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 2px 4px;
      min-width: 100px;
      background: ${c.bg_lighter};
    }
    #quick-toggle.active {
      background: ${c.accent};
    }
    #quick-toggle:hover {
      background: ${c.gray};
    }
    #toggle-icon {
      color: ${c.fg};
      font-size: 16px;
      margin-right: 8px;
    }
    #toggle-label {
      color: ${c.fg};
      font-size: 12px;
    }

    /* Sliders */
    #sliders-box {
      margin-top: 16px;
    }
    #slider-box {
      margin: 8px 0;
    }
    #slider-icon {
      color: ${c.fg};
      font-size: 18px;
    }
    #slider-icon-btn {
      font-size: 18px;
      margin-right: 10px;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      background: transparent;
    }
    #slider-icon-btn.active {
      background: ${c.accent};
    }
    #volume-slider, #brightness-slider {
      min-width: 180px;
      min-height: 8px;
    }
    #volume-slider trough, #brightness-slider trough {
      background: ${c.bg_lighter};
      border-radius: 4px;
      min-height: 8px;
    }
    #volume-slider highlight, #brightness-slider highlight {
      background: ${c.accent};
      border-radius: 4px;
    }
    #volume-slider slider, #brightness-slider slider {
      background: ${c.fg};
      border-radius: 50%;
      min-width: 16px;
      min-height: 16px;
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

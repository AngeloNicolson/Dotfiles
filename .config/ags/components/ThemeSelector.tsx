import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=3.0"
import { createState } from "ags"
import { readFile } from "ags/file"
import { execAsync } from "ags/process"
import { applyTheme, loadTheme, type Theme } from "../theme"

const THEME_DIR = GLib.get_home_dir() + "/.config/themes"
const APPLY_SCRIPT = THEME_DIR + "/apply-theme.sh"

function listThemes(): Theme[] {
  const themes: Theme[] = []
  try {
    const dir = GLib.Dir.open(THEME_DIR, 0)
    let name: string | null
    while ((name = dir.read_name()) !== null) {
      if (!name.endsWith(".json")) continue
      const theme = loadTheme(name.slice(0, -5))
      if (theme) themes.push(theme)
    }
    dir.close()
  } catch {}
  return themes.sort((a, b) => a.name.localeCompare(b.name))
}

const [currentTheme, setCurrentTheme] = createState(
  (readFile(`${THEME_DIR}/.current`) || "").trim(),
)

function switchTheme(name: string) {
  setCurrentTheme(name)
  // applyTheme covers shell CSS/foot/GTK/Hyprland in-process; the script adds
  // dunst + nvim + TUI repaints. Run it after so foot.ini writes don't race.
  applyTheme(name)
    .then(() => execAsync([APPLY_SCRIPT, name]))
    .catch((e) => print(`ThemeSelector: ${e}`))
}

export default function ThemeSelector() {
  const themes = listThemes()

  // FlowBox so the row wraps as the theme collection grows instead of
  // clipping off the sidebar edge.
  const flow = new Gtk.FlowBox({
    selection_mode: Gtk.SelectionMode.NONE,
    min_children_per_line: 2,
    max_children_per_line: 3,
    row_spacing: 6,
    column_spacing: 6,
    homogeneous: false,
    halign: Gtk.Align.START,
  })

  for (const t of themes) {
    flow.add(
      (
        <button
          name="theme-btn"
          class={currentTheme.as((cur) => (cur === t.name ? "active" : ""))}
          onClicked={() => switchTheme(t.name)}
        >
          <box spacing={6}>
            <label
              name="theme-swatch"
              $={(self: Gtk.Label) =>
                self.set_markup(
                  `<span foreground="${t.colors.accent}">●</span>`,
                )
              }
            />
            <label name="theme-name" label={t.displayName.toUpperCase()} />
          </box>
        </button>
      ) as Gtk.Widget,
    )
  }
  flow.show_all()

  return (
    <box vertical name="theme-selector">
      <label name="theme-header" label="//THEME" halign={Gtk.Align.START} />
      {flow}
    </box>
  )
}

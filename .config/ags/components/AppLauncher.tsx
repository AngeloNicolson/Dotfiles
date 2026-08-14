import Gio from "gi://Gio"
import Gtk from "gi://Gtk?version=3.0"
import GLib from "gi://GLib"
import { createState } from "ags"

const [searchQuery, setSearchQuery] = createState("")

function getInstalledApps() {
  const apps = Gio.AppInfo.get_all()
  return apps.filter(app => app.should_show())
}

// GTK decodes themed icons lazily on first draw, which lands mid slide
// animation the first time the pane opens. Pre-decode them once, shortly
// after startup, so the first open renders from cache like every other.
let iconsWarmed = false
function warmAppIcons(apps: Gio.AppInfo[]) {
  if (iconsWarmed) return
  iconsWarmed = true
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    const theme = Gtk.IconTheme.get_default()
    for (const app of apps) {
      const gicon = app.get_icon()
      if (!gicon) continue
      try {
        theme.lookup_by_gicon(gicon, 20, 0)?.load_icon()
      } catch {}
    }
    return GLib.SOURCE_REMOVE
  })
}

function launchApp(app: Gio.AppInfo) {
  try {
    app.launch([], null)
  } catch (error) {
    console.error("Failed to launch app:", error)
  }
}

export default function AppLauncher() {
  const apps = getInstalledApps()
  warmAppIcons(apps)

  return (
    <scrollable
      hscroll="never"
      vscroll="automatic"
      vexpand={true}
    >
      <box vertical name="home-page">
        <label name="section-header" label="//APPLICATIONS" />
        <entry
          name="app-search"
          placeholder_text="⌕ SEARCH..."
          onChanged={(self) => setSearchQuery(self.get_text())}
          hexpand
        />

        <box vertical name="app-list">
          {apps
            .filter(app => {
              const query = searchQuery.get().toLowerCase()
              const name = app.get_name().toLowerCase()
              const desc = app.get_description()?.toLowerCase() || ""
              return query === "" || name.includes(query) || desc.includes(query)
            })
            .sort((a, b) => a.get_name().localeCompare(b.get_name()))
            .map(app => (
              <button
                name="app-item"
                onClicked={() => launchApp(app)}
              >
                <box spacing={8} halign="start">
                  <icon name="app-icon" gicon={app.get_icon()} />
                  <label
                    name="app-name"
                    label={app.get_name().substring(0, 22)}
                    halign="start"
                  />
                </box>
              </button>
            ))}
        </box>
      </box>
    </scrollable>
  )
}

import Gio from "gi://Gio"
import { createState } from "ags"

const [searchQuery, setSearchQuery] = createState("")

function getInstalledApps() {
  const apps = Gio.AppInfo.get_all()
  return apps.filter(app => app.should_show())
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

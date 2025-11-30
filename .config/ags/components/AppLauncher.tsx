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
    <box vertical name="page-box">
      <box vertical spacing={12}>
        <label name="title-blue" label="◢ APPLICATIONS ◣" />
        <box name="search-container">
          <entry
            name="app-search"
            placeholder_text="⌕ SEARCH..."
            onChanged={(self) => setSearchQuery(self.get_text())}
          />
        </box>
      </box>

      <scrollable
        name="app-list-scroll"
        hscroll="never"
        vscroll="automatic"
        vexpand={true}
      >
        <box vertical spacing={6}>
          {apps
            .filter(app => {
              const query = searchQuery.get().toLowerCase()
              const name = app.get_name().toLowerCase()
              const desc = app.get_description()?.toLowerCase() || ""
              return query === "" || name.includes(query) || desc.includes(query)
            })
            .map(app => (
              <button
                name="app-item"
                onClicked={() => launchApp(app)}
              >
                <box spacing={12}>
                  <box name="app-icon-container">
                    <icon name="app-icon" gicon={app.get_icon()} />
                  </box>
                  <box vertical halign="start" spacing={2}>
                    <label
                      name="app-name"
                      label={app.get_name()}
                      halign="start"
                      xalign={0}
                    />
                    {app.get_description() && (
                      <label
                        name="app-description"
                        label={app.get_description()}
                        halign="start"
                        xalign={0}
                      />
                    )}
                  </box>
                </box>
              </button>
            ))}
        </box>
      </scrollable>
    </box>
  )
}

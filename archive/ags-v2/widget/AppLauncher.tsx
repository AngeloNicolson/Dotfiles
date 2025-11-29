import { Gtk } from "ags/gtk3"
import { createState, For } from "ags"
import AstalApps from "gi://AstalApps"

const apps = new AstalApps.Apps()

function AppItem({ app, onLaunch }: { app: AstalApps.Application; onLaunch: () => void }) {
  return (
    <button class="app-item" onClicked={onLaunch}>
      <box spacing={8}>
        <icon icon={app.iconName || ""} css="font-size: 32px;" />
        <label label={app.name || ""} xalign={0} ellipsize={3} />
      </box>
    </button>
  )
}

export default function AppLauncher({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = createState("")
  const [results, setResults] = createState(apps.get_list())

  const search = (text: string) => {
    setQuery(text)
    if (!text || text.length === 0) {
      setResults(apps.get_list())
    } else {
      setResults(apps.fuzzy_query(text))
    }
  }

  const launch = (app: AstalApps.Application) => {
    app.launch()
    onClose()
  }

  return (
    <box class="app-launcher" vertical>
      <entry
        class="search-entry"
        placeholderText="Search applications..."
        text={query}
        onChanged={({ text }) => search(text || "")}
        onActivate={() => {
          const res = results.get()
          if (res && res.length > 0) launch(res[0])
        }}
      />
      <scrollable class="app-list" vexpand>
        <box vertical>
          {results((appList) =>
            (!appList || appList.length === 0) ? (
              <label label="No applications found" />
            ) : null
          )}
          <For each={results}>
            {(app) => <AppItem app={app} onLaunch={() => launch(app)} />}
          </For>
        </box>
      </scrollable>
    </box>
  )
}

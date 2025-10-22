import { sidebarShown, revealSideBar } from '../../../../shared/vars.js'

const ApplicationsService = await Service.import('applications')

const query = Variable('')
const queriedApps = Variable([])
const selectedApp = Variable()
const selectedIndex = Variable(0)
const searchMode = Variable(false)

function Header() {
  const Icon = Widget.Label({
    className: 'icon',
    label: '',
    xalign: 0
  })

  const Input = Widget.Overlay({
    className: 'input_container',
    passThrough: true,
    hexpand: true,
    child: Widget.Entry({
      className: 'input',
      onChange: ({ text }) => {
        query.value = text
        selectedIndex.value = 0
      },
      onAccept: () => {
        if (selectedApp.value) {
          selectedApp.value.launch()
          Utils.exec(`bash -c "${App.configDir}/shared/scripts/sidebar.sh close"`)
        }
      },
      setup: (self) => {
        // Hook on pane changes
        self.hook(sidebarShown, () => {
          if (sidebarShown.value === 'applauncher') {
            searchMode.value = false
            self.text = ''
            selectedIndex.value = 0
            // Always grab focus to capture all keyboard input
            Utils.timeout(50, () => self.grab_focus())
          } else {
            self.text = ''
            selectedApp.value = queriedApps.value[0]
          }
        })

        // Also hook on sidebar reveal to handle reopening
        self.hook(revealSideBar, () => {
          if (revealSideBar.value && sidebarShown.value === 'applauncher') {
            searchMode.value = false
            selectedIndex.value = 0
            // Grab focus when sidebar is revealed on applauncher pane
            Utils.timeout(50, () => self.grab_focus())
          }
        })

        // Vim-style modal editing
        self.on('key-press-event', (widget, event) => {
          const keyval = event.get_keyval()[1]

          // Escape - exit search mode
          if (keyval === 65307) { // Escape
            if (searchMode.value) {
              searchMode.value = false
              self.text = ''
              return true
            }
          }

          // If in search mode, allow normal typing
          if (searchMode.value) {
            return false
          }

          // Normal mode - block all typing except special keys
          // / - enter search mode
          if (keyval === 47) { // '/'
            searchMode.value = true
            self.text = ''
            self.grab_focus()
            return true
          }

          // j - move down
          if (keyval === 106) { // 'j'
            const apps = queriedApps.value
            if (apps.length > 0) {
              selectedIndex.value = Math.min(selectedIndex.value + 1, apps.length - 1)
              selectedApp.value = apps[selectedIndex.value]
            }
            return true
          }

          // k - move up
          if (keyval === 107) { // 'k'
            const apps = queriedApps.value
            if (apps.length > 0) {
              selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
              selectedApp.value = apps[selectedIndex.value]
            }
            return true
          }

          // Enter - handled by onAccept
          if (keyval === 65293) { // Return/Enter
            return false
          }

          // Block all other keys in normal mode
          return true
        })
      }
    }),
    overlays: [
      Widget.Label({
        className: 'placeholder',
        xalign: 0,
        setup: (self) => self.hook(query, () => {
          if (query.value) self.label = ''
          else if (searchMode.value) self.label = 'Search Apps...'
          else self.label = 'Press / to search'
        }).hook(searchMode, () => {
          if (query.value) self.label = ''
          else if (searchMode.value) self.label = 'Search Apps...'
          else self.label = 'Press / to search'
        })
      })
    ]
  })

  return Widget.Box({
    className: 'header',
    vpack: 'start',
    spacing: 16,
    children: [
      Icon,
      Input
    ]
  })
}

function Application(app, index) {
  return Widget.Button({
    className: 'app',
    child: Widget.Box({
      spacing: 8,
      children: [
        Widget.Icon({
          icon: app.iconName || '',
          size: 32
        }),
        Widget.Label(app.name)
      ]
    }),
    onClicked: () => {
      app.launch()
      Utils.exec(`bash -c "${App.configDir}/shared/scripts/sidebar.sh close"`)
    },
    setup: (self) => {
      self.hook(selectedIndex, () => {
        const isSelected = selectedIndex.value === index
        self.toggleClassName('selected', isSelected)

        // Scroll into view when selected
        if (isSelected && scrollableRef.value) {
          Utils.timeout(10, () => {
            const scrollable = scrollableRef.value
            const allocation = self.get_allocation()
            const vadj = scrollable.get_vadjustment()

            if (!vadj) return

            const itemTop = allocation.y
            const itemBottom = allocation.y + allocation.height
            const scrollTop = vadj.get_value()
            const scrollBottom = scrollTop + vadj.get_page_size()
            const offset = allocation.height * 3

            // Scroll down if within 3 items from bottom
            if (itemBottom > scrollBottom - offset) {
              vadj.set_value(itemTop - vadj.get_page_size() + allocation.height * 4)
            }
            // Scroll up if within 3 items from top
            else if (itemTop < scrollTop + offset) {
              vadj.set_value(Math.max(0, itemTop - allocation.height * 3))
            }
          })
        }
      })
    }
  })
}

const scrollableRef = Variable(null)

function AppsList() {
  return Widget.Scrollable({
    vexpand: true,
    setup: (self) => {
      scrollableRef.value = self
    },
    child: Widget.Box({
      className: 'apps',
      vertical: true,
      spacing: 8,
      setup: (self) => self.hook(query, () => {
        const apps = ApplicationsService.query(query.value)
        queriedApps.value = apps
        selectedIndex.value = 0
        selectedApp.value = apps[0]

        self.children = apps.map((app, index) => Application(app, index))
      })
    })
  })
}

export default function() {
  return Widget.Box({
    className: 'app_launcher',
    spacing: 8,
    vertical: true,
    children: [
      Header(),
      AppsList()
    ]
  })
}

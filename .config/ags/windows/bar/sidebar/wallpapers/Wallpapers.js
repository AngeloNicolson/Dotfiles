import { sidebarShown, revealSideBar } from '../../../../shared/vars.js'

const WALLPAPERS_PATH = `/home/${Utils.exec("whoami")}/.config/swww`
const selectedIndex = Variable(0)
const wallpaperList = Variable([])

function Wallpaper(wallpaper, index) {
  const scrollableRef = Variable(null)

  return Widget.Button({
    className: 'wallpaper',
    cursor: 'pointer',
    onPrimaryClick: () => {
      Utils.exec(`rm ${WALLPAPERS_PATH}/current.set`)
      Utils.exec(`ln -s ${wallpaper} ${WALLPAPERS_PATH}/current.set`)

      Utils.exec(`bash -c "${App.configDir}/shared/scripts/sidebar.sh close"`)
      Utils.exec(`bash -c "${App.configDir}/shared/scripts/sidebar.sh toggle-wallpapers"`)

      Utils.exec(`swww img ${wallpaper} --transition-type "wipe" --transition-duration 2`)
    },
    child: Widget.Overlay({
      className: 'overlay',
      child: Widget.Box(),
      overlays: [
        Widget.Icon({
          className: 'img',
          icon: wallpaper,
          size: 450
        })
      ]
    }),
    setup: (self) => {
      self.hook(selectedIndex, () => {
        const isSelected = selectedIndex.value === index
        self.toggleClassName('selected', isSelected)

        // Scroll into view when selected
        if (isSelected && self.parent?.parent?.parent) {
          Utils.timeout(10, () => {
            const scrollable = self.parent.parent.parent
            const allocation = self.get_allocation()
            const vadj = scrollable.get_vadjustment()

            if (!vadj) return

            const itemTop = allocation.y
            const itemBottom = allocation.y + allocation.height
            const scrollTop = vadj.get_value()
            const scrollBottom = scrollTop + vadj.get_page_size()

            // Scroll if item is out of view
            if (itemBottom > scrollBottom) {
              vadj.set_value(itemTop - vadj.get_page_size() + allocation.height + 20)
            } else if (itemTop < scrollTop) {
              vadj.set_value(Math.max(0, itemTop - 20))
            }
          })
        }
      })
    }
  })
}

function WallpaperList() {
  // Get wallpaper list
  const wallpapers = Utils.exec(`find -L ${WALLPAPERS_PATH} -iname '*.png' -or -iname '*.jpg'`)
    .split('\n')
    .filter(w => w.trim())

  wallpaperList.value = wallpapers

  return Widget.Scrollable({
    vexpand: true,
    child: Widget.Box({
      className: 'list',
      vertical: true,
      spacing: 12,
      children: wallpapers.map((wallpaper, index) => Wallpaper(wallpaper, index))
    })
  })
}

export default function() {
  // Hidden entry to capture keyboard input
  const keyboardEntry = Widget.Entry({
    visible: false,
    canFocus: true,
    css: 'opacity: 0; min-height: 0px; min-width: 0px; margin: 0; padding: 0; caret-color: transparent;',
    setup: (self) => {
      // Hook on pane changes
      self.hook(sidebarShown, () => {
        if (sidebarShown.value === 'wallpapers') {
          selectedIndex.value = 0
          Utils.timeout(50, () => self.grab_focus())
        }
      })

      // Also hook on sidebar reveal to handle reopening
      self.hook(revealSideBar, () => {
        if (revealSideBar.value && sidebarShown.value === 'wallpapers') {
          Utils.timeout(50, () => self.grab_focus())
        }
      })

      // Vim-style keyboard navigation
      self.on('key-press-event', (widget, event) => {
        const keyval = event.get_keyval()[1]

        // j - move down
        if (keyval === 106) { // 'j'
          if (wallpaperList.value.length > 0) {
            selectedIndex.value = Math.min(selectedIndex.value + 1, wallpaperList.value.length - 1)
          }
          return true
        }

        // k - move up
        if (keyval === 107) { // 'k'
          if (wallpaperList.value.length > 0) {
            selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
          }
          return true
        }

        // Enter - select wallpaper
        if (keyval === 65293) { // Return/Enter
          const wallpaper = wallpaperList.value[selectedIndex.value]
          if (wallpaper) {
            Utils.exec(`rm ${WALLPAPERS_PATH}/current.set`)
            Utils.exec(`ln -s ${wallpaper} ${WALLPAPERS_PATH}/current.set`)
            Utils.exec(`swww img ${wallpaper} --transition-type "wipe" --transition-duration 2`)

            // Close and reopen to refresh
            Utils.exec(`bash -c "${App.configDir}/shared/scripts/sidebar.sh close"`)
            Utils.exec(`bash -c "${App.configDir}/shared/scripts/sidebar.sh toggle-wallpapers"`)
          }
          return true
        }

        // Block other keys
        return true
      })
    }
  })

  return Widget.Box({
    className: 'wallpapers',
    vertical: true,
    children: [
      keyboardEntry,
      WallpaperList()
    ]
  })
}

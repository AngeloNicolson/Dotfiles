import { Gtk } from "ags/gtk3"
import { exec, execAsync } from "ags/process"
import { createState } from "ags"

const WALLPAPER_DIR = `${exec("echo $HOME")}/Pictures/Wallpapers`

export default function Wallpapers({ onClose }: { onClose: () => void }) {
  const [wallpapers, setWallpapers] = createState<string[]>([])
  const [loading, setLoading] = createState(true)

  // Load wallpapers
  execAsync(`find ${WALLPAPER_DIR} -type f \\( -name "*.jpg" -o -name "*.png" -o -name "*.jpeg" \\) 2>/dev/null`)
    .then((output) => {
      setWallpapers(output.split("\n").filter((p) => p.length > 0))
      setLoading(false)
    })
    .catch(() => {
      setWallpapers([])
      setLoading(false)
    })

  const setWallpaper = (path: string) => {
    execAsync(`swww img "${path}" --transition-type fade --transition-duration 1`)
      .then(() => onClose())
      .catch((err) => console.error("Failed to set wallpaper:", err))
  }

  return (
    <box class="wallpapers" vertical>
      <label class="header" label="Wallpapers" xalign={0} />
      <scrollable vexpand>
        {loading((isLoading) =>
          isLoading ? (
            <box vexpand valign={Gtk.Align.CENTER}>
              <label label="Loading wallpapers..." />
            </box>
          ) : wallpapers((walls) => (
            <box vertical>
              {walls.map((path) => (
                <button
                  key={path}
                  class="wallpaper-item"
                  onClicked={() => setWallpaper(path)}
                >
                  <box>
                    <image
                      file={path}
                      pixel_size={64}
                      css="border-radius: 4px;"
                    />
                    <label
                      label={path.split("/").pop() || ""}
                      xalign={0}
                      hexpand
                      truncate
                      maxWidthChars={30}
                    />
                  </box>
                </button>
              ))}
            </box>
          ))
        )}
      </scrollable>
    </box>
  )
}

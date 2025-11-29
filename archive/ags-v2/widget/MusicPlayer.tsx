import { Gtk } from "ags/gtk3"
import { createBinding } from "ags"
import { createPoll } from "../utils/poll"
import AstalMpris from "gi://AstalMpris"

const mpris = AstalMpris.get_default()

export default function MusicPlayer() {
  const players = createBinding(mpris, "players")

  return (
    <box class="music-player" visible={players((p) => p.length > 0)}>
      {players((playerList) => {
        if (playerList.length === 0) return <box />

        const player = playerList[0]
        const coverArt = createBinding(player, "coverArt")
        const title = createBinding(player, "title")
        const artist = createBinding(player, "artist")
        const playbackStatus = createBinding(player, "playbackStatus")
        const position = createPoll(0, 1000, () => player.get_position())
        const length = createBinding(player, "length")

        return (
          <box spacing={10}>
            <box
              class="thumbnail"
              css={coverArt((url) => `background-image: url("${url}");`)}
            />
            <box class="right" vertical>
              <box class="meta" vertical>
                <label
                  class="title"
                  label={title}
                  xalign={0}
                />
                <label
                  class="artist"
                  label={artist}
                  xalign={0}
                />
              </box>
              <box class="controls" halign={Gtk.Align.CENTER} spacing={16}>
                <button
                  class="control"
                  onClicked={() => player.previous()}
                  visible={createBinding(player, "canGoPrevious")}
                >
                  <label label="󰒮" />
                </button>
                <button
                  class="control"
                  onClicked={() => player.play_pause()}
                  visible={createBinding(player, "canControl")}
                >
                  <label label={playbackStatus((status) =>
                    status === AstalMpris.PlaybackStatus.PLAYING ? "󰏤" : "󰐊"
                  )} />
                </button>
                <button
                  class="control"
                  onClicked={() => player.next()}
                  visible={createBinding(player, "canGoNext")}
                >
                  <label label="󰒭" />
                </button>
              </box>
              <box class="position" vertical spacing={4}>
                <levelbar
                  class="progress"
                  value={position((pos) => length.get() > 0 ? pos / length.get() : 0)}
                />
                <box class="meta" spacing={8}>
                  <label
                    class="current-progress"
                    label={position((pos) => {
                      const mins = Math.floor(pos / 60)
                      const secs = Math.round(pos % 60)
                      return `${mins}:${String(secs).padStart(2, '0')}`
                    })}
                  />
                  <label
                    class="length"
                    label={length((len) => {
                      const mins = Math.floor(len / 60)
                      const secs = Math.round(len % 60)
                      return `${mins}:${String(secs).padStart(2, '0')}`
                    })}
                  />
                </box>
              </box>
            </box>
          </box>
        )
      })}
    </box>
  )
}

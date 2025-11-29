import { Gtk } from "ags/gtk3"
import { createBinding } from "ags"
import AstalWp from "gi://AstalWp"

const audio = AstalWp.get_default()

export default function AudioControls() {
  const speaker = audio?.audio.defaultSpeaker

  if (!speaker) return <box />

  const volume = createBinding(speaker, "volume")
  const muted = createBinding(speaker, "mute")
  const volumeIcon = createBinding(speaker, "volumeIcon")

  return (
    <box class="audio-controls" vertical spacing={8}>
      <button class="audio-header">
        <box>
          <icon icon={volumeIcon} />
          <label label={volume((v) => ` ${Math.round(v * 100)}%`)} />
        </box>
      </button>
      <box class="slider-box">
        <slider
          class="volume-slider"
          drawValue={false}
          hexpand
          min={0}
          max={1}
          value={volume}
          onDragged={({ value }) => speaker.set_volume(value)}
        />
      </box>
      <button
        class="mute-button"
        onClicked={() => speaker.set_mute(!speaker.get_mute())}
      >
        <label label={muted((m) => m ? "Unmute" : "Mute")} />
      </button>
    </box>
  )
}

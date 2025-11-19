import { Gtk } from "ags/gtk3"
import { createBinding } from "ags"

// AstalNotifd may not be available
let notifd: any = null
try {
  const AstalNotifd = await import("gi://AstalNotifd")
  notifd = AstalNotifd.default.get_default()
} catch (e) {
  console.warn("AstalNotifd not available - notifications disabled")
}

export default function NotificationCenter() {
  if (!notifd) {
    return (
      <box class="notification_center" vertical>
        <box class="header">
          <label class="title" label="Notifications" xalign={0} />
        </box>
        <box class="no_notification" vexpand valign={Gtk.Align.CENTER}>
          <label class="text" label="Notifications unavailable" />
        </box>
      </box>
    )
  }

  const notifications = createBinding(notifd, "notifications")

  return (
    <box class="notification_center" vertical>
      <box class="header">
        <label class="title" label="Notifications" xalign={0} hexpand />
        <button
          class="clear_notif_button"
          onClicked={() => {
            const notifs = notifd.get_notifications()
            notifs.forEach((n) => n.dismiss())
          }}
        >
          <label label="×" />
        </button>
      </box>
      <box class="notifications" vertical>
        {notifications((notifs) => {
          if (notifs.length === 0) {
            return (
              <box class="no_notification" vexpand valign={Gtk.Align.CENTER}>
                <label class="text" label="No notifications" />
              </box>
            )
          }

            return notifs.map((notif) => {
              const summary = createBinding(notif, "summary")
              const body = createBinding(notif, "body")
              const appName = createBinding(notif, "appName")
              const image = createBinding(notif, "image")

              return (
                <box class="notification" vertical spacing={4}>
                  <box spacing={8}>
                    <box
                      class="image"
                      visible={image((img) => !!img)}
                      css={image((img) => `background-image: url("${img}");`)}
                    />
                    <box class="meta" vertical hexpand>
                      <box>
                        <label
                          class="appname"
                          label={appName((n) => n)}
                          xalign={0}
                        />
                        <box hexpand />
                        <button
                          class="remove_notif_button"
                          onClicked={() => notif.dismiss()}
                        >
                          <label label="×" />
                        </button>
                      </box>
                      <label
                        class="summary"
                        label={summary((s) => s)}
                        xalign={0}
                        wrap
                      />
                      <label
                        class="body"
                        label={body((b) => b || "")}
                        xalign={0}
                        wrap
                        visible={body((b) => !!b)}
                      />
                    </box>
                  </box>
                </box>
              )
            })
        })}
      </box>
    </box>
  )
}

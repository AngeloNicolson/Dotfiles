-- Foot terminal - semi-transparent
-- Hyprland 0.56+: foot requests blur itself via ext-background-effect only when it is transparent client-side, so alpha lives in foot.ini now
-- hl.window_rule({ match = { class = "^foot$" }, opacity = "0.75 override 0.75 override" })

-- Swappy (screenshot editor) - float and center
hl.window_rule({
  match  = { class = "^swappy$" },
  float  = true,
  size   = { "monitor_w*0.8", "monitor_h*0.8" },
  center = true,
})

-- ╻ ╻┏━┓┏━┓╻┏ ┏━┓┏━┓┏━┓┏━╸┏━╸   ┏━┓╻ ╻╻  ┏━╸┏━┓
-- ┃╻┃┃ ┃┣┳┛┣┻┓┗━┓┣━┛┣━┫┃  ┣╸    ┣┳┛┃ ┃┃  ┣╸ ┗━┓
-- ┗┻┛┗━┛╹┗╸╹ ╹┗━┛╹  ╹ ╹┗━╸┗━╸   ╹┗╸┗━┛┗━╸┗━╸┗━┛

hl.workspace_rule({ workspace = "special",          gaps_in = 24, gaps_out = 64 })
hl.workspace_rule({ workspace = "special:browser",  gaps_in = 24, gaps_out = 64, monitor = "DP-2" })
hl.workspace_rule({ workspace = "special:document", gaps_in = 24, gaps_out = 64, monitor = "DP-2" })
hl.workspace_rule({ workspace = "special:media",    gaps_in = 24, gaps_out = 64 })
hl.workspace_rule({ workspace = "special:kondor",   gaps_in = 8,  gaps_out = 16 })
hl.workspace_rule({ workspace = "special:nvim",     gaps_in = 8,  gaps_out = 16 })

-- Route apps to special workspaces
hl.window_rule({ match = { class = "firefox" }, workspace = "special:browser silent" })

-- qutebrowser. Note the class is "org.qutebrowser.qutebrowser" (native Wayland),
-- NOT the bare "qutebrowser" it reported while it was still running on XWayland.
hl.window_rule({ match = { class = "^org\\.qutebrowser\\.qutebrowser$" }, workspace = "special:browser silent" })

-- Browser file-chooser (xdg-desktop-portal-gtk) is a separate toplevel, not a
-- child of Firefox, so it doesn't inherit the special:browser routing. Send it
-- to the same overlay and float it so it sits on top of Firefox — visible and
-- clickable. No pin (pinning made closing a dialog hide the overlay).
hl.window_rule({ match = { class = "^xdg-desktop-portal-gtk$" }, float = true, workspace = "special:browser silent" })
hl.window_rule({ match = { class = "org.pwmt.zathura" }, workspace = "special:document silent" })
hl.window_rule({ match = { class = "mpv" },              workspace = "special:media silent" })
hl.window_rule({ match = { class = "blender" },          workspace = "special:kondor silent", tile = true, maximize = true })
hl.window_rule({ match = { class = "^nvim-terminal$" },  workspace = "special:nvim silent",   tile = true, maximize = true })

-- ╻  ┏━┓╻ ╻┏━╸┏━┓   ┏━┓╻ ╻╻  ┏━╸┏━┓
-- ┃  ┣━┫┗┳┛┣╸ ┣┳┛   ┣┳┛┃ ┃┃  ┣╸ ┗━┓
-- ┗━╸╹ ╹ ╹ ┗━╸╹┗╸   ╹┗╸┗━┛┗━╸┗━╸┗━┛

hl.layer_rule({ match = { namespace = "logout" }, blur = true })
for _, ns in ipairs({ "bar", "notifications", "audio_controls", "system_controls", "calendar", "workspace_osd" }) do
  hl.layer_rule({ match = { namespace = ns }, no_anim = true })
end

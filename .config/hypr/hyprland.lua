-- ┏┓╻┏━┓╺┳╸┏━╸
-- ┃┗┫┃ ┃ ┃ ┣╸    Hyprland ≥ 0.55 uses Lua for its config. This file replaces
-- ╹ ╹┗━┛ ╹ ┗━╸   hyprland.conf (hyprlang), which 0.57 stops reading.
--
-- Layout mirrors the old .conf split:
--   hyprland.lua      ← this file: monitors fallback, autostart, env, input, layouts, misc
--   animations.lua    ← curves + animation tree
--   keybindings.lua   ← all binds / submaps
--   rules.lua         ← window / workspace / layer rules
--   theme.lua         ← cursor, gsettings, general/decoration look
--   lib.lua           ← small helpers shared by the files above
--   custom/*.lua      ← machine-specific, gitignored (see custom/*.lua.example)
--
-- Reference: /usr/share/hypr/stubs/hl.meta.lua (full API), https://wiki.hypr.land/Configuring/

local lib = require("lib")

-- ┏┳┓┏━┓┏┓╻╻╺┳╸┏━┓┏━┓
-- ┃┃┃┃ ┃┃┗┫┃ ┃ ┃ ┃┣┳┛
-- ╹ ╹┗━┛╹ ╹╹ ╹ ┗━┛╹┗╸

-- Universal fallback: any monitor on any machine lights up at its preferred
-- mode, auto-positioned, scale 1. Machine-specific monitor declarations (exact
-- names, resolutions, scales, positions, workspace bindings) live in the
-- gitignored custom/general.lua and custom/rules.lua — required below, so they
-- override this fallback. See custom/general.lua.example to set up a new machine.
hl.monitor({ output = "", mode = "preferred", position = "auto", scale = 1 })

-- Handle lid switch
hl.bind("switch:on:Lid Switch",  hl.dsp.exec_cmd("~/.config/hypr/scripts/lid-switch.sh close"), { locked = true })
hl.bind("switch:off:Lid Switch", hl.dsp.exec_cmd("~/.config/hypr/scripts/lid-switch.sh open"),  { locked = true })

-- ╻  ┏━┓╻ ╻┏┓╻┏━╸╻ ╻
-- ┃  ┣━┫┃ ┃┃┗┫┃  ┣━┫
-- ┗━╸╹ ╹┗━┛╹ ╹┗━╸╹ ╹

hl.on("hyprland.start", function()
  hl.exec_cmd("dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP")
  hl.exec_cmd("dbus-update-activation-environment --systemd --all")
  hl.exec_cmd("systemctl --user import-environment WAYLAND_DISPLAY XDG_CURRENT_DESKTOP")
  hl.exec_cmd("/usr/lib/polkit-kde-authentication-agent-1")

  hl.exec_cmd("ags run ~/.config/ags/app.tsx")

  hl.exec_cmd("~/.config/hypr/scripts/controls.sh")
  hl.exec_cmd("~/.config/hypr/scripts/resetxdgportal.sh")
  hl.exec_cmd("~/.config/hypr/scripts/batterynotify.sh")
  hl.exec_cmd("~/.config/hypr/scripts/wallpaperdaemon.sh")
  hl.exec_cmd("~/.config/hypr/scripts/load_default_environment.sh")
  -- Auto-detects the backlight device instead of assuming intel_backlight
  hl.exec_cmd("~/.config/hypr/scripts/init-backlight.sh 20")

  -- Idle daemon: dim at 2.5 min, panel off at 5 min (OLED care) — see hypridle.conf
  hl.exec_cmd("command -v hypridle >/dev/null && hypridle") -- optional component; no-op if not installed
end)

-- ┏━╸┏┓╻╻ ╻
-- ┣╸ ┃┗┫┃┏┛
-- ┗━╸╹ ╹┗┛

hl.env("GTK_THEME", "adw-gtk3-dark")
hl.env("XDG_CURRENT_DESKTOP", "Hyprland")
hl.env("XDG_SESSION_TYPE", "wayland")
hl.env("XDG_SESSION_DESKTOP", "Hyprland")
hl.env("QT_QPA_PLATFORM", "wayland")
hl.env("QT_WAYLAND_DISABLE_WINDOWDECORATION", "1")
hl.env("QT_QPA_PLATFORMTHEME", "qt6ct")
hl.env("QT_AUTO_SCREEN_SCALE_FACTOR", "1")
hl.env("MOZ_ENABLE_WAYLAND", "1")
hl.env("HYPRLAND_NO_SD_NOTIFY", "0")
hl.env("GI_TYPELIB_PATH", "/usr/local/lib/girepository-1.0:/usr/lib/girepository-1.0")

-- GPU-specific env (NVIDIA backend, hardware cursors, AQ_DRM_DEVICES, etc.) is
-- machine-specific and lives in the gitignored custom/env.lua — required below.
-- See custom/env.lua.example for NVIDIA / Intel / AMD templates.

-- ╻┏┓╻┏━┓╻ ╻╺┳╸
-- ┃┃┗┫┣━┛┃ ┃ ┃
-- ╹╹ ╹╹  ┗━┛ ╹

hl.config({
  input = {
    kb_layout    = "us",
    kb_options   = "caps:escape,lv3:ralt_switch",
    repeat_rate  = 50,
    repeat_delay = 300,

    follow_mouse  = 1,
    mouse_refocus = true,
    touchpad = {
      natural_scroll = true,
      scroll_factor  = 1.0,
    },

    sensitivity   = 0.5, -- -1.0 - 1.0, 0 means no modification.
    accel_profile = "flat",
  },
})

-- ╻  ┏━┓╻ ╻┏━┓╻ ╻╺┳╸┏━┓
-- ┃  ┣━┫┗┳┛┃ ┃┃ ┃ ┃ ┗━┓
-- ┗━╸╹ ╹ ╹ ┗━┛┗━┛ ╹ ┗━┛

hl.config({
  dwindle = {
    preserve_split = true,
    -- special_scale_factor = 0.9,
  },
  master = {
    new_status = "master",
  },
})

-- ┏┳┓╻┏━┓┏━╸
-- ┃┃┃┃┗━┓┃
-- ╹ ╹╹┗━┛┗━╸

hl.config({
  cursor = {
    warp_on_change_workspace = true,
  },
  misc = {
    force_default_wallpaper = 0,
    focus_on_activate       = true,
  },
  opengl = {
    nvidia_anti_flicker = true,
  },
})

-- ┏━┓┏━┓╻ ╻┏━┓┏━╸┏━╸
-- ┗━┓┃ ┃┃ ┃┣┳┛┃  ┣╸
-- ┗━┛┗━┛┗━┛╹┗╸┗━╸┗━╸

-- Each require() runs in its own scope: an error in one file does not stop the others.
require("animations")
require("keybindings")
require("rules")
require("theme")

-- Machine-local files (gitignored). Missing files are skipped silently; errors
-- inside a present file are reported by Hyprland but do not abort the rest.
lib.optional_require("custom/env")
lib.optional_require("custom/monitors")
lib.optional_require("custom/execs")
lib.optional_require("custom/general")
lib.optional_require("custom/rules")
lib.optional_require("custom/keybinds")
-- Written by the AGS theme switcher: the current theme's gaps/borders/rounding,
-- blur, shadow and window opacity, so a theme survives a login.
lib.optional_require("custom/theme")
-- Written by the AGS display arranger (SUPER+SHIFT+P); last so its monitor
-- layout and workspace pins win over general.lua / rules.lua.
lib.optional_require("custom/displays")

-- Volume keys
hl.bind("XF86AudioMute",        hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"))
hl.bind("XF86AudioLowerVolume", hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-"))
hl.bind("XF86AudioRaiseVolume", hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+"))

-- Brightness keys (keybindings.lua also binds these to brightnesscontrol.sh;
-- both fire, as they did with the .conf files)
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("brightnessctl set 5%-"))
hl.bind("XF86MonBrightnessUp",   hl.dsp.exec_cmd("brightnessctl set 5%+"))

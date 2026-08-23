-- ╺┳╸╻ ╻┏━╸┏┳┓┏━╸
--  ┃ ┣━┫┣╸ ┃┃┃┣╸
--  ╹ ╹ ╹┗━╸╹ ╹┗━╸

hl.env("XCURSOR_THEME", "Bibata-Modern-Ice")
hl.env("XCURSOR_SIZE", "20")

-- These were `exec` (= run on first load AND every reload) in theme.conf.
-- "config.reloaded" fires on the initial load too, so it is the exact equivalent.
local function apply_theme_execs()
  hl.exec_cmd("hyprctl setcursor Bibata-Modern-Ice 20")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface cursor-theme 'Bibata-Modern-Ice'")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface cursor-size 20")

  hl.exec_cmd("gsettings set org.gnome.desktop.interface icon-theme 'Tela-circle-black'")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface gtk-theme 'Gruvbox-Retro'")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'")

  -- Fonts
  hl.exec_cmd("gsettings set org.gnome.desktop.interface font-name 'CaskaydiaCove Nerd Font Mono 9'")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface document-font-name 'CaskaydiaCove Nerd Font Mono 9'")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface monospace-font-name 'CaskaydiaCove Nerd Font Mono 9'")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface font-antialiasing 'rgba'")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface font-hinting 'full'")
end
hl.on("config.reloaded", apply_theme_execs)

hl.config({
  general = {
    gaps_in     = 8,
    gaps_out    = 15,
    border_size = 1,
    col = {
      active_border   = "rgb(bdae93)",
      inactive_border = "rgb(1d2021)",
    },
    layout           = "dwindle",
    resize_on_border = true,
  },

  decoration = {
    rounding     = 4,
    dim_inactive = true,
    dim_strength = 0.15,

    blur = {
      enabled  = true,
      size     = 6,
      passes   = 3,
      noise    = 0.02,
      vibrancy = 0.15,
    },
  },
})

hl.layer_rule({ match = { namespace = "pomodoro.*" }, blur = true, ignore_alpha = 0.5 })

-- ┏━┓┏━┓┏━╸┏━╸╻┏━┓╻
-- ┗━┓┣━┛┣╸ ┃  ┃┣━┫┃
-- ┗━┛╹  ┗━╸┗━╸╹╹ ╹┗━╸

hl.config({
  decoration = {
    dim_special = 0.5,
    blur = {
      special = false,
    },
  },
})

-- ┏━╸┏━┓┏┓╻╺┳╸
-- ┣╸ ┃ ┃┃┗┫ ┃
-- ╹  ┗━┛╹ ╹ ╹
-- (font gsettings are in apply_theme_execs above)

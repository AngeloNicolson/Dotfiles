-- ╻┏ ┏━╸╻ ╻┏┓ ╻┏┓╻╺┳┓╻┏┓╻┏━╸┏━┓
-- ┣┻┓┣╸ ┗┳┛┣┻┓┃┃┗┫ ┃┃┃┃┗┫┃╺┓┗━┓
-- ╹ ╹┗━╸ ╹ ┗━┛╹╹ ╹╺┻┛╹╹ ╹┗━┛┗━┛

local lib = require("lib")

local mainMod = "SUPER" -- windows key
local dsp = hl.dsp

-- Modifier rules:
--   SUPER                — focus & navigate (workspaces, windows, desktop UI)
--   SUPER + SHIFT        — move & send (push windows to workspaces/positions)
--   SUPER + CTRL         — window properties (resize, float, pin, fullscreen, kill, layout)
--   RIGHT ALT / MOD5     — app launching & standard shortcuts (Tab, F4)

local function bind(mods, key, dispatcher, opts)
  local keys = (mods ~= "" and (mods .. " + ") or "") .. key
  return hl.bind(keys, dispatcher, opts)
end

-- ── Focus & Navigate (SUPER + HJKL / 1-5) ──────────────────────────────────

bind(mainMod, "H", dsp.focus({ direction = "l" }))
bind(mainMod, "L", dsp.focus({ direction = "r" }))
bind(mainMod, "K", dsp.focus({ direction = "u" }))
bind(mainMod, "J", dsp.focus({ direction = "d" }))

for _, ws in ipairs({ 1, 2, 3, 4, 5, 7 }) do
  bind(mainMod, tostring(ws), dsp.focus({ workspace = ws }))
end

bind(mainMod, "mouse_down", dsp.focus({ workspace = "e+1" }))
bind(mainMod, "mouse_up",   dsp.focus({ workspace = "e-1" }))

-- Special workspaces
bind(mainMod, "B", dsp.workspace.toggle_special("browser"))
bind(mainMod, "D", dsp.workspace.toggle_special("document"))
bind(mainMod, "M", dsp.workspace.toggle_special("media"))
bind(mainMod, "N", dsp.exec_cmd("~/.config/hypr/scripts/open_nvim_workspace.sh"))
bind(mainMod, "S", dsp.workspace.toggle_special())

-- ── Move & Send (SUPER + SHIFT + HJKL / 1-5) ───────────────────────────────

bind(mainMod .. " + SHIFT", "H", dsp.window.move({ direction = "l" }))
bind(mainMod .. " + SHIFT", "L", dsp.window.move({ direction = "r" }))
bind(mainMod .. " + SHIFT", "K", dsp.window.move({ direction = "u" }))
bind(mainMod .. " + SHIFT", "J", dsp.window.move({ direction = "d" }))

for _, ws in ipairs({ 1, 2, 3, 4, 5, 7 }) do
  bind(mainMod .. " + SHIFT", tostring(ws), dsp.window.move({ workspace = ws, follow = false }))
end

bind(mainMod .. " + SHIFT", "B", dsp.window.move({ workspace = "special:browser",  follow = false }))
bind(mainMod .. " + SHIFT", "D", dsp.window.move({ workspace = "special:document", follow = false }))
bind(mainMod .. " + SHIFT", "M", dsp.window.move({ workspace = "special:media",    follow = false }))
bind(mainMod .. " + SHIFT", "N", dsp.window.move({ workspace = "special:nvim",     follow = false }))
bind(mainMod .. " + SHIFT", "S", dsp.window.move({ workspace = "special",          follow = false }))

-- ── Window Properties (SUPER + CTRL) ────────────────────────────────────────

-- Resize (HJKL / arrows)
for key, delta in pairs({
  H = { -30, 0 }, L = { 30, 0 }, K = { 0, -30 }, J = { 0, 30 },
  left = { -30, 0 }, right = { 30, 0 }, up = { 0, -30 }, down = { 0, 30 },
}) do
  bind(mainMod .. " + CTRL", key, dsp.window.resize({ x = delta[1], y = delta[2], relative = true }), { repeating = true })
end

bind(mainMod .. " + CTRL", "X", dsp.window.close())
bind(mainMod .. " + CTRL", "W", function()
  lib.toggle_floating({ kitty = { 0.45, 0.50 } }, { 0.75, 0.80 })
end)
bind(mainMod .. " + CTRL", "P",      dsp.window.pin())
bind(mainMod .. " + CTRL", "Return", dsp.window.fullscreen())
bind(mainMod .. " + CTRL", "T",      dsp.layout("togglesplit")) -- dwindle

-- Mouse move/resize
bind(mainMod, "mouse:272", dsp.window.drag(),   { mouse = true })
bind(mainMod, "mouse:273", dsp.window.resize(), { mouse = true })

-- ── Desktop UI (SUPER) ──────────────────────────────────────────────────────

-- AGS
bind(mainMod,             "Q",   dsp.exec_cmd("ags request toggle-bar"))
bind(mainMod,             "Tab", dsp.exec_cmd("ags request cycle-sidebar"))
bind(mainMod .. " + SHIFT", "Tab", dsp.exec_cmd("ags request cycle-sidebar-back"))
bind(mainMod,             "G",   dsp.workspace.toggle_special("kondor"))
bind(mainMod,             "T",   dsp.exec_cmd("ags request toggle-periodic-table"))
bind(mainMod .. " + SHIFT", "P",   dsp.exec_cmd("ags request toggle-displays")) -- arrange screens / pin workspaces
bind(mainMod,             "W",   dsp.exec_cmd("ags request toggle-wallpapers"))  -- wallpaper carousel + themes
bind(mainMod,             "comma", dsp.exec_cmd("ags request toggle-settings"))  -- settings window
bind(mainMod,             "grave", dsp.exec_cmd("~/.config/hypr/scripts/wlogout.sh"))  -- power menu (wlogout, 43PR style)
bind(mainMod,             "space", dsp.exec_cmd("~/.config/hypr/scripts/launcher.sh"))  -- app launcher (rofi, 43PR style)
bind(mainMod,             "A",   dsp.exec_cmd("ags request toggle-destination"))  -- Destiny-style Destination menu
bind(mainMod .. " + SHIFT", "A",   dsp.exec_cmd("ags request toggle-galaxy"))       -- Galaxy overlay

-- Screenshot
bind(mainMod,             "I", dsp.exec_cmd("~/.config/hypr/scripts/screenshot.sh s"))  -- drag to snip / click window
bind(mainMod .. " + CTRL",  "I", dsp.exec_cmd("~/.config/hypr/scripts/screenshot.sh sf")) -- frozen screen snip
bind(mainMod .. " + SHIFT", "I", dsp.exec_cmd("~/.config/hypr/scripts/screenshot.sh m"))  -- print focused monitor
bind("",                  "print", dsp.exec_cmd("~/.config/hypr/scripts/screenshot.sh p")) -- print all monitors

-- Color picker
bind(mainMod, "P", dsp.exec_cmd("wl-color-picker"))


-- ── App Launching (RIGHT ALT / MOD5) ────────────────────────────────────────

bind("MOD5", "Return", dsp.exec_cmd("foot"))
bind("MOD5", "F",      dsp.exec_cmd("firefox"))
-- Right-Alt+B — qutebrowser on the browser overlay. rules.lua routes the window
-- to special:browser; qb-overlay starts it only if it isn't already running
-- (it's single-instance, so a bare relaunch would just add a tab) and then
-- reveals the overlay. SUPER+B remains the plain show/hide toggle.
bind("MOD5", "B",      dsp.exec_cmd("$HOME/.local/bin/qb-overlay"))
bind("MOD5", "E",      dsp.exec_cmd("nemo"))
bind("MOD5", "A",      dsp.exec_cmd("$HOME/.local/bin/armorpaint"))

-- Browser profiles — leader chord: Right-Alt+W, then w=work / p=personal / d=dev
local qb = "QT_QPA_PLATFORM=wayland QT_WAYLAND_DISABLE_WINDOWDECORATION=1 qutebrowser"
bind("MOD5", "W", dsp.submap("browser"))
hl.define_submap("browser", function()
  local function launch(key, cmd)
    hl.bind(key, function()
      hl.dispatch(dsp.exec_cmd(cmd))
      hl.dispatch(dsp.submap("reset"))
    end)
  end
  -- `--qt-flag disable-gpu` removed 2026-09-08: it was masking a QtWebEngine
  -- crash in Mesa's libgallium at the cost of CPU-only rendering. The real fix
  -- now lives in qutebrowser's config.py (QSG_RHI_BACKEND=vulkan plus
  -- --use-gl=angle --use-angle=vulkan), so the GPU can be used again.
  -- Routed through qb-overlay so each profile reveals the browser overlay and,
  -- crucially, is checked for *per profile*: pressing these with another
  -- profile already open still starts the one you asked for. Each profile keeps
  -- its own cookies, history and named sessions (<basedir>/data/sessions).
  launch("W", "$HOME/.local/bin/qb-overlay work")
  launch("P", "$HOME/.local/bin/qb-overlay personal")
  launch("D", "$HOME/.local/bin/qb-overlay dev")
  hl.bind("escape", dsp.submap("reset"))
end)

bind("MOD5", "Y",  dsp.exec_cmd("foot -e ttyper"))
bind("MOD5", "N",  dsp.exec_cmd("blender"))
bind("MOD5", "C",  dsp.window.cycle_next())
bind("MOD5", "X",  dsp.window.close())
bind("MOD5", "F4", dsp.exec_cmd("hyprctl kill"))

-- ── Hardware & System ────────────────────────────────────────────────────────

-- Blur cycle (light → default → heavy) — "transparency button"
bind("", "XF86Calculator", lib.cycle_blur)

-- Rotate external monitor (DP-1) landscape <-> portrait
bind("SUPER + SHIFT", "XF86Assistant", dsp.exec_cmd("~/.config/hypr/scripts/rotate_external.sh"))
bind("SUPER + SHIFT", "code:201",      dsp.exec_cmd("~/.config/hypr/scripts/rotate_external.sh"))

-- Brightness
bind("", "XF86MonBrightnessUp",   dsp.exec_cmd("~/.config/hypr/scripts/brightnesscontrol.sh i"), { repeating = true, locked = true })
bind("", "XF86MonBrightnessDown", dsp.exec_cmd("~/.config/hypr/scripts/brightnesscontrol.sh d"), { repeating = true, locked = true })

-- Lid switch
bind("", "switch:on:Lid Switch",  dsp.exec_cmd("~/.config/hypr/scripts/lid_handler.sh close"), { locked = true })
bind("", "switch:off:Lid Switch", dsp.exec_cmd("~/.config/hypr/scripts/lid_handler.sh open"),  { locked = true })
bind("", "XF86PowerOff", dsp.exec_cmd("systemctl suspend && ~/.config/hypr/scripts/lock.sh"))

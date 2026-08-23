-- Shared helpers for the Lua config. require("lib") from any config file.
local M = {}

-- require() a module that may not exist (machine-local custom/*.lua).
-- Returns true if it loaded. Hyprland isolates errors *inside* a found module,
-- so only "module not found" reaches us here — anything else is surfaced by
-- Hyprland's own error popup.
function M.optional_require(name)
  local ok, err = pcall(require, name)
  if not ok and not tostring(err):find("not found", 1, true) then
    print("hypr lib: " .. name .. ": " .. tostring(err))
  end
  return ok
end

-- Logical (scaled + rotated) size of a monitor object.
function M.logical_size(mon)
  local w, h = mon.width / mon.scale, mon.height / mon.scale
  if mon.transform % 2 == 1 then w, h = h, w end
  return w, h
end

-- Blur cycle: light → default → heavy → light (was scripts/blur.sh).
-- Bound to XF86Calculator in keybindings.lua.
function M.cycle_blur()
  local size = hl.get_config("decoration.blur.size") or 6
  local next
  if size <= 2 then
    next = { size = 6,  passes = 3 } -- light → default
  elseif size <= 6 then
    next = { size = 12, passes = 4 } -- default → heavy
  else
    next = { size = 2,  passes = 1 } -- heavy → light
  end
  hl.config({ decoration = { blur = next } })
end

-- Toggle floating on the active window; when floating, size it to a fraction
-- of the monitor and centre it (was scripts/togglefloating.sh).
-- sizes = { [initial_class] = { wfrac, hfrac } }, default = { wfrac, hfrac }
function M.toggle_floating(sizes, default)
  local w = hl.get_active_window()
  if not w then return end
  if w.floating then
    hl.dispatch(hl.dsp.window.float({ action = "off" }))
    return
  end
  local frac = (sizes and sizes[w.initial_class]) or default or { 0.75, 0.80 }
  local mon = w.monitor or hl.get_active_monitor()
  hl.dispatch(hl.dsp.window.float({ action = "on" }))
  if mon then
    local mw, mh = M.logical_size(mon)
    hl.dispatch(hl.dsp.window.resize({ x = math.floor(mw * frac[1]), y = math.floor(mh * frac[2]) }))
  end
  hl.dispatch(hl.dsp.window.center())
end

return M

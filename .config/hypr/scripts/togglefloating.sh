#!/bin/bash
# Toggle floating on the active window; when floating, size it to a fraction of
# the monitor and centre it. (The Lua config binds SUPER+CTRL+W to
# lib.toggle_floating directly; this script is the same thing for the .conf
# config / manual use.)
source "$(dirname "$0")/hypr-compat.sh"

floating=$(hyprctl activewindow -j | jq '.floating')
window=$(hyprctl activewindow -j | jq '.initialClass' | tr -d "\"")

function toggle() {
  width=$1
  height=$2

  if hypr_is_lua; then
    # Lua resize takes pixels: derive them from the monitor's logical size.
    hyprctl eval "
      local w = hl.get_active_window()
      local m = w and w.monitor or hl.get_active_monitor()
      hl.dispatch(hl.dsp.window.float({ action = 'on' }))
      if m then
        local mw, mh = m.width / m.scale, m.height / m.scale
        if m.transform % 2 == 1 then mw, mh = mh, mw end
        hl.dispatch(hl.dsp.window.resize({ x = math.floor(mw * ${width%\%} / 100), y = math.floor(mh * ${height%\%} / 100) }))
      end
      hl.dispatch(hl.dsp.window.center())" >/dev/null
  else
    hyprctl --batch "dispatch togglefloating; dispatch resizeactive exact ${width} ${height}; dispatch centerwindow"
  fi
}

function untoggle() {
  hypr_dispatch "togglefloating" "hl.dsp.window.float({ action = 'off' })"
}

function handle() {
  width=$1
  height=$2

  if [ $floating == "false" ]; then
    toggle $width $height
  else
    untoggle
  fi
}

case $window in
  kitty) handle "45%" "50%" ;;
  *) handle "75%" "80%" ;;
esac

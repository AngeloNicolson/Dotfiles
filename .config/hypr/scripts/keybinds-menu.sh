#!/usr/bin/env bash
# SUPER + / — searchable list of desktop keybinds (read live from keybindings.lua).
# Type to filter; Enter runs the selected bind's action (rows marked "key only"
# — workspace loops, mouse drags, Lua functions — just close the menu).
DIR="$(dirname "$(readlink -f "$0")")"
pgrep -x rofi >/dev/null && { pkill -x rofi; exit 0; }
idx=$(python3 "$DIR/keybinds.py" rofi | rofi -dmenu -i -markup-rows -format i -p "keys" \
    -theme-str 'window { width: 820px; height: 620px; } listview { lines: 14; } element-icon { size: 0px; }' \
    -mesg "type to search · Enter runs it · Esc closes · terminal keys: run  keys  in a terminal")
[ -n "$idx" ] && python3 "$DIR/keybinds.py" run "$idx"

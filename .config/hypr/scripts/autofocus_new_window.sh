#!/bin/bash
# Workaround for Hyprland not focusing new windows after switching
# to an empty workspace on another monitor.
# Focuses the window and warps cursor to its center.
source "$(dirname "$0")/hypr-compat.sh"   # hypr_dispatch: .conf + Lua sessions

socat -U - UNIX-CONNECT:"$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock" | \
    grep --line-buffered "^openwindow>>" | \
    while IFS= read -r line; do
        addr=$(echo "$line" | sed 's/^openwindow>>//' | cut -d',' -f1)
        win=$(hyprctl clients -j | jq ".[] | select(.address == \"0x${addr}\")")
        floating=$(echo "$win" | jq '.floating')
        [ "$floating" = "true" ] && continue
        hypr_dispatch "focuswindow address:0x${addr}" "hl.dsp.focus({ window = \"address:0x${addr}\" })"
        sleep 0.1
        win=$(hyprctl activewindow -j)
        x=$(echo "$win" | jq '.at[0] + (.size[0] / 2) | floor')
        y=$(echo "$win" | jq '.at[1] + (.size[1] / 2) | floor')
        [ "$x" != "null" ] && [ "$y" != "null" ] && hypr_dispatch "movecursor $x $y" "hl.dsp.cursor.move({ x = $x, y = $y })"
    done

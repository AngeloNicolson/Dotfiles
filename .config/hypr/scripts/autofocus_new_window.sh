#!/bin/bash
# Workaround for Hyprland not focusing new windows after switching
# to an empty workspace on another monitor.
# Focuses the window and warps cursor to its center.

socat -U - UNIX-CONNECT:"$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock" | \
    grep --line-buffered "^openwindow>>" | \
    while IFS= read -r line; do
        addr=$(echo "$line" | sed 's/^openwindow>>//' | cut -d',' -f1)
        hyprctl dispatch focuswindow "address:0x${addr}"
        sleep 0.1
        win=$(hyprctl activewindow -j)
        x=$(echo "$win" | jq '.at[0] + (.size[0] / 2) | floor')
        y=$(echo "$win" | jq '.at[1] + (.size[1] / 2) | floor')
        [ "$x" != "null" ] && [ "$y" != "null" ] && hyprctl dispatch movecursor "$x" "$y"
    done

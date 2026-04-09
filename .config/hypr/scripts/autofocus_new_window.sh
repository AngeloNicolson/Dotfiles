#!/bin/bash
# Workaround for Hyprland not focusing new windows after switching
# to an empty workspace on another monitor.
# Listens for openwindow events and focuses them.

socat -U - UNIX-CONNECT:"$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock" | \
    grep --line-buffered "^openwindow>>" | \
    while IFS='>>' read -r _ _ data; do
        addr=$(echo "$data" | cut -d',' -f1)
        hyprctl dispatch focuswindow "address:0x${addr}"
    done

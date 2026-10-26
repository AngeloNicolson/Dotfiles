#!/bin/bash
# Unified event listener for tablet management
# Handles both monitor focus changes and monitor hotplug events efficiently
# Single socat process instead of multiple listeners

# Listen to Hyprland events and route to appropriate handler
socat -u UNIX-CONNECT:$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock - | \
grep --line-buffered -E "^(focusedmon|monitoradded|monitorremoved)>>" | \
while read -r event; do
    case "$event" in
        focusedmon*)
            # Monitor focus changed - remap tablet to new focused monitor
            ~/.config/hypr/scripts/tablet_map_focused.sh
            ;;
        monitoradded*|monitorremoved*)
            # Monitor plugged/unplugged - update config then remap
            echo "Monitor change detected: $event"
            sleep 0.5  # Let system settle
            ~/.config/hypr/scripts/tablet_detect_screens.sh
            sleep 0.5
            ~/.config/hypr/scripts/tablet_map_focused.sh
            ;;
    esac
done

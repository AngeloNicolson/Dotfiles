#!/usr/bin/env bash
# Lid switch handler for Hyprland (monitor names/resolutions auto-detected).
# When lid closes:
#   - If an external is connected: disable laptop screen, make external primary
#   - If no external: lock + suspend the system
# When lid opens:
#   - Enable laptop screen at 0x0, push external to the right
# Optional host overrides (custom/env.conf): LAPTOP_SCALE, LAPTOP_MODE
source "$(dirname "$0")/monitor-helpers.sh"

LAPTOP="$(mon_laptop)"
[ -z "$LAPTOP" ] && exit 0   # desktop, no lid

LAPTOP_SCALE="${LAPTOP_SCALE:-auto}"
LAPTOP_MODE="${LAPTOP_MODE:-preferred}"
EXTERNAL="$(mon_first_external)"

case "$1" in
    close)
        if [ -n "$EXTERNAL" ]; then
            hyprctl keyword monitor "$LAPTOP,disable"
            hyprctl keyword monitor "$EXTERNAL,preferred,0x0,1"
        else
            ~/.config/hypr/scripts/lock.sh &
            sleep 0.5
            systemctl suspend
        fi
        ;;
    open)
        hyprctl keyword monitor "$LAPTOP,$LAPTOP_MODE,0x0,$LAPTOP_SCALE"
        if [ -n "$EXTERNAL" ]; then
            x="$(mon_logical_width "$LAPTOP")"
            hyprctl keyword monitor "$EXTERNAL,preferred,${x}x0,1"
        fi
        ;;
esac

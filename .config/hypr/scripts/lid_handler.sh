#!/bin/bash
# Lid switch handler for Hyprland
# When lid closes:
#   - If HDMI connected: disable laptop screen, move HDMI to 0x0
#   - If no HDMI: suspend the system
# When lid opens:
#   - Enable laptop screen at 0x0, move HDMI to the right

LAPTOP_MONITOR="eDP-1"
EXTERNAL_MONITOR="HDMI-A-1"

has_external_monitor() {
    hyprctl monitors -j 2>/dev/null | grep -q "$EXTERNAL_MONITOR"
}

case "$1" in
    close)
        if has_external_monitor; then
            # External monitor connected - disable laptop, HDMI becomes primary at 0x0
            hyprctl keyword monitor "$LAPTOP_MONITOR,disable"
            hyprctl keyword monitor "$EXTERNAL_MONITOR,1920x1080@60,0x0,1"
        else
            # No external monitor - suspend and lock
            hyprlock &
            sleep 0.5
            systemctl suspend
        fi
        ;;
    open)
        # Lid opened - laptop at 0x0, HDMI to the right (2048 = 2560/1.25)
        hyprctl keyword monitor "$LAPTOP_MONITOR,2560x1600@240,0x0,1.25"
        if has_external_monitor; then
            hyprctl keyword monitor "$EXTERNAL_MONITOR,1920x1080@60,2048x0,1"
        fi
        ;;
esac

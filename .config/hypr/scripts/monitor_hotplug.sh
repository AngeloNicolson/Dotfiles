#!/bin/bash
# Monitor hotplug handler for Hyprland
# Disables laptop screen when HDMI is connected, enables it when disconnected

LAPTOP_MONITOR="eDP-1"
EXTERNAL_MONITOR="HDMI-A-1"

handle_monitors() {
    # Get list of connected monitors
    monitors=$(hyprctl monitors -j 2>/dev/null)

    if [ -z "$monitors" ]; then
        return
    fi

    # Check if external monitor is connected
    if echo "$monitors" | grep -q "$EXTERNAL_MONITOR"; then
        # HDMI connected - disable laptop screen
        hyprctl keyword monitor "$LAPTOP_MONITOR,disable"
    else
        # HDMI disconnected - enable laptop screen
        hyprctl keyword monitor "$LAPTOP_MONITOR,2560x1600@240,0x0,1.25"
    fi
}

# Run once on script start
handle_monitors

# Listen for monitor events using socat
socat -U - UNIX-CONNECT:"$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock" 2>/dev/null | while read -r line; do
    case "$line" in
        monitoradded*|monitorremoved*)
            # Small delay to let Hyprland stabilize
            sleep 0.5
            handle_monitors
            ;;
    esac
done

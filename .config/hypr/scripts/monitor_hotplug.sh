#!/bin/bash
# Monitor hotplug handler for Hyprland
# Disables the laptop panel when any external monitor is connected, re-enables it
# when the last external is unplugged. Monitor names are auto-detected so this
# works on any machine (no hardcoded eDP-1/HDMI-A-1).

source "$(dirname "$0")/monitor-helpers.sh"

handle_monitors() {
    local laptop; laptop="$(mon_laptop)"
    [ -z "$laptop" ] && return  # desktop with no built-in panel — nothing to toggle

    if [ -n "$(mon_first_external)" ]; then
        # External monitor present — disable laptop panel
        hyprctl keyword monitor "$laptop,disable"
    else
        # No external monitor — enable laptop panel at its preferred mode
        hyprctl keyword monitor "$laptop,preferred,auto,auto"
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

#!/bin/bash
# Daemon that monitors lid state and handles it based on external monitor presence

EXTERNAL_MONITOR="HDMI-A-1"
LID_STATE_FILE="/proc/acpi/button/lid/LID0/state"

# Fallback lid state file path
if [ ! -f "$LID_STATE_FILE" ]; then
    LID_STATE_FILE="/proc/acpi/button/lid/LID/state"
fi

has_external_monitor() {
    hyprctl monitors -j 2>/dev/null | grep -q "$EXTERNAL_MONITOR"
}

get_lid_state() {
    if [ -f "$LID_STATE_FILE" ]; then
        cat "$LID_STATE_FILE" | awk '{print $2}'
    else
        echo "open"
    fi
}

LAST_LID_STATE=$(get_lid_state)

# Use acpi_listen to monitor lid events
acpi_listen 2>/dev/null | while read -r event; do
    case "$event" in
        *LID*close*)
            if has_external_monitor; then
                # External monitor present - don't suspend, just ensure laptop screen is off
                hyprctl keyword monitor "eDP-1,disable"
            else
                # No external monitor - suspend
                systemctl suspend
            fi
            ;;
        *LID*open*)
            if ! has_external_monitor; then
                # No external monitor - enable laptop screen
                hyprctl keyword monitor "eDP-1,2560x1600@240,0x0,1.25"
            fi
            ;;
    esac
done

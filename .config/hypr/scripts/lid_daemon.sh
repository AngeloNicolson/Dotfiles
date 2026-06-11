#!/bin/bash
# Daemon that monitors lid state and handles it based on external monitor presence.
# Monitor names are auto-detected so this works on any machine (no hardcoded names).

source "$(dirname "$0")/monitor-helpers.sh"

LID_STATE_FILE="/proc/acpi/button/lid/LID0/state"

# Fallback lid state file path
if [ ! -f "$LID_STATE_FILE" ]; then
    LID_STATE_FILE="/proc/acpi/button/lid/LID/state"
fi

has_external_monitor() {
    [ -n "$(mon_first_external)" ]
}

get_lid_state() {
    if [ -f "$LID_STATE_FILE" ]; then
        awk '{print $2}' "$LID_STATE_FILE"
    else
        echo "open"
    fi
}

LAST_LID_STATE=$(get_lid_state)

# Use acpi_listen to monitor lid events
acpi_listen 2>/dev/null | while read -r event; do
    laptop="$(mon_laptop)"
    [ -z "$laptop" ] && continue  # no built-in panel — nothing to do
    case "$event" in
        *LID*close*)
            if has_external_monitor; then
                # External monitor present - don't suspend, just turn the panel off
                hyprctl keyword monitor "$laptop,disable"
            else
                # No external monitor - suspend
                systemctl suspend
            fi
            ;;
        *LID*open*)
            if ! has_external_monitor; then
                # No external monitor - re-enable the panel at its preferred mode
                hyprctl keyword monitor "$laptop,preferred,auto,auto"
            fi
            ;;
    esac
done

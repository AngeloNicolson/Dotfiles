#!/usr/bin/env bash
# Lid open/close handler. Monitor names and resolutions are auto-detected, so this
# works on any laptop. Optional host overrides (set in custom/env.conf):
#   LAPTOP_SCALE  laptop panel scale on re-enable (default: auto = DPI-based)
#   LAPTOP_MODE   laptop panel mode on re-enable  (default: preferred)
source "$(dirname "$0")/monitor-helpers.sh"

LAPTOP="$(mon_laptop)"
[ -z "$LAPTOP" ] && exit 0   # no internal panel (desktop) — nothing to do

LAPTOP_SCALE="${LAPTOP_SCALE:-auto}"
LAPTOP_MODE="${LAPTOP_MODE:-preferred}"
EXTERNAL="$(mon_first_external)"
STATE_FILE="${XDG_RUNTIME_DIR:-/tmp}/hypr-lid-moved-workspaces"

if [ "$1" = "open" ]; then
    # Re-enable the laptop panel at 0x0; push the external to its right.
    hyprctl keyword monitor "$LAPTOP,$LAPTOP_MODE,0x0,$LAPTOP_SCALE"
    hyprctl dispatch dpms on "$LAPTOP"
    if [ -n "$EXTERNAL" ]; then
        x="$(mon_logical_width "$LAPTOP")"
        hyprctl keyword monitor "$EXTERNAL,preferred,${x}x0,1"
    fi
    # Move back exactly the workspaces we relocated when the lid closed.
    if [ -f "$STATE_FILE" ]; then
        while read -r ws; do
            [ -n "$ws" ] && hyprctl dispatch moveworkspacetomonitor "$ws $LAPTOP"
        done < "$STATE_FILE"
        rm -f "$STATE_FILE"
    fi
else
    if [ -n "$EXTERNAL" ]; then
        # External present: move the laptop's workspaces onto it (recording them
        # so 'open' can restore them), then disable the panel.
        : > "$STATE_FILE"
        hyprctl workspaces -j | jq -r --arg m "$LAPTOP" \
            '.[] | select(.monitor == $m) | .id' | while read -r ws; do
            echo "$ws" >> "$STATE_FILE"
            hyprctl dispatch moveworkspacetomonitor "$ws $EXTERNAL"
        done
        hyprctl keyword monitor "$LAPTOP,disable"
        hyprctl keyword monitor "$EXTERNAL,preferred,0x0,1"
    else
        # No external — just blank the panel.
        hyprctl dispatch dpms off "$LAPTOP"
    fi
fi

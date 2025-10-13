#!/usr/bin/env bash
# Load default workspace configuration on startup
# This script is called by hyprland.conf exec-once

MARKER_FILE="$HOME/.config/hypr/layouts/default_workspace_config.txt"

# Check if default config is set
if [ ! -f "$MARKER_FILE" ]; then
    exit 0
fi

CONFIG_FILE=$(cat "$MARKER_FILE")

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Default workspace config not found: $CONFIG_FILE"
    exit 1
fi

# Small delay to let Hyprland fully initialize
sleep 2

# Parse JSON and move workspaces
jq -r '.workspaces[]? | "\(.id) \(.monitor)"' "$CONFIG_FILE" 2>/dev/null | while read -r ws_id monitor; do
    if [ -n "$ws_id" ] && [ -n "$monitor" ]; then
        hyprctl dispatch moveworkspacetomonitor "$ws_id" "$monitor" 2>/dev/null
        sleep 0.05
    fi
done

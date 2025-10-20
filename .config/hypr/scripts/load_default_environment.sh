#!/usr/bin/env bash
# Load default environment configuration on startup
# This script is called by hyprland.conf exec-once

MARKER_FILE="$HOME/.config/hypr/layouts/default_environment.txt"

# Check if default config is set
if [ ! -f "$MARKER_FILE" ]; then
    exit 0
fi

CONFIG_FILE=$(cat "$MARKER_FILE")

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Default environment not found: $CONFIG_FILE"
    exit 1
fi

# Small delay to let Hyprland fully initialize
sleep 2

# Get environment name from config file
get_environment_name() {
    local config_file="$1"
    jq -r '.name // empty' "$config_file" 2>/dev/null
}

# Bind workspaces to monitors using workspace rules (hot-applied)
jq -r '.workspaces[]? | "\(.id) \(.monitor)"' "$CONFIG_FILE" 2>/dev/null | while read -r ws_id monitor; do
    if [ -n "$ws_id" ] && [ -n "$monitor" ]; then
        # Set workspace rule to bind workspace to monitor
        hyprctl keyword workspace "$ws_id,monitor:$monitor" 2>/dev/null
    fi
done

# Small delay to ensure workspace rules are applied
sleep 0.3

# Get environment name from config
ENVIRONMENT_NAME=$(get_environment_name "$CONFIG_FILE")

# Launch environment layouts from workspace definitions using apply_layout.py
jq -r '.workspaces[]? | select(.layout != null) | "\(.id) \(.layout)"' "$CONFIG_FILE" 2>/dev/null | while read -r ws_id layout_file; do
    if [ -n "$ws_id" ] && [ -n "$layout_file" ] && [ -f "$layout_file" ]; then
        echo "Launching layout for workspace $ws_id: $layout_file"

        # Use apply_layout.py with environment name for proper window rules and tagging
        if [ -n "$ENVIRONMENT_NAME" ]; then
            "$HOME/.config/hypr/scripts/apply_layout.py" "$layout_file" "$ws_id" --environment "$ENVIRONMENT_NAME" 2>/dev/null
        else
            "$HOME/.config/hypr/scripts/apply_layout.py" "$layout_file" "$ws_id" 2>/dev/null
        fi

        # Brief delay between workspace launches
        sleep 0.5
    fi
done

# Return to workspace 1
hyprctl dispatch workspace 1 2>/dev/null

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

# Function to recursively launch windows from a layout
launch_layout() {
    local json="$1"
    local workspace="$2"
    local type=$(echo "$json" | jq -r '.type')

    if [ "$type" = "window" ]; then
        local app=$(echo "$json" | jq -r '.app')
        local working_dir=$(echo "$json" | jq -r '.working_dir // empty')

        if [ -n "$working_dir" ]; then
            # Expand tilde in working_dir
            working_dir="${working_dir/#\~/$HOME}"

            if [ "$app" = "foot" ]; then
                foot -D "$working_dir" &
            else
                (cd "$working_dir" && $app &)
            fi
        else
            $app &
        fi

        # Wait for window to open and move it to the correct workspace
        sleep 0.5
        if [ -n "$workspace" ]; then
            hyprctl dispatch movetoworkspacesilent "$workspace" 2>/dev/null
        fi
    elif [ "$type" = "container" ]; then
        local children=$(echo "$json" | jq -c '.children[]?')
        while IFS= read -r child; do
            launch_layout "$child" "$workspace"
        done <<< "$children"
    fi
}

# Parse JSON and create workspaces on monitors
jq -r '.workspaces[]? | "\(.id) \(.monitor)"' "$CONFIG_FILE" 2>/dev/null | while read -r ws_id monitor; do
    if [ -n "$ws_id" ] && [ -n "$monitor" ]; then
        # Create workspace by switching to it
        hyprctl dispatch workspace "$ws_id" 2>/dev/null
        sleep 0.1

        # Move workspace to the designated monitor
        hyprctl dispatch moveworkspacetomonitor "$ws_id" "$monitor" 2>/dev/null
        sleep 0.05
    fi
done

# Launch environment layouts from workspace definitions
jq -r '.workspaces[]? | select(.layout != null) | "\(.id) \(.layout)"' "$CONFIG_FILE" 2>/dev/null | while read -r ws_id layout_file; do
    if [ -n "$ws_id" ] && [ -n "$layout_file" ] && [ -f "$layout_file" ]; then
        echo "Launching layout for workspace $ws_id: $layout_file"

        # Switch to workspace
        hyprctl dispatch workspace "$ws_id" 2>/dev/null
        sleep 0.3

        # Read environment layout and launch
        environment_layout=$(cat "$layout_file")
        launch_layout "$environment_layout" "$ws_id"
    fi
done

# Return to workspace 1
hyprctl dispatch workspace 1 2>/dev/null

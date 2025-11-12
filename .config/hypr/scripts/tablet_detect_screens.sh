#!/bin/bash
# Detects connected screens and updates OpenTabletDriver settings.json
# Runs at startup before OpenTabletDriver daemon starts
# Ensures correct default configuration for single-screen (traveling) vs multi-screen (home) setups

CONFIG_FILE="$HOME/.config/OpenTabletDriver/settings.json"

# Wait for displays to be ready
sleep 1

# Get focused monitor (or first monitor if none focused yet)
MONITOR_INFO=$(hyprctl monitors -j | jq '.[] | select(.focused == true) // .[0]')

if [ -z "$MONITOR_INFO" ]; then
    echo "No monitor detected, using default settings"
    exit 1
fi

# Extract monitor dimensions
WIDTH=$(echo "$MONITOR_INFO" | jq -r '.width')
HEIGHT=$(echo "$MONITOR_INFO" | jq -r '.height')
X=$(echo "$MONITOR_INFO" | jq -r '.x')
Y=$(echo "$MONITOR_INFO" | jq -r '.y')

# Calculate center coordinates
CENTER_X=$((X + WIDTH / 2))
CENTER_Y=$((Y + HEIGHT / 2))

echo "Detected screen: ${WIDTH}x${HEIGHT} at ${X},${Y}"
echo "Setting tablet default to map to this screen (center: $CENTER_X,$CENTER_Y)"

# Update settings.json with detected screen dimensions
jq --argjson width "$WIDTH" \
   --argjson height "$HEIGHT" \
   --argjson x "$CENTER_X" \
   --argjson y "$CENTER_Y" \
   '.Profiles[0].AbsoluteModeSettings.Display.Width = $width |
    .Profiles[0].AbsoluteModeSettings.Display.Height = $height |
    .Profiles[0].AbsoluteModeSettings.Display.X = $x |
    .Profiles[0].AbsoluteModeSettings.Display.Y = $y' \
   "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "OpenTabletDriver settings.json updated successfully"

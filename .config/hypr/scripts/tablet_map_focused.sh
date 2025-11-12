#!/bin/bash
# Automatically maps Wacom tablet to the currently focused monitor in Hyprland
# Triggered by focusedmon events via socat listener in hypr/custom/execs.conf
#
# Features:
# - Auto-detects focused monitor and maps tablet to it
# - Matches tablet area aspect ratio to screen aspect ratio
# - Prevents edge detection issues with 2% margin
# - Only remaps when monitor actually changes (state tracking)
# - Enables clipping to prevent cursor bleed between screens

# State file to track last mapped monitor (prevents unnecessary remapping)
STATE_FILE="/tmp/tablet_last_monitor"

# Get currently focused monitor info from Hyprland
MONITOR_INFO=$(hyprctl monitors -j | jq '.[] | select(.focused == true)')

if [ -z "$MONITOR_INFO" ]; then
    exit 1
fi

# Extract monitor name and dimensions
MONITOR_NAME=$(echo "$MONITOR_INFO" | jq -r '.name')
WIDTH=$(echo "$MONITOR_INFO" | jq -r '.width')
HEIGHT=$(echo "$MONITOR_INFO" | jq -r '.height')
X=$(echo "$MONITOR_INFO" | jq -r '.x')
Y=$(echo "$MONITOR_INFO" | jq -r '.y')

# Check if monitor changed since last run
if [ -f "$STATE_FILE" ]; then
    LAST_MONITOR=$(cat "$STATE_FILE")
    if [ "$LAST_MONITOR" == "$MONITOR_NAME" ]; then
        # Same monitor, no need to remap
        exit 0
    fi
fi

# Save current monitor to state file
echo "$MONITOR_NAME" > "$STATE_FILE"

# Calculate center coordinates (OpenTabletDriver uses center, not corner)
CENTER_X=$((X + WIDTH / 2))
CENTER_Y=$((Y + HEIGHT / 2))

# Get tablet name from OpenTabletDriver config
TABLET=$(jq -r '.Profiles[0].Tablet' "$HOME/.config/OpenTabletDriver/settings.json")

# Wacom PTH-660 (Intuos Pro Medium) active drawing area: 8.7" x 5.8"
MAX_TABLET_WIDTH=220.9
MAX_TABLET_HEIGHT=147.3

# Add 2% margin to avoid edge detection issues when pen enters/exits range
MARGIN=0.98

# Calculate tablet area to match screen aspect ratio
SCREEN_ASPECT=$(echo "scale=4; $WIDTH / $HEIGHT" | bc)

# Start with full tablet width and calculate height based on screen aspect ratio
TABLET_WIDTH=$(echo "scale=2; $MAX_TABLET_WIDTH * $MARGIN" | bc)
TABLET_HEIGHT=$(echo "scale=2; $TABLET_WIDTH / $SCREEN_ASPECT" | bc)

# If calculated height exceeds max, use max height and recalculate width
if (( $(echo "$TABLET_HEIGHT > ($MAX_TABLET_HEIGHT * $MARGIN)" | bc -l) )); then
    TABLET_HEIGHT=$(echo "scale=2; $MAX_TABLET_HEIGHT * $MARGIN" | bc)
    TABLET_WIDTH=$(echo "scale=2; $TABLET_HEIGHT * $SCREEN_ASPECT" | bc)
fi

# Center the tablet area on the physical tablet surface
TABLET_X=$(echo "scale=2; $MAX_TABLET_WIDTH / 2" | bc)
TABLET_Y=$(echo "scale=2; $MAX_TABLET_HEIGHT / 2" | bc)

# Apply all settings to running OpenTabletDriver daemon
otd settabletarea "$TABLET" "$TABLET_WIDTH" "$TABLET_HEIGHT" "$TABLET_X" "$TABLET_Y" 0
otd setdisplayarea "$TABLET" "$WIDTH" "$HEIGHT" "$CENTER_X" "$CENTER_Y"
otd setenableclipping "$TABLET" true       # Prevent cursor from bleeding to adjacent screens
otd setenablearealimiting "$TABLET" true   # Ignore inputs outside defined tablet area

#!/usr/bin/env bash
# Shared monitor-detection helpers, sourced by the monitor/lid scripts so none of
# them hardcode connector names (eDP-1, HDMI-A-1, …) or resolutions. Everything is
# derived at runtime from `hyprctl monitors`, so the same scripts work on any
# machine. Requires: hyprctl, jq.
#
# Note: `hyprctl monitors -j` lists ACTIVE (enabled) monitors; `monitors all -j`
# also includes disabled ones (e.g. the laptop panel while the lid is shut).

# Name of the built-in laptop panel (eDP*/LVDS*/DSI*), or empty on a desktop.
# Uses `all` so it resolves even when the panel is currently disabled.
mon_laptop() {
    hyprctl monitors all -j 2>/dev/null \
        | jq -r '.[].name' \
        | grep -iE '^(eDP|LVDS|DSI)' | head -n1
}

# Names of all active non-laptop (external) monitors, one per line.
mon_externals() {
    local laptop; laptop="$(mon_laptop)"
    hyprctl monitors -j 2>/dev/null \
        | jq -r '.[].name' \
        | grep -vxF "$laptop"
}

# First currently-active external monitor, or empty.
mon_first_external() {
    mon_externals | head -n1
}

# True if the named monitor is currently active.
mon_connected() {
    [ -n "$1" ] && hyprctl monitors -j 2>/dev/null | jq -e --arg n "$1" \
        'any(.[]; .name == $n)' >/dev/null 2>&1
}

# Logical width (pixels ÷ scale) of an active monitor, used to position the next
# one to its right. Falls back to 1920 if the monitor isn't found/active.
mon_logical_width() {
    local w
    w="$(hyprctl monitors -j 2>/dev/null | jq -r --arg n "$1" \
        '.[] | select(.name == $n) | (.width / .scale) | floor' | head -n1)"
    echo "${w:-1920}"
}

# Current transform (rotation) of an active monitor, or 0.
mon_transform() {
    local t
    t="$(hyprctl monitors -j 2>/dev/null | jq -r --arg n "$1" \
        '.[] | select(.name == $n) | .transform' | head -n1)"
    echo "${t:-0}"
}

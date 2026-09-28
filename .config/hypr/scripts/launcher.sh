#!/usr/bin/env bash
# App launcher (Rofi, 43PR style): SUPER+Space toggles it.
if ! command -v rofi >/dev/null 2>&1; then
    notify-send -a "Launcher" -u critical "rofi isn't installed" "Install it with: sudo pacman -S rofi" 2>/dev/null
    exit 1
fi
if pgrep -x rofi >/dev/null; then
    pkill -x rofi
else
    exec rofi -show drun
fi

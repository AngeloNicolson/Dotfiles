#!/usr/bin/env bash
# App launcher: SUPER+Space (and the Destination menu's LAUNCHER) toggle it.
# Rofi (43PR style, ~/.config/rofi) when installed; wofi until then.
if command -v rofi >/dev/null 2>&1; then
    if pgrep -x rofi >/dev/null; then pkill -x rofi; else exec rofi -show drun; fi
elif command -v wofi >/dev/null 2>&1; then
    if pgrep -x wofi >/dev/null; then pkill -x wofi; else exec wofi --show drun; fi
else
    notify-send -a "Launcher" -u critical "No launcher installed" "Install rofi: sudo pacman -S rofi" 2>/dev/null
    exit 1
fi

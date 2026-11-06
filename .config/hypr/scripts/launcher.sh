#!/usr/bin/env bash
# App launcher: SUPER+Space (and the Destination menu's LAUNCHER) toggle it.
# Rofi (43PR style, ~/.config/rofi) when installed; wofi until then.
#
# Only *this* menu toggles off. Another rofi menu (the SUPER+/ cheat sheet)
# is closed and replaced, so SUPER+Space from the cheat sheet opens the
# launcher instead of just dismissing the sheet.
if command -v rofi >/dev/null 2>&1; then
    if pgrep -f '^rofi -show drun' >/dev/null; then pkill -f '^rofi -show drun'; exit 0; fi
    if pgrep -x rofi >/dev/null; then
        pkill -x rofi
        for _ in $(seq 20); do pgrep -x rofi >/dev/null || break; sleep 0.05; done
    fi
    exec rofi -show drun
elif command -v wofi >/dev/null 2>&1; then
    if pgrep -x wofi >/dev/null; then pkill -x wofi; else exec wofi --show drun; fi
else
    notify-send -a "Launcher" -u critical "No launcher installed" "Install rofi: sudo pacman -S rofi" 2>/dev/null
    exit 1
fi

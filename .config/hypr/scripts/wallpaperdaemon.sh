#!/bin/bash
# Start the awww wallpaper daemon and restore the last wallpaper.
#
# On a fresh machine nothing is cached yet, so `awww restore` leaves the desktop
# black — fall back to the first image in the repo's wallpaper dir instead.
WALLS="${XDG_CONFIG_HOME:-$HOME/.config}/ags/wallpapers"

if ! awww query &>/dev/null; then
    awww-daemon --format xrgb &
    sleep 0.5
fi

awww restore 2>/dev/null || true

# Nothing on screen? Pick a default.
if ! awww query 2>/dev/null | grep -q 'image: '; then
    first="$(find -L "$WALLS" -maxdepth 1 -type f \
        \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) 2>/dev/null \
        | sort | head -n1)"
    if [ -n "$first" ]; then
        awww img "$first" --transition-type none
    fi
fi

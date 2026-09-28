#!/usr/bin/env bash
# Right-Alt + V: yt-x (YouTube in the terminal) in a foot window.
if ! command -v yt-x >/dev/null 2>&1; then
    notify-send -a "yt-x" -u critical "yt-x isn't installed" "Install it with: yay -S yt-x" 2>/dev/null
    exit 1
fi
exec foot --title "yt-x" -e yt-x

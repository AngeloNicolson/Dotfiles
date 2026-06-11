#!/usr/bin/env bash
# Set initial screen brightness without assuming a specific backlight device.
# Usage: init-backlight.sh [percent]   (default 20)
#
# Device selection order:
#   1. $BACKLIGHT_DEVICE if set (host-specific override, e.g. in custom/env.conf)
#   2. otherwise the first device of class "backlight"
# brightnessctl's own default can land on a keyboard LED, and on hybrid-GPU
# laptops several backlight devices exist (e.g. nvidia_0 + intel_backlight) where
# only one drives the visible panel — hence the explicit override hook.

percent="${1:-20}"
device="${BACKLIGHT_DEVICE:-}"

if [ -z "$device" ]; then
    device="$(brightnessctl --class=backlight --list --machine-readable 2>/dev/null | head -n1 | cut -d, -f1)"
fi

if [ -n "$device" ]; then
    brightnessctl -d "$device" set "${percent}%"
else
    # No backlight device (e.g. desktop with an external monitor) — nothing to do.
    exit 0
fi

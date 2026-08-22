#!/usr/bin/env bash
# hypridle dim helper: `dim` saves the current level and drops to 5%,
# `restore` brings the saved level back.
#
# Device selection matches init-backlight.sh:
#   1. $BACKLIGHT_DEVICE if set (host override in custom/env.conf)
#   2. otherwise the first device of class "backlight"
# (brightnessctl's bare default can land on a phantom device like nvidia_0 on
# hybrid-GPU laptops, so never call it without -d.)

action="${1:-dim}"
device="${BACKLIGHT_DEVICE:-}"

if [ -z "$device" ]; then
    device="$(brightnessctl --class=backlight --list --machine-readable 2>/dev/null | head -n1 | cut -d, -f1)"
fi
[ -z "$device" ] && exit 0

case "$action" in
    dim)     brightnessctl -s -d "$device" set 5% ;;
    restore) brightnessctl -r -d "$device" ;;
esac

#!/usr/bin/env bash
# Toggle the external monitor between landscape (transform 0) and portrait
# (transform 3). Monitor name, mode and position are auto-detected, so this works
# on any machine. Bound to the Copilot/Assistant key.
source "$(dirname "$0")/monitor-helpers.sh"

MON="$(mon_first_external)"
[ -z "$MON" ] && exit 0   # no external monitor connected

# Preserve the monitor's current position; only flip the transform.
read -r x y <<<"$(hyprctl monitors -j | jq -r --arg n "$MON" \
    '.[] | select(.name == $n) | "\(.x) \(.y)"')"
x="${x:-0}"; y="${y:-0}"

if [ "$(mon_transform "$MON")" = "0" ]; then
    t=3   # landscape -> portrait
else
    t=0   # portrait  -> landscape
fi

hyprctl keyword monitor "$MON,preferred,${x}x${y},1,transform,$t"

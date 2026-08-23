#!/bin/bash
# Cycle blur: light → default → heavy → light
# (The Lua config binds XF86Calculator to lib.cycle_blur directly; this script
# is the same thing for manual use / the .conf config.)
source "$(dirname "$0")/hypr-compat.sh"

if hypr_is_lua; then
    current=$(hyprctl repl 'hl.get_config("decoration.blur.size")' 2>/dev/null | tr -dc '0-9')
else
    current=$(hyprctl getoption decoration:blur:size -j | jq '.int')
fi
current=${current:-6}

if [ "$current" -le 2 ]; then
    # light → default
    hypr_set decoration:blur:size 6
    hypr_set decoration:blur:passes 3
elif [ "$current" -le 6 ]; then
    # default → heavy
    hypr_set decoration:blur:size 12
    hypr_set decoration:blur:passes 4
else
    # heavy → light
    hypr_set decoration:blur:size 2
    hypr_set decoration:blur:passes 1
fi

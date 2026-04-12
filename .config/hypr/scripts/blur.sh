#!/bin/bash
# Cycle blur: light → default → heavy → light
current=$(hyprctl getoption decoration:blur:size -j | jq '.int')

if [ "$current" -le 2 ]; then
    # light → default
    hyprctl keyword decoration:blur:size 6
    hyprctl keyword decoration:blur:passes 3
elif [ "$current" -le 6 ]; then
    # default → heavy
    hyprctl keyword decoration:blur:size 12
    hyprctl keyword decoration:blur:passes 4
else
    # heavy → light
    hyprctl keyword decoration:blur:size 2
    hyprctl keyword decoration:blur:passes 1
fi

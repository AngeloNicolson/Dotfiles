#!/usr/bin/env bash
# Toggle the external monitor DP-1 between landscape (transform 0) and
# portrait/vertical (transform 3). Bound to the Copilot/Assistant key.
MON="DP-1"

cur=$(hyprctl monitors -j | python3 -c \
  "import json,sys; print(next((m['transform'] for m in json.load(sys.stdin) if m['name']=='$MON'), 0))")

if [ "$cur" = "0" ]; then
    t=3   # landscape -> portrait/vertical
else
    t=0   # portrait  -> landscape/horizontal
fi

hyprctl keyword monitor "$MON,1920x1080@60,2048x0,1,transform,$t"

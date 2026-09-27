#!/usr/bin/env bash
# dpms.sh on|off [MONITOR] — DPMS toggle that works under both the Lua config
# (hl.dsp.dpms) and the legacy hyprlang one (hyprctl dispatch dpms ...).
# Used by hypridle.conf, whose on-timeout/on-resume lines can't pick per-session.
. "$(dirname "$0")/hypr-compat.sh"
action="${1:-on}"
mon="${2:-}"
if [ -n "$mon" ]; then
    hypr_dispatch "dpms $action $mon" "hl.dsp.dpms({ action = $(hypr_lua_str "$action"), monitor = $(hypr_lua_str "$mon") })"
else
    hypr_dispatch "dpms $action" "hl.dsp.dpms({ action = $(hypr_lua_str "$action") })"
fi

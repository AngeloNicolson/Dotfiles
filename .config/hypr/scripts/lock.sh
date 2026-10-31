#!/usr/bin/env bash
# Lock the session with whichever locker is installed. The lock screen is an
# optional component of the install (hyprlock), so this is a no-op when none is
# present — callers (lid close, power key) still suspend fine without it.
#
# While locked the keyboard runs the K.I.T.T. scanner (kitt, needs omen-rgb);
# it is stopped — and the static layout restored — the moment the locker exits.
# Hyprland sits in the "locked" submap (keybindings.lua) meanwhile, which
# swallows Space: it starts the scanner's password-entry mode (keypad lit) and
# would otherwise be typed into the password. kitt (--submap locked) resets the
# submap once entry mode starts, so only that first Space is eaten, and
# re-enters it when the scanner resumes. The submap is reset on any exit.
. "$(dirname "$0")/hypr-compat.sh"
submap() { hypr_dispatch "submap $1" "hl.dsp.submap($(hypr_lua_str "$1"))" 2>/dev/null; }
for locker in hyprlock swaylock; do
    if command -v "$locker" >/dev/null 2>&1; then
        trap 'submap reset' EXIT
        command -v kitt >/dev/null 2>&1 && kitt start --submap locked >/dev/null 2>&1
        submap locked
        "$locker" "$@"
        status=$?
        submap reset
        command -v kitt >/dev/null 2>&1 && kitt stop >/dev/null 2>&1
        exit $status
    fi
done
exit 0

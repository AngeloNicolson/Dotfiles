#!/usr/bin/env bash
# Lock the session with whichever locker is installed. The lock screen is an
# optional component of the install (hyprlock), so this is a no-op when none is
# present — callers (lid close, power key) still suspend fine without it.
#
# While locked the keyboard runs the K.I.T.T. scanner (kitt, needs omen-rgb);
# it is stopped — and the static layout restored — the moment the locker exits.
for locker in hyprlock swaylock; do
    if command -v "$locker" >/dev/null 2>&1; then
        command -v kitt >/dev/null 2>&1 && kitt start >/dev/null 2>&1
        "$locker" "$@"
        status=$?
        command -v kitt >/dev/null 2>&1 && kitt stop >/dev/null 2>&1
        exit $status
    fi
done
exit 0

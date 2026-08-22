#!/usr/bin/env bash
# Lock the session with whichever locker is installed. The lock screen is an
# optional component of the install (hyprlock), so this is a no-op when none is
# present — callers (lid close, power key) still suspend fine without it.
for locker in hyprlock swaylock; do
    if command -v "$locker" >/dev/null 2>&1; then
        exec "$locker" "$@"
    fi
done
exit 0

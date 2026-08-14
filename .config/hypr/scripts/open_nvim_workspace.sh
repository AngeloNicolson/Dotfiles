#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="special:nvim"
APP_ID="nvim-terminal"
TITLE="Terminal"

if hyprctl -j monitors | jq -e \
    --arg workspace "$WORKSPACE" \
    'any(.[]; (.specialWorkspace.name? == $workspace) or (.activeSpecialWorkspace.name? == $workspace))' \
    >/dev/null; then
    hyprctl dispatch togglespecialworkspace nvim >/dev/null 2>&1 || true
    exit 0
fi

if hyprctl -j clients | jq -e --arg app_id "$APP_ID" '.[] | select(.class == $app_id)' >/dev/null; then
    hyprctl dispatch togglespecialworkspace nvim >/dev/null 2>&1 || true
    hyprctl dispatch focuswindow "class:$APP_ID" >/dev/null 2>&1 || true
    exit 0
fi

hyprctl dispatch togglespecialworkspace nvim >/dev/null 2>&1 || true
hyprctl dispatch exec "[workspace $WORKSPACE silent] foot -a $APP_ID -T $TITLE" >/dev/null

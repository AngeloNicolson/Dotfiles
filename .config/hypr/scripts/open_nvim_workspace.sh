#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="special:nvim"
APP_ID="nvim-terminal"
TITLE="Terminal"
source "$(dirname "$0")/hypr-compat.sh"   # hypr_dispatch: .conf + Lua sessions

toggle_nvim() { hypr_dispatch "togglespecialworkspace nvim" "hl.dsp.workspace.toggle_special(\"nvim\")" 2>/dev/null || true; }

if hyprctl -j monitors | jq -e \
    --arg workspace "$WORKSPACE" \
    'any(.[]; (.specialWorkspace.name? == $workspace) or (.activeSpecialWorkspace.name? == $workspace))' \
    >/dev/null; then
    toggle_nvim
    exit 0
fi

if hyprctl -j clients | jq -e --arg app_id "$APP_ID" '.[] | select(.class == $app_id)' >/dev/null; then
    toggle_nvim
    hypr_dispatch "focuswindow class:$APP_ID" "hl.dsp.focus({ window = $(hypr_lua_str "class:$APP_ID") })" 2>/dev/null || true
    exit 0
fi

toggle_nvim
hypr_dispatch "exec [workspace $WORKSPACE silent] foot -a $APP_ID -T $TITLE" \
    "hl.dsp.exec_cmd($(hypr_lua_str "foot -a $APP_ID -T $TITLE"), { workspace = $(hypr_lua_str "$WORKSPACE silent") })"

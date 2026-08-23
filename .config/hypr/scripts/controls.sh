#!/bin/bash
source "$(dirname "$0")/hypr-compat.sh"   # hypr_dispatch: .conf + Lua sessions

function close_special_workspace() {
  special_open=`hyprctl monitors -j | jq ".[0].specialWorkspace.name" | grep "special"`
  if [ ! -z $special_open ]; then
    hypr_dispatch "togglespecialworkspace" "hl.dsp.workspace.toggle_special()"
  fi
}

function close_sidebar() {
  bash -c "~/.config/ags/shared/scripts/sidebar.sh close"
}

function control() {
  while read -r line; do
    # Changes workspace
    if [ ${line:0:9} == "workspace" ]; then
      close_special_workspace
    fi

    if [ ${line:0:18} == "changefloatingmode" ] && [ ${line:33:34} == "1" ]; then
      close_sidebar
    fi

    # Opens up special workspace
    if [ ${line:0:22} == "activespecial>>special" ]; then
      close_sidebar
    fi
  done
}

socat -u "UNIX-CONNECT:/tmp/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock" - | control

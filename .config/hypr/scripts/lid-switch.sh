#!/bin/bash

if [ "$1" = "open" ]; then
    # Re-enable eDP-1 and reposition both monitors
    hyprctl keyword monitor "eDP-1, 2560x1600@240, 0x0, 1.25"
    hyprctl keyword monitor "HDMI-A-1, 1920x1080@60, 2048x0, 1"
    # Turn screen back on
    hyprctl dispatch dpms on eDP-1
    # Move workspaces back to eDP-1
    hyprctl dispatch moveworkspacetomonitor 2 eDP-1
    hyprctl dispatch moveworkspacetomonitor 3 eDP-1
    hyprctl dispatch moveworkspacetomonitor 4 eDP-1
    hyprctl dispatch moveworkspacetomonitor 5 eDP-1
else
    # Move all workspaces from eDP-1 to HDMI-A-1 first
    hyprctl dispatch moveworkspacetomonitor 1 HDMI-A-1
    hyprctl dispatch moveworkspacetomonitor 2 HDMI-A-1
    hyprctl dispatch moveworkspacetomonitor 3 HDMI-A-1
    hyprctl dispatch moveworkspacetomonitor 4 HDMI-A-1
    hyprctl dispatch moveworkspacetomonitor 5 HDMI-A-1
    # Now disable eDP-1 and move HDMI to 0x0
    hyprctl keyword monitor "eDP-1, disable"
    hyprctl keyword monitor "HDMI-A-1, 1920x1080@60, 0x0, 1"
fi

#!/bin/bash

STATES_PATH=$HOME/.config/ags/.states.json

case $1 in
  toggle)
    # Don't open sidebar if break popup is visible
    BREAK_POPUP_VISIBLE=$(cat $STATES_PATH | jq -r '.break_popup_visible' 2>/dev/null)
    CURRENT_SIDEBAR=$(cat $STATES_PATH | jq -r '.reveal_sidebar' 2>/dev/null)

    if [[ "$BREAK_POPUP_VISIBLE" == "true" && "$CURRENT_SIDEBAR" == "false" ]]; then
      exit 0
    fi

    # Check if pomodoro is running by reading the state from a temp file
    # If running, open to pomodoro pane, otherwise default to home
    POMODORO_STATE=$(cat $HOME/.cache/pomodoro_state 2>/dev/null || echo "stopped")

    if [[ "$POMODORO_STATE" == "running" || "$POMODORO_STATE" == "paused" ]]; then
      echo `cat $STATES_PATH | jq '.reveal_sidebar |= not | .sidebar_shown = "pomodoro"'` > $STATES_PATH
    else
      echo `cat $STATES_PATH | jq '.reveal_sidebar |= not | .sidebar_shown = "home"'` > $STATES_PATH
    fi
  ;;

  open)
    if [ `cat $STATES_PATH | jq '.reveal_sidebar'` == "true" ]; then
      echo "Already opened."
      exit 1
    fi

    echo `cat $STATES_PATH | jq '.reveal_sidebar = true'` > $STATES_PATH
  ;;

  close)
    if [ `cat $STATES_PATH | jq '.reveal_sidebar'` == "false" ]; then
      echo "Already closed."
      exit 1
    fi

    echo `cat $STATES_PATH | jq '.reveal_sidebar = false'` > $STATES_PATH
  ;;

  toggle-applauncher)
    # Don't open sidebar if break popup is visible
    BREAK_POPUP_VISIBLE=$(cat $STATES_PATH | jq -r '.break_popup_visible' 2>/dev/null)
    if [[ "$BREAK_POPUP_VISIBLE" == "true" ]]; then
      exit 0
    fi

    SIDEBAR_REVEALED=$(cat $STATES_PATH | jq -r '.reveal_sidebar' 2>/dev/null)
    CURRENT_PANE=$(cat $STATES_PATH | jq -r '.sidebar_shown' 2>/dev/null)

    # If sidebar is currently revealed and showing applauncher, close to home
    if [[ "$SIDEBAR_REVEALED" == "true" && "$CURRENT_PANE" == "applauncher" ]]; then
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home"'` > $STATES_PATH
      exit 0
    fi

    # Otherwise, open sidebar to applauncher
    echo `cat $STATES_PATH | jq '.sidebar_shown = "applauncher" | .reveal_sidebar = true'` > $STATES_PATH
  ;;

  toggle-wallpapers)
    # Don't open sidebar if break popup is visible
    BREAK_POPUP_VISIBLE=$(cat $STATES_PATH | jq -r '.break_popup_visible' 2>/dev/null)
    if [[ "$BREAK_POPUP_VISIBLE" == "true" ]]; then
      exit 0
    fi

    SIDEBAR_REVEALED=$(cat $STATES_PATH | jq -r '.reveal_sidebar' 2>/dev/null)
    CURRENT_PANE=$(cat $STATES_PATH | jq -r '.sidebar_shown' 2>/dev/null)

    # If sidebar is currently revealed and showing wallpapers, close to home
    if [[ "$SIDEBAR_REVEALED" == "true" && "$CURRENT_PANE" == "wallpapers" ]]; then
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home"'` > $STATES_PATH
      exit 0
    fi

    # Otherwise, open sidebar to wallpapers
    echo `cat $STATES_PATH | jq '.sidebar_shown = "wallpapers" | .reveal_sidebar = true'` > $STATES_PATH
  ;;

  toggle-pomodoro)
    # Don't open sidebar if break popup is visible
    BREAK_POPUP_VISIBLE=$(cat $STATES_PATH | jq -r '.break_popup_visible' 2>/dev/null)
    if [[ "$BREAK_POPUP_VISIBLE" == "true" ]]; then
      exit 0
    fi

    SIDEBAR_REVEALED=$(cat $STATES_PATH | jq -r '.reveal_sidebar' 2>/dev/null)
    CURRENT_PANE=$(cat $STATES_PATH | jq -r '.sidebar_shown' 2>/dev/null)

    # If sidebar is currently revealed and showing pomodoro, close to home
    if [[ "$SIDEBAR_REVEALED" == "true" && "$CURRENT_PANE" == "pomodoro" ]]; then
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home"'` > $STATES_PATH
      exit 0
    fi

    # Otherwise, open sidebar to pomodoro
    echo `cat $STATES_PATH | jq '.sidebar_shown = "pomodoro" | .reveal_sidebar = true'` > $STATES_PATH
  ;;

  *)
    echo "Unknown action."
  ;;
esac

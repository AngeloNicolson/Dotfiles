#!/bin/bash

STATES_PATH=$HOME/.config/ags/.states.json

case $1 in
  toggle)
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
    if [[ `cat $STATES_PATH | jq -r '.sidebar_shown'` == "applauncher" ]]; then
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home"'` > $STATES_PATH

      exit 0
    fi

    echo `cat $STATES_PATH | jq '.sidebar_shown = "applauncher" | .reveal_sidebar = true'` > $STATES_PATH
  ;;

  toggle-wallpapers)
    if [[ `cat $STATES_PATH | jq -r '.sidebar_shown'` == "wallpapers" ]]; then
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home"'` > $STATES_PATH

      exit 0
    fi

    echo `cat $STATES_PATH | jq '.sidebar_shown = "wallpapers" | .reveal_sidebar = true'` > $STATES_PATH
  ;;

  toggle-pomodoro)
    if [[ `cat $STATES_PATH | jq -r '.sidebar_shown'` == "pomodoro" ]]; then
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home"'` > $STATES_PATH

      exit 0
    fi

    echo `cat $STATES_PATH | jq '.sidebar_shown = "pomodoro" | .reveal_sidebar = true'` > $STATES_PATH
  ;;

  *)
    echo "Unknown action."
  ;;
esac

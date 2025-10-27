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

    # If opening sidebar, set to home (unless pomodoro is running)
    if [[ "$CURRENT_SIDEBAR" == "false" ]]; then
      # Check if pomodoro is running by looking at pomodoro state
      CURRENT_PANE=$(cat $STATES_PATH | jq -r '.sidebar_shown' 2>/dev/null)
      if [[ "$CURRENT_PANE" == "pomodoro" ]]; then
        # Keep pomodoro if it's the current pane (likely running)
        echo `cat $STATES_PATH | jq '.reveal_sidebar = true'` > $STATES_PATH
      else
        # Otherwise go to home
        echo `cat $STATES_PATH | jq '.reveal_sidebar = true | .sidebar_shown = "home"'` > $STATES_PATH
      fi
    else
      # If closing sidebar, just toggle reveal
      echo `cat $STATES_PATH | jq '.reveal_sidebar = false'` > $STATES_PATH
    fi

    # Focus bar window when opening
    NEW_SIDEBAR=$(cat $STATES_PATH | jq -r '.reveal_sidebar' 2>/dev/null)
    if [[ "$NEW_SIDEBAR" == "true" ]]; then
      sleep 0.1
      hyprctl dispatch focuswindow bar
    fi
  ;;

  cycle)
    # Don't open sidebar if break popup is visible
    BREAK_POPUP_VISIBLE=$(cat $STATES_PATH | jq -r '.break_popup_visible' 2>/dev/null)
    if [[ "$BREAK_POPUP_VISIBLE" == "true" ]]; then
      exit 0
    fi

    CURRENT_PANE=$(cat $STATES_PATH | jq -r '.sidebar_shown' 2>/dev/null)

    # Cycle through panes (forward)
    case "$CURRENT_PANE" in
      "home")
        NEXT_PANE="applauncher"
        ;;
      "applauncher")
        NEXT_PANE="wallpapers"
        ;;
      "wallpapers")
        NEXT_PANE="pomodoro"
        ;;
      "pomodoro")
        NEXT_PANE="home"
        ;;
      *)
        NEXT_PANE="home"
        ;;
    esac

    echo `cat $STATES_PATH | jq ".sidebar_shown = \"$NEXT_PANE\" | .reveal_sidebar = true"` > $STATES_PATH
  ;;

  cycle-back)
    # Don't open sidebar if break popup is visible
    BREAK_POPUP_VISIBLE=$(cat $STATES_PATH | jq -r '.break_popup_visible' 2>/dev/null)
    if [[ "$BREAK_POPUP_VISIBLE" == "true" ]]; then
      exit 0
    fi

    CURRENT_PANE=$(cat $STATES_PATH | jq -r '.sidebar_shown' 2>/dev/null)

    # Cycle through panes (backward)
    case "$CURRENT_PANE" in
      "home")
        NEXT_PANE="pomodoro"
        ;;
      "applauncher")
        NEXT_PANE="home"
        ;;
      "wallpapers")
        NEXT_PANE="applauncher"
        ;;
      "pomodoro")
        NEXT_PANE="wallpapers"
        ;;
      *)
        NEXT_PANE="home"
        ;;
    esac

    echo `cat $STATES_PATH | jq ".sidebar_shown = \"$NEXT_PANE\" | .reveal_sidebar = true"` > $STATES_PATH
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

  cycle-panes)
    # Don't open sidebar if break popup is visible
    BREAK_POPUP_VISIBLE=$(cat $STATES_PATH | jq -r '.break_popup_visible' 2>/dev/null)
    if [[ "$BREAK_POPUP_VISIBLE" == "true" ]]; then
      exit 0
    fi

    SIDEBAR_REVEALED=$(cat $STATES_PATH | jq -r '.reveal_sidebar' 2>/dev/null)
    CURRENT_PANE=$(cat $STATES_PATH | jq -r '.sidebar_shown' 2>/dev/null)

    # Cycle through panes: home -> applauncher -> wallpapers -> pomodoro -> home
    case "$CURRENT_PANE" in
      "home")
        NEXT_PANE="applauncher"
        ;;
      "applauncher")
        NEXT_PANE="wallpapers"
        ;;
      "wallpapers")
        NEXT_PANE="pomodoro"
        ;;
      "pomodoro")
        NEXT_PANE="home"
        ;;
      *)
        NEXT_PANE="home"
        ;;
    esac

    echo `cat $STATES_PATH | jq ".sidebar_shown = \"$NEXT_PANE\" | .reveal_sidebar = true"` > $STATES_PATH
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
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home" | .reveal_sidebar = true'` > $STATES_PATH
      exit 0
    fi

    # Otherwise, open sidebar to applauncher
    echo `cat $STATES_PATH | jq '.sidebar_shown = "applauncher" | .reveal_sidebar = true'` > $STATES_PATH

    # Focus bar window for vim keybinds
    sleep 0.1
    hyprctl dispatch focuswindow bar
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
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home" | .reveal_sidebar = true'` > $STATES_PATH
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
      echo `cat $STATES_PATH | jq '.sidebar_shown = "home" | .reveal_sidebar = true'` > $STATES_PATH
      exit 0
    fi

    # Otherwise, open sidebar to pomodoro
    echo `cat $STATES_PATH | jq '.sidebar_shown = "pomodoro" | .reveal_sidebar = true'` > $STATES_PATH
  ;;

  *)
    echo "Unknown action."
  ;;
esac

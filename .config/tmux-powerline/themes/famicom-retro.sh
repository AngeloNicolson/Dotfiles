# shellcheck shell=bash

if patched_font_in_use; then
    # Flip the bubble separators (bold on the right and thin on the left)
    TMUX_POWERLINE_SEPARATOR_LEFT_BOLD=""  # Rounded bold right separator
    TMUX_POWERLINE_SEPARATOR_LEFT_THIN="|"  # Thin rounded left separator
    TMUX_POWERLINE_SEPARATOR_RIGHT_BOLD=""  # Rounded bold left separator
    TMUX_POWERLINE_SEPARATOR_RIGHT_THIN=""  # Thin rounded right separator
else
    # Fallback if patched font is not used
    TMUX_POWERLINE_SEPARATOR_LEFT_BOLD="◁"
    TMUX_POWERLINE_SEPARATOR_LEFT_THIN="❮"
    TMUX_POWERLINE_SEPARATOR_RIGHT_BOLD="▷"
    TMUX_POWERLINE_SEPARATOR_RIGHT_THIN="❯"
fi

# Default colors for the theme
TMUX_POWERLINE_DEFAULT_BACKGROUND_COLOR=${TMUX_POWERLINE_DEFAULT_BACKGROUND_COLOR:-'235'}
TMUX_POWERLINE_DEFAULT_FOREGROUND_COLOR=${TMUX_POWERLINE_DEFAULT_FOREGROUND_COLOR:-'255'}
# shellcheck disable=SC2034
TMUX_POWERLINE_SEG_AIR_COLOR=$(air_color)

TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR=${TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR:-$TMUX_POWERLINE_SEPARATOR_RIGHT_BOLD}
TMUX_POWERLINE_DEFAULT_RIGHTSIDE_SEPARATOR=${TMUX_POWERLINE_DEFAULT_RIGHTSIDE_SEPARATOR:-$TMUX_POWERLINE_SEPARATOR_LEFT_BOLD}

TMUX_POWERLINE_WINDOW_STATUS_CURRENT=(
    "#[fg=#1d2021,bg=#d79921]" 
    "$TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR"
    " #[fg=#f5f5f5,bg=#d79921]#I#F "  
    "$TMUX_POWERLINE_SEPARATOR_RIGHT_THIN"
    " #[fg=#f5f5f5,bg=#d79921]#W "
    "#[fg=#d79921,bg=default,nobold,noitalics,nounderscore]"
    "$TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR"
)

if [ -z "$TMUX_POWERLINE_WINDOW_STATUS_STYLE" ]; then
    TMUX_POWERLINE_WINDOW_STATUS_STYLE=(
        "$(format regular)"
    )
fi

if [ -z "$TMUX_POWERLINE_WINDOW_STATUS_FORMAT" ]; then
    TMUX_POWERLINE_WINDOW_STATUS_FORMAT=(
        "#[$(format regular)]"
        "  #I#{?window_flags,#F, } "
        "$TMUX_POWERLINE_SEPARATOR_RIGHT_THIN"
        " #W "
    )
fi

# Left side status segments (you can customize these segments)
if [ -z "$TMUX_POWERLINE_LEFT_STATUS_SEGMENTS" ]; then
    TMUX_POWERLINE_LEFT_STATUS_SEGMENTS=(
        "tmux_session_info #cc241d 234"
        "pwd #FAF5E7 #282828"
        "vcs_branch #7a824e #282828"
    )
fi

# Right side status segments
if [ -z "$TMUX_POWERLINE_RIGHT_STATUS_SEGMENTS" ]; then
    TMUX_POWERLINE_RIGHT_STATUS_SEGMENTS=(
        "hostname #FAF5E7 0"
        "date_day 235 136"
        "time 235 136 ${TMUX_POWERLINE_SEPARATOR_LEFT_THIN}"
    )
fi


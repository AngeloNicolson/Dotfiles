#!/bin/bash
# Theme applier script
# Usage: apply-theme.sh <theme-name>

THEME_DIR="$HOME/.config/themes"
THEME_NAME="${1:-mech}"
THEME_FILE="$THEME_DIR/$THEME_NAME.json"

if [[ ! -f "$THEME_FILE" ]]; then
  echo "Theme not found: $THEME_FILE"
  exit 1
fi

# Helper to read JSON values (requires jq)
get() {
  jq -r "$1" "$THEME_FILE"
}

# Colors
BG=$(get '.colors.bg')
BG_DARK=$(get '.colors.bg_dark')
BG_LIGHT=$(get '.colors.bg_light')
BG_LIGHTER=$(get '.colors.bg_lighter')
FG=$(get '.colors.fg')
FG_DIM=$(get '.colors.fg_dim')
FG_BRIGHT=$(get '.colors.fg_bright')
ACCENT=$(get '.colors.accent')
RED=$(get '.colors.red')
RED_BRIGHT=$(get '.colors.red_bright')
GREEN=$(get '.colors.green')
GREEN_BRIGHT=$(get '.colors.green_bright')
YELLOW=$(get '.colors.yellow')
YELLOW_BRIGHT=$(get '.colors.yellow_bright')
BLUE=$(get '.colors.blue')
BLUE_BRIGHT=$(get '.colors.blue_bright')
MAGENTA=$(get '.colors.magenta')
MAGENTA_BRIGHT=$(get '.colors.magenta_bright')
CYAN=$(get '.colors.cyan')
CYAN_BRIGHT=$(get '.colors.cyan_bright')
GRAY=$(get '.colors.gray')

# GTK settings
GTK_THEME=$(get '.gtk.theme')
ICON_THEME=$(get '.gtk.iconTheme')
CURSOR_THEME=$(get '.gtk.cursorTheme')
COLOR_SCHEME=$(get '.gtk.colorScheme')

# Hyprland settings
BORDER_RADIUS=$(get '.hyprland.borderRadius')
GAPS_IN=$(get '.hyprland.gapsIn')
GAPS_OUT=$(get '.hyprland.gapsOut')
BORDER_SIZE=$(get '.hyprland.borderSize')

# Strip # from hex colors for configs that need it
strip_hash() {
  echo "${1#\#}"
}

echo "Applying theme: $THEME_NAME"

# --- FOOT ---
FOOT_CONFIG="$HOME/.config/foot/foot.ini"
if [[ -f "$FOOT_CONFIG" ]]; then
  echo "  Updating foot..."
  sed -i "s/^background=.*/background=$(strip_hash $BG)/" "$FOOT_CONFIG"
  sed -i "s/^foreground=.*/foreground=$(strip_hash $FG)/" "$FOOT_CONFIG"
  sed -i "s/^regular0=.*/regular0=$(strip_hash $BG_LIGHT)/" "$FOOT_CONFIG"
  sed -i "s/^regular1=.*/regular1=$(strip_hash $RED)/" "$FOOT_CONFIG"
  sed -i "s/^regular2=.*/regular2=$(strip_hash $GREEN)/" "$FOOT_CONFIG"
  sed -i "s/^regular3=.*/regular3=$(strip_hash $YELLOW)/" "$FOOT_CONFIG"
  sed -i "s/^regular4=.*/regular4=$(strip_hash $BLUE)/" "$FOOT_CONFIG"
  sed -i "s/^regular5=.*/regular5=$(strip_hash $MAGENTA)/" "$FOOT_CONFIG"
  sed -i "s/^regular6=.*/regular6=$(strip_hash $CYAN)/" "$FOOT_CONFIG"
  sed -i "s/^regular7=.*/regular7=$(strip_hash $FG_DIM)/" "$FOOT_CONFIG"
  sed -i "s/^bright0=.*/bright0=$(strip_hash $GRAY)/" "$FOOT_CONFIG"
  sed -i "s/^bright1=.*/bright1=$(strip_hash $RED_BRIGHT)/" "$FOOT_CONFIG"
  sed -i "s/^bright2=.*/bright2=$(strip_hash $GREEN_BRIGHT)/" "$FOOT_CONFIG"
  sed -i "s/^bright3=.*/bright3=$(strip_hash $YELLOW_BRIGHT)/" "$FOOT_CONFIG"
  sed -i "s/^bright4=.*/bright4=$(strip_hash $BLUE_BRIGHT)/" "$FOOT_CONFIG"
  sed -i "s/^bright5=.*/bright5=$(strip_hash $MAGENTA_BRIGHT)/" "$FOOT_CONFIG"
  sed -i "s/^bright6=.*/bright6=$(strip_hash $CYAN_BRIGHT)/" "$FOOT_CONFIG"
  sed -i "s/^bright7=.*/bright7=$(strip_hash $FG_BRIGHT)/" "$FOOT_CONFIG"
fi

# --- GTK (via gsettings) ---
echo "  Updating GTK..."
gsettings set org.gnome.desktop.interface gtk-theme "$GTK_THEME" 2>/dev/null
gsettings set org.gnome.desktop.interface icon-theme "$ICON_THEME" 2>/dev/null
gsettings set org.gnome.desktop.interface cursor-theme "$CURSOR_THEME" 2>/dev/null
gsettings set org.gnome.desktop.interface color-scheme "$COLOR_SCHEME" 2>/dev/null

# --- HYPRLAND ---
echo "  Updating Hyprland..."
hyprctl keyword general:gaps_in "$GAPS_IN" 2>/dev/null
hyprctl keyword general:gaps_out "$GAPS_OUT" 2>/dev/null
hyprctl keyword general:border_size "$BORDER_SIZE" 2>/dev/null
hyprctl keyword decoration:rounding "$BORDER_RADIUS" 2>/dev/null
hyprctl keyword general:col.active_border "rgb($(strip_hash $BG_DARK))" 2>/dev/null
hyprctl keyword general:col.inactive_border "rgb($(strip_hash $BG_DARK))" 2>/dev/null
hyprctl setcursor "$CURSOR_THEME" 20 2>/dev/null

# --- Save current theme ---
echo "$THEME_NAME" > "$THEME_DIR/.current"

echo "Theme applied: $THEME_NAME"

#!/bin/bash
# Theme companion script — the parts of a theme switch that live outside AGS.
# Usage: apply-theme.sh <theme-name>
#
# The AGS theme switcher (ags/theme.ts applyTheme — CORE page, SUPER+W carousel,
# `ags request theme <name>`) writes the shell CSS, foot.ini, GTK gsettings,
# hypr/custom/theme.lua (+ live hyprctl eval), the Firefox chrome and
# themes/.current itself, then runs this script (ThemeSelector.tsx) for what
# is left: dunst colours and the live-reload hooks for running apps.
# Run it by hand only to re-trigger those; use `ags request theme <name>` to
# switch themes.

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

BG_DARK=$(get '.colors.bg_dark')
BG_LIGHTER=$(get '.colors.bg_lighter')
FG=$(get '.colors.fg')
ACCENT=$(get '.colors.accent')
RED_BRIGHT=$(get '.colors.red_bright')

echo "Applying theme (dunst + reload hooks): $THEME_NAME"

# --- DUNST ---
DUNST_CONFIG="$HOME/.config/dunst/dunstrc"
if [[ -f "$DUNST_CONFIG" ]]; then
  echo "  Updating dunst..."
  sed -i "s/^    background = .*/    background = \"$BG_DARK\"/" "$DUNST_CONFIG"
  sed -i "s/^    foreground = .*/    foreground = \"$FG\"/" "$DUNST_CONFIG"
  sed -i "/^\[urgency_normal\]/,/^\[/ s/^    frame_color = .*/    frame_color = \"$ACCENT\"/" "$DUNST_CONFIG"
  sed -i "/^\[urgency_low\]/,/^\[/ s/^    frame_color = .*/    frame_color = \"$BG_LIGHTER\"/" "$DUNST_CONFIG"
  sed -i "/^\[urgency_critical\]/,/^\[/ s/^    frame_color = .*/    frame_color = \"$RED_BRIGHT\"/" "$DUNST_CONFIG"
  sed -i "/^\[global\]/,/^\[/ s/^    frame_color = .*/    frame_color = \"$ACCENT\"/" "$DUNST_CONFIG"
  killall dunst 2>/dev/null   # dunst is D-Bus activated; it restarts on the next notification
fi

# --- Live reload running apps ---

echo "  Reloading foot..."
killall -USR1 foot 2>/dev/null

# nvim's server socket is a flat file: $XDG_RUNTIME_DIR/nvim.<pid>.0
# (older builds: /tmp/nvim.<user>/<random>/nvim.<pid>.0)
echo "  Reloading nvim..."
for sock in "${XDG_RUNTIME_DIR:-/tmp}"/nvim.*.0 /tmp/nvim.*/*/nvim.*.0; do
  [[ -S "$sock" ]] || continue
  nvim --server "$sock" --remote-send '<Cmd>ReloadSystemTheme<CR>' 2>/dev/null
done

echo "  Repainting TUIs..."
for app in ncmpcpp grimoire candor; do
  pkill -WINCH -x "$app" 2>/dev/null
done

# --- Keyboard backlight follows the accent (omen-rgb; see system/README.md) ---
# Skipped when the tool is not installed; a failure (udev rule missing,
# keyboard busy) is reported and never blocks the theme switch.
OMEN_PY="$HOME/.local/share/uv/tools/omen-rgb/bin/python"
if [[ -x "$OMEN_PY" ]]; then
  # Themed per-key layout at low brightness (keyboard-lights.py, next to this script)
  timeout 15 "$OMEN_PY" "$THEME_DIR/keyboard-lights.py" "$THEME_NAME" 2>&1 | sed 's/^/  /' \
    || echo "    keyboard-lights failed (udev rule not installed, or keyboard busy)"
elif command -v omen-rgb >/dev/null 2>&1; then
  echo "  Keyboard backlight -> $ACCENT"
  timeout 10 omen-rgb static "$ACCENT" >/dev/null 2>&1 \
    || echo "    omen-rgb failed (udev rule not installed, or keyboard busy)"
fi

echo "Theme applied: $THEME_NAME"

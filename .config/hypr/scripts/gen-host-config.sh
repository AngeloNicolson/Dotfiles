#!/usr/bin/env bash
# Generate the machine-specific Hyprland monitor config from what is actually
# plugged in, so a fresh machine gets the right resolution/scale/layout without
# hand-editing anything.
#
#   writes  custom/monitors.conf   (gitignored; sourced by hyprland.conf)
#   updates custom/env.conf        (LAPTOP_SCALE, used by the lid scripts)
#
# Usage: gen-host-config.sh [--force] [--scale N] [--dry-run]
#   --force     overwrite an existing monitors.conf (default: leave it alone)
#   --scale N   scale for the built-in laptop panel (skips the DPI heuristic)
#   --dry-run   print what would be written, touch nothing
#
# Needs a running Hyprland session (hyprctl) and jq. Run it once after first
# login, or any time the monitor setup changes and you want a fresh baseline:
#   ~/.config/hypr/scripts/gen-host-config.sh --force && hyprctl reload
#
# Scale heuristic (DPI from the panel's EDID physical size), clamped to a scale
# that gives an integer logical resolution (Hyprland rejects the others):
#   < 115 dpi -> 1      (27" 1440p, 24" 1080p)
#   < 170 dpi -> 1.25   (14" 1080p, 16" 1600p at a "large" setting)
#   < 215 dpi -> 1.5    (15" 4K-ish, 13" 1600p)
#   else      -> 2
# An existing LAPTOP_SCALE in custom/env.conf always wins over the heuristic
# (that's the user's choice), unless --scale is passed.
set -euo pipefail

HYPR_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/hypr"
CUSTOM_DIR="$HYPR_DIR/custom"
OUT="$CUSTOM_DIR/monitors.conf"
ENV_CONF="$CUSTOM_DIR/env.conf"

FORCE=0 DRY=0 SCALE_OVERRIDE=""
while [ $# -gt 0 ]; do
    case "$1" in
        --force)   FORCE=1 ;;
        --dry-run) DRY=1 ;;
        --scale)   SCALE_OVERRIDE="${2:-}"; shift ;;
        -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done

command -v jq >/dev/null      || { echo "gen-host-config: jq is required" >&2; exit 1; }
command -v hyprctl >/dev/null || { echo "gen-host-config: hyprctl not found" >&2; exit 1; }
json="$(hyprctl monitors all -j 2>/dev/null || true)"
# Outside a session hyprctl prints an error string, not JSON — insist on a
# non-empty array before doing anything.
if ! printf '%s' "$json" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
    echo "gen-host-config: no monitors reported — is Hyprland running?" >&2
    exit 1
fi

if [ -f "$OUT" ] && [ "$FORCE" -eq 0 ] && [ "$DRY" -eq 0 ]; then
    echo "gen-host-config: $OUT exists — pass --force to regenerate"
    exit 0
fi

# Existing user preference for the laptop panel scale, if any.
existing_scale=""
if [ -f "$ENV_CONF" ]; then
    existing_scale="$(sed -nE 's/^[[:space:]]*env[[:space:]]*=[[:space:]]*LAPTOP_SCALE,[[:space:]]*([0-9.]+).*/\1/p' "$ENV_CONF" | head -n1)"
fi

is_laptop() { [[ "$1" =~ ^(eDP|LVDS|DSI) ]]; }

# DPI from pixel + physical (mm) size; 0 if the EDID has no physical size.
calc_dpi() {
    awk -v w="$1" -v h="$2" -v pw="$3" -v ph="$4" 'BEGIN {
        if (pw <= 0 || ph <= 0) { print 0; exit }
        diag_px = sqrt(w*w + h*h); diag_in = sqrt(pw*pw + ph*ph) / 25.4
        printf "%.1f", diag_px / diag_in }'
}

heuristic_scale() {
    awk -v d="$1" 'BEGIN {
        if (d <= 0)      print "1";
        else if (d<115)  print "1";
        else if (d<170)  print "1.25";
        else if (d<215)  print "1.5";
        else             print "2" }'
}

# Hyprland needs width/scale and height/scale to be (near) integers. Snap the
# wanted scale to the closest candidate that satisfies that for this mode.
valid_scale() {
    awk -v w="$1" -v h="$2" -v want="$3" 'BEGIN {
        n = split("1 1.25 1.333333 1.5 1.6 1.75 2 2.5", c, " ")
        best = 1; bestd = 1e9
        for (i = 1; i <= n; i++) {
            s = c[i]; lw = w / s; lh = h / s
            if ((lw - int(lw + 0.5))^2 < 1e-4 && (lh - int(lh + 0.5))^2 < 1e-4) {
                d = (s - want) < 0 ? want - s : s - want
                if (d < bestd) { bestd = d; best = s }
            }
        }
        print best }'
}

lines=()
notes=()
x_cursor=0
laptop_scale_final=""

# Laptop panel first (at 0x0), then externals left-to-right in the order reported.
mapfile -t ordered < <(echo "$json" | jq -r 'sort_by(if (.name|test("^(eDP|LVDS|DSI)")) then 0 else 1 end) | .[] | @base64')
for row in "${ordered[@]}"; do
    m() { echo "$row" | base64 -d | jq -r "$1"; }
    name="$(m .name)"; w="$(m .width)"; h="$(m .height)"
    pw="$(m '.physicalWidth // 0')"; ph="$(m '.physicalHeight // 0')"
    cur_scale="$(m '.scale // 1')"
    [ "$w" -gt 0 ] && [ "$h" -gt 0 ] || continue

    dpi="$(calc_dpi "$w" "$h" "$pw" "$ph")"
    if is_laptop "$name"; then
        if [ -n "$SCALE_OVERRIDE" ]; then
            want="$SCALE_OVERRIDE"; why="--scale"
        elif [ -n "$existing_scale" ]; then
            want="$existing_scale"; why="LAPTOP_SCALE in env.conf"
        else
            want="$(heuristic_scale "$dpi")"; why="heuristic (${dpi} dpi)"
        fi
        mode="highrr"   # native res at the highest refresh rate the panel offers
    else
        want="$(heuristic_scale "$dpi")"; why="heuristic (${dpi} dpi)"
        mode="preferred"
    fi
    scale="$(valid_scale "$w" "$h" "$want")"
    [ "$scale" != "$want" ] && why="$why, snapped from $want to an integer logical size"
    is_laptop "$name" && laptop_scale_final="$scale"

    lines+=("monitor = $name, $mode, ${x_cursor}x0, $scale")
    notes+=("#   $name: ${w}x${h}, ${dpi} dpi, scale $scale ($why), currently $cur_scale")
    x_cursor=$(awk -v x="$x_cursor" -v w="$w" -v s="$scale" 'BEGIN { printf "%d", x + w / s }')
done

content="$(cat <<EOF
# Machine-specific monitor layout — GENERATED by scripts/gen-host-config.sh on
# $(hostname) ($(date +%F)). Gitignored. Edit freely, or regenerate with --force.
# Lines here override the universal "monitor = ,preferred,auto,1" fallback in
# hyprland.conf; custom/general.conf is sourced after this file and wins again.
#
# Detected:
$(printf '%s\n' "${notes[@]}")
#
# Format: monitor = NAME, MODE, POSITION, SCALE   (see wiki: Configuring/Monitors)
$(printf '%s\n' "${lines[@]}")
EOF
)"

if [ "$DRY" -eq 1 ]; then
    echo "# ---- would write $OUT ----"
    echo "$content"
    [ -n "$laptop_scale_final" ] && echo "# ---- would set LAPTOP_SCALE=$laptop_scale_final in $ENV_CONF ----"
    exit 0
fi

mkdir -p "$CUSTOM_DIR"
printf '%s\n' "$content" > "$OUT"
echo "wrote $OUT"

if [ -n "$laptop_scale_final" ]; then
    if [ -f "$ENV_CONF" ] && grep -qE '^[[:space:]]*env[[:space:]]*=[[:space:]]*LAPTOP_SCALE,' "$ENV_CONF"; then
        sed -i -E "s/^([[:space:]]*env[[:space:]]*=[[:space:]]*LAPTOP_SCALE,)[[:space:]]*[0-9.]+/\1$laptop_scale_final/" "$ENV_CONF"
    else
        {
            echo ""
            echo "# ── Display scaling (set by gen-host-config.sh) ─────────────────────────────"
            echo "# Laptop panel scale the lid scripts re-apply when the panel is re-enabled."
            echo "env = LAPTOP_SCALE,$laptop_scale_final"
        } >> "$ENV_CONF"
    fi
    echo "set LAPTOP_SCALE=$laptop_scale_final in $ENV_CONF"
fi
echo "apply with: hyprctl reload"

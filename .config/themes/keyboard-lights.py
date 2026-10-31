#!/usr/bin/env python3
"""Themed, dim per-key lighting for the Omen Max 16 keyboard.

    keyboard-lights.py <theme> [--style drpepper|theme] [--brightness 0.3]
    keyboard-lights.py --off

Runs on omen-rgb's own interpreter (uv tool venv) so the SDK is importable:
apply-theme.sh invokes it that way. Brightness is a 0..1 multiplier on top of the
per-group levels below; a theme can set its own in look.keyboardBrightness.
"""
import argparse, json, os, sys

THEME_DIR = os.path.expanduser("~/.config/themes")

# Styles. "drpepper" (default): everything a deep candy Dr Pepper red, f/j in
# the theme accent so the home-row bumps stand out. "theme": the palette layout.
# A colour is either a theme palette key or a literal #rrggbb.
DEFAULT_STYLE = "drpepper"
DRPEPPER_RED = "#C01010"  # no blue: a maroon with blue in it reads pink on these LEDs when dimmed
STYLES = {
    "drpepper": {
        "base": (DRPEPPER_RED, 0.8),
        "groups": [
            (["f", "j"], "accent", 1.0),
        ],
    },
    "theme": {
        "base": ("accent", 0.35),
        "groups": None,  # filled from GROUPS below
    },
}
GROUPS = [
    (["w", "a", "s", "d", "left", "up", "down", "right"], "accent", 1.0),
    (["enter", "space", "backspace", "tab", "num_enter"], "accent", 0.65),
    (["esc", "power"], "red", 0.8),
    (["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12", "delete"], "fg_dim", 0.35),
    (["l_shift", "r_shift", "l_ctrl", "l_alt", "r_alt", "l_win", "fn", "caps_lock"], "fg_dim", 0.45),
    (["num_lock", "num_slash", "num_star", "num_minus", "num_plus", "num_dot",
      "num_0", "num_1", "num_2", "num_3", "num_4", "num_5", "num_6", "num_7", "num_8", "num_9"], "blue", 0.55),
    (["omen", "copilot", "settings", "calculator"], "magenta", 0.45),
]
STYLES["theme"]["groups"] = GROUPS

def resolve(colors, name):
    return hex_rgb(name) if name.startswith("#") else hex_rgb(colors[name])

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def scale(rgb, f):
    f = max(0.0, min(1.0, f))
    return tuple(int(round(c * f)) for c in rgb)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("theme", nargs="?")
    ap.add_argument("--brightness", type=float, default=None, help="0..1 overall level (default: theme's look.keyboardBrightness or 0.3)")
    ap.add_argument("--style", choices=sorted(STYLES), default=DEFAULT_STYLE)
    ap.add_argument("--off", action="store_true")
    args = ap.parse_args()

    try:
        from omen_rgb import OmenKeyboard
    except ImportError:
        sys.exit("omen_rgb not importable: run with ~/.local/share/uv/tools/omen-rgb/bin/python")

    kb = OmenKeyboard()
    try:
        if args.off:
            kb.set_all(0, 0, 0); kb.apply(); return
        if not args.theme:
            ap.error("theme name required")
        with open(os.path.join(THEME_DIR, args.theme + ".json")) as f:
            theme = json.load(f)
        colors = theme["colors"]
        level = args.brightness if args.brightness is not None else float(theme.get("look", {}).get("keyboardBrightness", 0.3))

        style = STYLES[args.style]
        base = scale(resolve(colors, style["base"][0]), style["base"][1] * level)
        kb.set_all(*base)
        missing = []
        for keys, name, rel in style["groups"]:
            rgb = scale(resolve(colors, name), rel * level)
            for k in keys:
                try:
                    kb.set_key_color(k, *rgb)
                except Exception:
                    missing.append(k)
        kb.apply()
        print(f"keyboard: {args.style} style, {args.theme} palette at {level:.2f} (base {base})")
        if missing:
            print("  unknown keys skipped: " + " ".join(missing))
    finally:
        kb.close()

if __name__ == "__main__":
    main()

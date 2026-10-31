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

# Styles. "theme" (default): the palette layout below, dim. "drpepper": everything
# a deep candy Dr Pepper red with f/j/caps in the theme accent. "translucent":
# the whole board in the accent, evenly (Halo = X25 translucent green). A theme
# chooses with look.keyboardStyle; 43pr uses drpepper, halo translucent.
# A colour is either a theme palette key or a literal #rrggbb.
DEFAULT_STYLE = "theme"  # a theme can pick another via look.keyboardStyle (43pr: drpepper)
DRPEPPER_RED = "#C01010"  # no blue: a maroon with blue in it reads pink on these LEDs when dimmed
STYLES = {
    "drpepper": {
        "base": (DRPEPPER_RED, 0.8),
        "groups": [
            (["f", "j", "caps_lock"], "accent", 1.0),
        ],
    },
    "theme": {
        "base": ("accent", 0.35),
        "groups": None,  # filled from GROUPS below
    },
    # The X25 console look: every key the translucent OG green, lit evenly, with
    # the home-row bumps and caps lock in the lighter jewel highlight.
    "translucent": {
        "base": ("kb", 1.0),
        "groups": [
            (["f", "j", "caps_lock", "enter", "l_win"], "kb_hi", 1.0),
        ],
    },
}
GROUPS = [
    (["w", "a", "s", "d", "left", "up", "down", "right", "f", "j", "caps_lock"], "accent", 1.0),
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

# A theme may give the keyboard its own colours (UI accents are tuned for text
# on dark backgrounds and wash out on diodes): look.keyboardColor is the board
# colour for the translucent style, look.keyboardHighlight the f/j/caps colour.
def keyboard_colors(theme):
    look = theme.get("look", {})
    c = dict(theme["colors"])
    if look.get("keyboardColor"): c["kb"] = look["keyboardColor"]
    if look.get("keyboardHighlight"): c["kb_hi"] = look["keyboardHighlight"]
    c.setdefault("kb", c["accent"]); c.setdefault("kb_hi", c.get("green_bright", c["fg_bright"]))
    return c

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def scale(rgb, f):
    f = max(0.0, min(1.0, f))
    return tuple(int(round(c * f)) for c in rgb)

def build_frame(theme_name, style_name=None, brightness=None):
    """Per-key colours for a theme: returns ({key_name: (r,g,b)}, base_rgb, style_name, level)."""
    with open(os.path.join(THEME_DIR, theme_name + ".json")) as f:
        theme = json.load(f)
    colors = keyboard_colors(theme)
    look = theme.get("look", {})
    level = brightness if brightness is not None else float(look.get("keyboardBrightness", 0.3))
    style_name = style_name or look.get("keyboardStyle", DEFAULT_STYLE)
    if style_name not in STYLES:
        style_name = DEFAULT_STYLE
    style = STYLES[style_name]
    base = scale(resolve(colors, style["base"][0]), style["base"][1] * level)
    frame = {}
    for keys, name, rel in style["groups"]:
        rgb = scale(resolve(colors, name), rel * level)
        for k in keys:
            frame[k] = rgb
    return frame, base, style_name, level

def apply_frame(kb, frame, base, persist=True):
    """Push a frame (per-key overrides over a base colour) to the keyboard."""
    kb.set_all(*base)
    missing = []
    for k, rgb in frame.items():
        try:
            kb.set_key_color(k, *rgb)
        except Exception:
            missing.append(k)
    kb.apply(persist=persist)
    return missing

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("theme", nargs="?")
    ap.add_argument("--brightness", type=float, default=None, help="0..1 overall level (default: theme's look.keyboardBrightness or 0.3)")
    ap.add_argument("--style", choices=sorted(STYLES), default=None, help="default: theme's look.keyboardStyle, else " + DEFAULT_STYLE)
    ap.add_argument("--off", action="store_true")
    args = ap.parse_args()

    try:
        from omen_rgb import OmenKeyboard
    except ImportError:
        sys.exit("omen_rgb not importable: run with ~/.local/share/uv/tools/omen-rgb/bin/python")

    try:
        kb = OmenKeyboard()
    except Exception as e:
        # The reactive daemon holds the USB interface. It re-reads the theme on
        # SIGUSR1 and re-applies the layout itself, so hand the job to it.
        import subprocess
        active = subprocess.run(["systemctl", "--user", "is-active", "keyboard-reactive.service"],
                                capture_output=True, text=True).stdout.strip() == "active"
        if active and not args.off:
            subprocess.run(["systemctl", "--user", "kill", "-s", "USR1", "keyboard-reactive.service"], check=False)
            print(f"keyboard: {args.theme or 'current'} applied via keyboard-reactive.service")
            return
        sys.exit(f"keyboard: cannot open the keyboard ({e})")
    try:
        if args.off:
            kb.set_all(0, 0, 0); kb.apply(); return
        if not args.theme:
            ap.error("theme name required")
        frame, base, style_name, level = build_frame(args.theme, args.style, args.brightness)
        missing = apply_frame(kb, frame, base)
        print(f"keyboard: {style_name} style, {args.theme} palette at {level:.2f} (base {base})")
        if missing:
            print("  unknown keys skipped: " + " ".join(missing))
    finally:
        kb.close()

if __name__ == "__main__":
    main()

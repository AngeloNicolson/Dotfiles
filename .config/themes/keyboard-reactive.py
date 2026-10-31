#!/usr/bin/env python3
"""Reactive keyboard lighting for the Omen Max 16, on top of the theme layout.

  * a pressed key flashes to full intensity of its own hue and fades back over ~0.6 s
    (the theme's highlight keys — f/j/caps/enter/super on Halo — stay solid)
  * holding Super (or AltGr) shows only the keys with a Hyprland binding for
    the modifiers currently held, in the theme's highlight colour; the rest dim
  * follows theme switches (~/.config/themes/.current), stays out of the way
    while the K.I.T.T. scanner runs (kitt pidfile), and restores the layout on exit

Runs on omen-rgb's interpreter (needs hidapi + evdev there). Reading key events
needs the udev rule in system/etc/udev/rules.d/70-omen-rgb.rules (input nodes).

    keyboard-reactive.py [--demo]     # --demo: fake a few presses and the Super hint, then exit
"""
import argparse, importlib.util, json, os, select, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
THEME_DIR = os.path.expanduser("~/.config/themes")
CURRENT = os.path.join(THEME_DIR, ".current")
KITT_PID = os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "kitt.pid")
KEYBOARD_NAMES = ("HP HP Gaming Keyboard II", "HP HP Gaming Keyboard II Keyboard")

FADE_S = 0.6          # press -> back to base
PRESS_LEVEL = 1.0     # pressed key: its own hue pushed to this fraction of full intensity
HINT_DIM = 0.12       # everything-else brightness while a hint is showing
FPS = 60

spec = importlib.util.spec_from_file_location("keyboard_lights", os.path.join(HERE, "keyboard-lights.py"))
KL = importlib.util.module_from_spec(spec); spec.loader.exec_module(KL)

# evdev key code name -> omen-rgb key name
EV2KEY = {
    "KEY_ESC": "esc", "KEY_DELETE": "delete", "KEY_GRAVE": "tilde", "KEY_MINUS": "minus", "KEY_EQUAL": "equal",
    "KEY_BACKSPACE": "backspace", "KEY_TAB": "tab", "KEY_LEFTBRACE": "l_bracket", "KEY_RIGHTBRACE": "r_bracket",
    "KEY_BACKSLASH": "backslash", "KEY_CAPSLOCK": "caps_lock", "KEY_SEMICOLON": "semicolon", "KEY_APOSTROPHE": "quote",
    "KEY_ENTER": "enter", "KEY_LEFTSHIFT": "l_shift", "KEY_RIGHTSHIFT": "r_shift", "KEY_COMMA": "comma", "KEY_DOT": "dot",
    "KEY_SLASH": "slash", "KEY_LEFTCTRL": "l_ctrl", "KEY_LEFTMETA": "l_win", "KEY_LEFTALT": "l_alt", "KEY_SPACE": "space",
    "KEY_RIGHTALT": "r_alt", "KEY_LEFT": "left", "KEY_UP": "up", "KEY_DOWN": "down", "KEY_RIGHT": "right",
    "KEY_NUMLOCK": "num_lock", "KEY_KPSLASH": "num_slash", "KEY_KPASTERISK": "num_star", "KEY_KPMINUS": "num_minus",
    "KEY_KPPLUS": "num_plus", "KEY_KPENTER": "num_enter", "KEY_KPDOT": "num_dot", "KEY_CALC": "calculator", "KEY_POWER": "power",
}
for i in range(1, 13): EV2KEY[f"KEY_F{i}"] = f"f{i}"
for d in "0123456789": EV2KEY[f"KEY_{d}"] = d; EV2KEY[f"KEY_KP{d}"] = f"num_{d}"
for c in "abcdefghijklmnopqrstuvwxyz": EV2KEY[f"KEY_{c.upper()}"] = c

# Hyprland modmask bits; this keyboard's lv3 (AltGr) is MOD5
MOD_OF = {"KEY_LEFTSHIFT": 1, "KEY_RIGHTSHIFT": 1, "KEY_LEFTCTRL": 4, "KEY_RIGHTCTRL": 4, "KEY_LEFTALT": 8,
          "KEY_LEFTMETA": 64, "KEY_RIGHTMETA": 64, "KEY_RIGHTALT": 128}
HINT_MODS = 64 | 128   # show hints while Super or AltGr is held

# Hyprland bind key names -> omen-rgb key names
HL2KEY = {"Return": "enter", "Escape": "esc", "space": "space", "Tab": "tab", "grave": "tilde", "comma": "comma",
          "period": "dot", "slash": "slash", "minus": "minus", "equal": "equal", "semicolon": "semicolon",
          "apostrophe": "quote", "bracketleft": "l_bracket", "bracketright": "r_bracket", "backslash": "backslash",
          "BackSpace": "backspace", "Delete": "delete", "Left": "left", "Right": "right", "Up": "up", "Down": "down",
          "Caps_Lock": "caps_lock"}

def hl_key_name(key):
    if key in HL2KEY: return HL2KEY[key]
    if len(key) == 1 and key.isalnum(): return key.lower()
    if key.startswith("F") and key[1:].isdigit(): return key.lower()
    if key.startswith("code:"):
        try:
            from evdev import ecodes
            return EV2KEY.get(ecodes.KEY[int(key[5:]) - 8])
        except Exception: return None
    return None

def load_binds():
    """{modmask: set(key_name)} from hyprctl, top-level submap only, keyboard keys only."""
    out = {}
    try:
        binds = json.loads(subprocess.run(["hyprctl", "binds", "-j"], capture_output=True, text=True, timeout=5).stdout)
    except Exception:
        return out
    for b in binds:
        if b.get("submap") or b.get("mouse"): continue
        k = hl_key_name(b.get("key", ""))
        if k: out.setdefault(b["modmask"], set()).add(k)
    return out

def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def flash_of(rgb):
    """The same hue at full intensity (max channel -> 255 * PRESS_LEVEL)."""
    m = max(rgb)
    if m == 0: return tuple(int(255 * PRESS_LEVEL) for _ in rgb)
    return tuple(min(255, int(c * 255 * PRESS_LEVEL / m)) for c in rgb)

class Lights:
    def __init__(self, demo=False):
        from omen_rgb import OmenKeyboard
        self.kb = OmenKeyboard()
        self.demo = demo
        self.theme = None; self.theme_mtime = 0
        self.frame = {}; self.base = (0, 0, 0); self.hi = (255, 255, 255)
        self.fades = {}            # key -> press time
        self.mods = 0; self.hint_shown = None
        self.binds = load_binds(); self.binds_at = time.monotonic()
        self.reload_theme(force=True)

    def reload_theme(self, force=False):
        try: m = os.stat(CURRENT).st_mtime
        except OSError: m = 0
        if not force and m == self.theme_mtime: return False
        self.theme_mtime = m
        try: name = open(CURRENT).read().strip()
        except OSError: name = "mech"
        try:
            self.frame, self.base, _, level = KL.build_frame(name)
            t = json.load(open(os.path.join(THEME_DIR, name + ".json")))
            kc = KL.keyboard_colors(t)
            self.hi = KL.scale(KL.hex_rgb(kc["kb_hi"]), level)
            self.theme = name
        except Exception as e:
            print(f"reactive: theme {name}: {e}", file=sys.stderr)
        self.render(force=True)
        return True

    def color_of(self, key):
        return self.frame.get(key, self.base)

    def kitt_running(self):
        try:
            pid = int(open(KITT_PID).read().strip()); os.kill(pid, 0); return True
        except Exception: return False

    def render(self, force=False):
        if self.kitt_running() and not force: return
        now = time.monotonic()
        hint = self.mods if (self.mods & HINT_MODS) else None
        self.kb.set_all(*(mix((0, 0, 0), self.base, HINT_DIM) if hint is not None else self.base))
        for key, rgb in self.frame.items():
            self.kb.set_key_color(key, *(mix((0, 0, 0), rgb, HINT_DIM) if hint is not None else rgb))
        if hint is not None:
            # bound keys in the bright version of the board colour (not the
            # highlight colour, so they read apart from the fixed anchor keys)
            hint_rgb = flash_of(self.base)
            for key in self.binds.get(hint, ()):
                try: self.kb.set_key_color(key, *hint_rgb)
                except Exception: pass
            for code, bit in MOD_OF.items():
                if hint & bit and EV2KEY.get(code):
                    try: self.kb.set_key_color(EV2KEY[code], *hint_rgb)
                    except Exception: pass
        done = []
        for key, t0 in self.fades.items():
            t = (now - t0) / FADE_S
            if t >= 1: done.append(key); continue
            target = self.color_of(key) if hint is None else mix((0, 0, 0), self.color_of(key), HINT_DIM)
            try: self.kb.set_key_color(key, *mix(flash_of(self.color_of(key)), target, t * t))
            except Exception: pass
        for key in done: self.fades.pop(key, None)
        self.kb.apply(persist=False)
        self.hint_shown = hint

    def on_key(self, code_name, value):
        bit = MOD_OF.get(code_name, 0)
        if bit:
            if value == 1: self.mods |= bit
            elif value == 0: self.mods &= ~bit
        if value == 1:
            key = EV2KEY.get(code_name)
            if key and key not in self.frame:   # highlight keys stay solid
                self.fades[key] = time.monotonic()
            if self.mods & HINT_MODS and time.monotonic() - self.binds_at > 30:
                self.binds = load_binds(); self.binds_at = time.monotonic()

    def busy(self):
        return bool(self.fades) or (self.mods & HINT_MODS) or self.hint_shown is not None

    def close(self):
        try:
            KL.apply_frame(self.kb, self.frame, self.base)
        finally:
            self.kb.close()

def open_inputs():
    import evdev
    devs = []
    for path in evdev.list_devices():
        try:
            d = evdev.InputDevice(path)
            caps = d.capabilities().get(evdev.ecodes.EV_KEY, [])
            if d.name in KEYBOARD_NAMES and evdev.ecodes.KEY_A in caps:
                devs.append(d)
            else:
                d.close()
        except Exception:
            pass
    return devs

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--demo", action="store_true"); args = ap.parse_args()
    lights = Lights(demo=args.demo)
    stop = {"now": False}
    def on_sig(*_): stop["now"] = True
    signal.signal(signal.SIGINT, on_sig); signal.signal(signal.SIGTERM, on_sig)

    if args.demo:
        try:
            for k in ("KEY_F", "KEY_J", "KEY_SPACE"):
                lights.on_key(k, 1); lights.on_key(k, 0)
                for _ in range(int(FADE_S * FPS)): lights.render(); time.sleep(1 / FPS)
            lights.on_key("KEY_LEFTMETA", 1); lights.render(); time.sleep(1.5)
            lights.on_key("KEY_LEFTSHIFT", 1); lights.render(); time.sleep(1.5)
            lights.on_key("KEY_LEFTSHIFT", 0); lights.on_key("KEY_LEFTMETA", 0); lights.render()
            print("demo: super binds ->", sorted(lights.binds.get(64, ())))
        finally:
            lights.close()
        return

    import evdev
    devs = []
    last_scan = 0
    try:
        while not stop["now"]:
            if not devs and time.monotonic() - last_scan > 10:
                devs = open_inputs(); last_scan = time.monotonic()
                if not devs: print("reactive: no readable keyboard input device (udev rule installed?)", file=sys.stderr)
            timeout = (1 / FPS) if lights.busy() else 0.5
            r, _, _ = select.select([d.fd for d in devs], [], [], timeout)
            for d in devs:
                if d.fd in r:
                    try:
                        for ev in d.read():
                            if ev.type == evdev.ecodes.EV_KEY:
                                name = evdev.ecodes.KEY.get(ev.code)
                                if isinstance(name, list): name = name[0]
                                lights.on_key(name, ev.value)
                    except OSError:
                        devs = []
            if lights.reload_theme(): continue
            if lights.busy(): lights.render()
    finally:
        lights.close()

if __name__ == "__main__":
    main()

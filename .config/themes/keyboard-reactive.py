#!/usr/bin/env python3
"""Reactive keyboard lighting for the Omen Max 16, on top of the theme layout.

  * a pressed key flashes to full intensity of its own hue and fades back over ~0.6 s
    (the theme's highlight keys — f/j/caps/enter/super on Halo — stay solid)
  * holding Super (or AltGr) shows only the keys with a Hyprland binding for
    the modifiers currently held, in the theme's highlight colour; the rest dim
  * state on the keys: the active Hyprland workspace's number key lights in the
    highlight colour; Esc and Caps show vim's mode (insert = bright board colour,
    visual = blue, replace = red, command = cyan) while nvim has focus
  * follows theme switches (~/.config/themes/.current), stays out of the way
    while the K.I.T.T. scanner runs (kitt pidfile), and restores the layout on exit
  * after a wake the layout crossfades in over WAKE_FADE_S from the theme's lock
    look (keyboard-lights.sleep_look: the scanner's resting base) instead of
    snapping on — the highlight keys rise out of the base. Triggered when the
    scanner releases the keyboard at unlock, when a USB handle is lost across
    suspend, and by SIGUSR2 (hypridle's after_sleep_cmd)

Runs on omen-rgb's interpreter (needs hidapi + evdev there). Reading key events
needs the udev rule in system/etc/udev/rules.d/70-omen-rgb.rules (input nodes).

    keyboard-reactive.py [--demo]     # --demo: fake a few presses and the Super hint, then exit
"""
import argparse, importlib.util, json, os, select, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
THEME_DIR = os.path.expanduser("~/.config/themes")
CURRENT = os.path.join(THEME_DIR, ".current")
KITT_PID = os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "kitt.pid")
MODE_FILE = os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "nvim-mode")

def ensure_hypr_env():
    """hyprctl and the event socket need HYPRLAND_INSTANCE_SIGNATURE. As a user
    service we can start before Hyprland has imported its environment into the
    manager, so fall back to the newest instance dir under $XDG_RUNTIME_DIR/hypr."""
    if os.environ.get("HYPRLAND_INSTANCE_SIGNATURE"): return True
    root = os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "hypr")
    try:
        cands = [d for d in os.listdir(root) if os.path.exists(os.path.join(root, d, ".socket.sock"))]
        cands.sort(key=lambda d: os.stat(os.path.join(root, d)).st_mtime)
    except OSError:
        cands = []
    if not cands: return False
    os.environ["HYPRLAND_INSTANCE_SIGNATURE"] = cands[-1]
    return True

def hypr_sock():
    return os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "hypr",
                        os.environ.get("HYPRLAND_INSTANCE_SIGNATURE", ""), ".socket2.sock")
MODE_KEYS = ("esc",)   # caps is remapped to Esc and stays an anchor; only Esc shows the mode

FADE_S = 0.6          # press -> back to base
WAKE_FADE_S = 3.0     # wake: lock base -> layout. Base over the first 60 %, highlights over the last 60 %
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
    ensure_hypr_env()
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

def ease(t):
    """0..1 -> 0..1, smoothstep (gentle start and finish)."""
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def flash_of(rgb):
    """The same hue at full intensity (max channel -> 255 * PRESS_LEVEL)."""
    m = max(rgb)
    if m == 0: return tuple(int(255 * PRESS_LEVEL) for _ in rgb)
    return tuple(min(255, int(c * 255 * PRESS_LEVEL / m)) for c in rgb)

class Lights:
    def __init__(self, demo=False):
        from omen_rgb import OmenKeyboard
        self.kb = OmenKeyboard()
        self.pt = KL.Painter(self.kb)
        self.demo = demo
        self.theme = None; self.theme_mtime = 0
        self.frame = {}; self.base = (0, 0, 0); self.hi = (255, 255, 255)
        self.fades = {}            # key -> press time
        self.mods = 0; self.hint_shown = None
        self.workspace = None; self.vim_mode = ""; self.mode_mtime = 0; self.dirty = False
        self.wake_t0 = None        # set while the wake crossfade runs
        self.sleep_base = (0, 0, 0); self.ws_hint_rgb = (255, 0, 0); self.mode_colors = {}
        self.load_hypr()
        self.reload_theme(force=True)

    def load_hypr(self):
        """Binds + active workspace from hyprctl. Retried from the main loop while
        empty (Hyprland may not be up, or its env not yet imported, when we start)."""
        ensure_hypr_env()
        try:
            ws = int(json.loads(subprocess.run(["hyprctl", "activeworkspace", "-j"],
                                 capture_output=True, text=True, timeout=3).stdout)["name"])
            if ws != self.workspace: self.workspace = ws; self.dirty = True
        except Exception: pass
        self.binds = load_binds(); self.binds_at = time.monotonic()
        return bool(self.binds)

    def reload_theme(self, force=False):
        try: m = os.stat(CURRENT).st_mtime
        except OSError: m = 0
        if not force and m == self.theme_mtime: return False
        self.theme_mtime = m
        # Re-read keyboard-lights.py too, so edited styles/groups apply without a restart
        try:
            spec.loader.exec_module(KL)
            if self.kb is not None: self.pt = KL.Painter(self.kb)
        except Exception as e:
            print(f"reactive: reload keyboard-lights.py: {e}", file=sys.stderr)
        try: name = open(CURRENT).read().strip()
        except OSError: name = "mech"
        try:
            self.frame, self.base, _, level = KL.build_frame(name)
            t = json.load(open(os.path.join(THEME_DIR, name + ".json")))
            kc = KL.keyboard_colors(t)
            self.hi = KL.scale(KL.hex_rgb(kc["kb_hi"]), level)
            self.sleep_base = KL.sleep_look(t)[0]
            self.ws_hint_rgb = KL.scale((255, 0, 0), max(level, 0.6))   # pure red: theme reds with blue in them read pink on these diodes
            self.mode_colors = {
                "i": flash_of(self.base),
                "v": KL.scale(KL.hex_rgb(t["colors"]["blue_bright"]), max(level, 0.6)),
                "R": KL.scale(KL.hex_rgb(t["colors"]["red_bright"]), max(level, 0.6)),
                "c": KL.scale(KL.hex_rgb(t["colors"]["cyan_bright"]), max(level, 0.6)),
                "t": KL.scale(KL.hex_rgb(t["colors"]["magenta_bright"]), max(level, 0.6)),
            }
            self.theme = name
        except Exception as e:
            print(f"reactive: theme {name}: {e}", file=sys.stderr)
        self.render(force=True)
        return True

    def ws_hint_key(self, hint):
        """The active workspace's number key, when it is bound under this hint."""
        if self.workspace is None: return None
        k = str(self.workspace)
        return k if k in self.binds.get(hint, ()) else None

    def start_fade_in(self):
        """Crossfade the layout in from the theme's lock look (a wake / the scanner handing back)."""
        self.wake_t0 = time.monotonic(); self.dirty = True

    def color_of(self, key):
        return self.frame.get(key, self.base)

    def kitt_running(self):
        try:
            pid = int(open(KITT_PID).read().strip()); os.kill(pid, 0); return True
        except Exception: return False

    # The USB interface is exclusive: while the K.I.T.T. scanner runs we must
    # let go of the keyboard entirely, and take it back (re-applying the layout)
    # once the scanner has exited.
    def yield_to_kitt(self):
        if self.kitt_running():
            if self.kb is not None:
                try: self.kb.close()
                except Exception: pass
                self.kb = None
            return True
        if self.kb is None:
            try:
                from omen_rgb import OmenKeyboard
                self.kb = OmenKeyboard(); self.pt = KL.Painter(self.kb)
                self.fades.clear(); self.start_fade_in(); self.render(force=True)
            except Exception:
                return True   # scanner still releasing; try again next loop
        return False

    def render(self, force=False):
        if self.kb is None: return
        if self.kitt_running() and not force: return
        now = time.monotonic()
        hint = self.mods if (self.mods & HINT_MODS) else None
        # wake crossfade from the lock base: the board's base over the first 60 %
        # of WAKE_FADE_S, the highlight keys (and overlays) over the last 60 %
        b_base = b_hi = None
        if self.wake_t0 is not None:
            t = (now - self.wake_t0) / WAKE_FADE_S
            if t >= 1: self.wake_t0 = None
            else:
                b_base = (self.sleep_base, ease(t / 0.6)); b_hi = (self.sleep_base, ease((t - 0.4) / 0.6))
        self.pt.blend = b_base
        self.pt.all(mix((0, 0, 0), self.base, HINT_DIM) if hint is not None else self.base)
        self.pt.blend = b_hi
        for key, rgb in self.frame.items():
            try: self.pt.key(key, mix((0, 0, 0), rgb, HINT_DIM) if hint is not None else rgb)
            except Exception: pass
        if hint is None:
            # state overlays: active workspace number, vim mode on Esc/Caps
            if self.workspace is not None:
                try: self.pt.key(str(self.workspace), self.hi)
                except Exception: pass
            m = self.vim_mode[:1] if self.vim_mode else ""
            m = "v" if m in ("v", "V", "\x16") else m
            rgb = self.mode_colors.get(m) if m else None
            if rgb:
                for key in MODE_KEYS:
                    try: self.pt.key(key, rgb)
                    except Exception: pass
        else:
            # bound keys turn the theme's highlight colour (gold on Halo)
            hint_rgb = self.hi
            for key in self.binds.get(hint, ()):
                try: self.pt.key(key, hint_rgb)
                except Exception: pass
            for code, bit in MOD_OF.items():
                if hint & bit and EV2KEY.get(code):
                    try: self.pt.key(EV2KEY[code], hint_rgb)
                    except Exception: pass
            # the active workspace's number reads red under the hint, so it stands
            # apart from the other bound numbers (white/highlight in the normal view)
            ws = self.ws_hint_key(hint)
            if ws:
                try: self.pt.key(ws, self.ws_hint_rgb)
                except Exception: pass
        done = []
        for key, t0 in self.fades.items():
            t = (now - t0) / FADE_S
            if t >= 1: done.append(key); continue
            if hint is None:
                target = self.color_of(key)
            elif key in self.binds.get(hint, ()):
                # a bound key under the hint flashes in the hint colour and settles
                # back to it: fading the board hue down to near-black instead went
                # through a dim red+blue zone that reads red on these diodes
                target = self.ws_hint_rgb if key == self.ws_hint_key(hint) else self.hi
            else:
                continue                      # unbound keys do nothing under the hint; no flash
            try: self.pt.key(key, mix(flash_of(target), target, t * t))
            except Exception: pass
        for key in done: self.fades.pop(key, None)
        self.pt.blend = None
        try:
            self.kb.apply(persist=False)
        except Exception as e:
            # The USB controller drops across suspend/resume: let go of the stale
            # handle; yield_to_kitt() reopens it next loop (and fades the layout in).
            print(f"reactive: keyboard write failed ({e}); reopening", file=sys.stderr)
            try: self.kb.close()
            except Exception: pass
            self.kb = None
            return
        self.hint_shown = hint; self.dirty = False

    def poll_state(self):
        """vim mode file + Hyprland workspace events; returns True when something changed."""
        changed = False
        try: m = os.stat(MODE_FILE).st_mtime
        except OSError: m = 0
        if m != self.mode_mtime:
            self.mode_mtime = m
            try: mode = open(MODE_FILE).read().strip()
            except OSError: mode = ""
            if mode != self.vim_mode: self.vim_mode = mode; changed = True
        if changed: self.dirty = True
        return changed

    def on_hypr_event(self, line):
        if line.startswith("workspace>>") or line.startswith("workspacev2>>"):
            name = line.split(">>", 1)[1].split(",")[-1].strip()
            try: ws = int(name)
            except ValueError: ws = None
            if ws != self.workspace: self.workspace = ws; self.dirty = True

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
        return (bool(self.fades) or (self.mods & HINT_MODS) or self.hint_shown is not None
                or self.dirty or self.wake_t0 is not None)

    def close(self):
        if self.kb is None: return
        try:
            KL.apply_frame(self.kb, self.frame, self.base)
        finally:
            self.kb.close()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--demo", action="store_true"); args = ap.parse_args()
    lights = Lights(demo=args.demo)
    stop = {"now": False}
    def on_sig(*_): stop["now"] = True
    signal.signal(signal.SIGINT, on_sig); signal.signal(signal.SIGTERM, on_sig)
    signal.signal(signal.SIGUSR1, lambda *_: lights.reload_theme(force=True))   # "re-apply the theme"
    signal.signal(signal.SIGUSR2, lambda *_: lights.start_fade_in())             # "we just woke up"

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

    import evdev, socket
    devs = []
    last_scan = 0
    hypr = None; hypr_buf = b""; last_hypr = 0
    try:
        while not stop["now"]:
            if not devs and time.monotonic() - last_scan > 10:
                devs = KL.open_inputs(); last_scan = time.monotonic()
                if not devs: print("reactive: no readable keyboard input device (udev rule installed?)", file=sys.stderr)
            if hypr is None and time.monotonic() - last_hypr > 10:
                last_hypr = time.monotonic()
                if not lights.binds: lights.load_hypr()   # Hyprland came up after us
                try:
                    hypr = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); hypr.connect(hypr_sock()); hypr.setblocking(False)
                except OSError:
                    hypr = None
            timeout = (1 / FPS) if lights.busy() else 0.25
            fds = [d.fd for d in devs] + ([hypr] if hypr else [])
            r, _, _ = select.select(fds, [], [], timeout)
            if hypr and hypr in r:
                try:
                    data = hypr.recv(4096)
                    if not data: hypr.close(); hypr = None
                    else:
                        hypr_buf += data
                        while b"\n" in hypr_buf:
                            line, hypr_buf = hypr_buf.split(b"\n", 1)
                            lights.on_hypr_event(line.decode(errors="replace"))
                except OSError:
                    hypr = None
            lights.poll_state()
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
            if lights.yield_to_kitt(): continue
            if lights.reload_theme(): continue
            if lights.busy(): lights.render()
    finally:
        lights.close()

if __name__ == "__main__":
    main()

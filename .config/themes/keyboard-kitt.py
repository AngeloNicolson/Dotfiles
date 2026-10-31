#!/usr/bin/env python3
"""Lock-screen keyboard animation for the Omen Max 16: one look per theme,
chosen by look.keyboardSleepAnimation in the theme JSON (default "kitt").
Host-rendered at ~30 fps (the keyboard's MCU has only one-way wave/swipe
effects), ~1% of a core.

  kitt   K.I.T.T. scanner: a bright bar sweeping left and right over the dim
         resting base with a fading tail (kit / Knight Rider)
  blood  blood running down a black board from a band along the top row:
         streaks creep down at random columns, stop, dry out (halloween)
  visor  a gold visor across the letter rows with a slow specular glint
         sweeping over it, on the dark green board (halo)

    keyboard-kitt.py [--anim kitt|blood|visor] [--brightness 0.3] [--theme kit]
                     [--submap locked] [--period 1.6] [--width 0.14]

Colours come from the theme's lock look (keyboard-lights.sleep_look: the
resting base is the same colour and level the layout rests on, so locking
and the wake crossfade never change the board's hue; the head/highlight is
the theme's keyboard highlight). blood uses its own reds on black — the
halloween theme sets look.keyboardSleep to black so the wake crossfade and
the entry mode start from the same black board.

Password entry: Space (or any typed key — whatever makes hyprlock's field
appear) stops the animation and lights the keypad digits in the head colour
on the resting base. Escape, or ENTRY_IDLE_S without a key, resumes it.
Entry mode is flagged in $XDG_RUNTIME_DIR/kitt.entry so hyprlock's "Press
Space to start" label can hide itself. Hyprland's "locked" submap (entered by
lock.sh) swallows Space so it never reaches hyprlock's password field; this
script still sees the press over evdev. With --submap locked (lock.sh passes
it) the script resets that submap when entry mode starts — so only the first
Space is eaten and later ones type — and re-enters it when the animation
resumes.

Ctrl-C / SIGTERM restores the static layout (keyboard-lights.py). Run it on
omen-rgb's interpreter: ~/.local/share/uv/tools/omen-rgb/bin/python.
"""
import argparse, importlib.util, json, math, os, random, select, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
ENTRY_IDLE_S = 30
ENTRY_KEYS = [f"num_{d}" for d in "0123456789"]
ENTRY_FLAG = os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "kitt.entry")
TYPING = ({"KEY_SPACE", "KEY_KPDOT"} | {f"KEY_{c}" for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}
          | {f"KEY_KP{d}" for d in "0123456789"})

spec = importlib.util.spec_from_file_location("keyboard_lights", os.path.join(HERE, "keyboard-lights.py"))
KL = importlib.util.module_from_spec(spec); spec.loader.exec_module(KL)

def hex_rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def mix(a, b, t):
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)

def smoothstep(t):
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return t * t * (3 - 2 * t)

_hypr_lua = None
def hypr_submap(name):
    """hyprctl dispatch submap NAME, in Lua or hyprlang form (see hypr-compat.sh)."""
    global _hypr_lua
    try:
        if _hypr_lua is None:
            _hypr_lua = subprocess.run(["hyprctl", "eval", "do end"], capture_output=True, text=True, timeout=3).stdout.strip() == "ok"
        args = [f'hl.dsp.submap("{name}")'] if _hypr_lua else ["submap", name]
        subprocess.run(["hyprctl", "dispatch", *args], capture_output=True, timeout=3)
    except Exception as e:
        print(f"kitt: submap {name}: {e}", file=sys.stderr)

def set_entry_flag(on):
    try:
        if on: open(ENTRY_FLAG, "w").close()
        else: os.unlink(ENTRY_FLAG)
    except OSError: pass

# ---------------------------------------------------------------- geometry
class Grid:
    """Every LED with its (x, y) in 0..1 — x across the board, y from the top
    row (0) to the bottom (1), from its key's rectangle centre — and the
    per-LED density balance keyboard-lights applies to the static layout."""
    def __init__(self, lay):
        self.lay = lay
        self.bal = KL.led_balance(lay)
        cx, cy = {}, {}
        for k in lay.keys:
            if not k.rect: continue
            for led in k.leds:
                cx[led] = k.rect[0] + k.rect[2] / 2; cy[led] = k.rect[1] + k.rect[3] / 2
        x0, x1 = min(cx.values()), max(cx.values()); y0, y1 = min(cy.values()), max(cy.values())
        self.leds = [(led, (cx[led] - x0) / (x1 - x0 or 1), (cy[led] - y0) / (y1 - y0 or 1)) for led in cx]
        # the main cluster ends where the numpad starts (a gap in x after Backspace/Enter)
        xs = sorted(set(round(x, 3) for _, x, _ in self.leds))
        gaps = [(xs[i + 1] - xs[i], xs[i]) for i in range(len(xs) - 1)]
        self.numpad_x = max(gaps)[1] + max(gaps)[0] / 2 if gaps and max(gaps)[0] > 0.05 else 1.01

# ---------------------------------------------------------------- animations
class Kitt:
    """Bright bar sweeping left/right with a fading tail (period s per sweep)."""
    def __init__(self, grid, base, head, colors, period=1.6, width=0.14):
        self.g, self.base, self.head, self.period, self.width = grid, base, head, period, width
    def frame(self, t):
        phase = (t / self.period) % 2.0            # 0..1 going right, 1..2 coming back
        pos = phase if phase < 1.0 else 2.0 - phase
        pos = 0.5 - 0.5 * math.cos(pos * math.pi)   # ease at the ends, like the car
        direction = 1 if phase < 1.0 else -1
        out = {}
        for led, x, _ in self.g.leds:
            d = (pos - x) * direction                # >0: behind the head (tail), <0: ahead
            if 0 <= d <= self.width: f = (1 - d / self.width) ** 2
            elif -0.02 <= d < 0: f = 1.0
            else: f = 0.0
            out[led] = mix(self.base, self.head, f)
        return out

class Blood:
    """Blood running down a black board. A dark red band sits along the top
    row; from it, runs start at random columns and creep down — a brighter
    head moving unevenly, pausing, leaving the streak lit behind it — until
    each stops at its own length. A run stays a while, then dries out and a
    new one starts elsewhere. Runs take the nearest key in each row (the rows
    are staggered). Everything else is off."""
    BOARD = (0, 0, 0); BAND = (120, 0, 0); STREAK = (96, 0, 0); HEAD = (235, 0, 0)
    MAX_RUNS = 5
    def __init__(self, grid, base, head, colors):
        self.g = grid
        self.rng = random.Random()
        self.cols = sorted(set(round(x, 3) for _, x, y in grid.leds if y < 0.05))
        self.row_xs = {}
        for _, x, y in grid.leds: self.row_xs.setdefault(round(y, 2), set()).add(round(x, 3))
        self.runs = []             # dicts: col (row_y -> key x), y (head), end, speed, t_next, dry_at, alpha
        self.next_spawn = 0.8
        self.last_t = 0.0
    def column(self, dx):
        """Per row, the key a run at dx passes through: the nearest within a key pitch
        (rows holding one tall key, like numpad +, are skipped by runs elsewhere)."""
        col = {}
        for ry, xs in self.row_xs.items():
            kx = min(xs, key=lambda x: abs(x - dx))
            if abs(kx - dx) <= 0.04: col[ry] = kx
        return col
    def frame(self, t):
        dt = t - self.last_t; self.last_t = t
        if t >= self.next_spawn and len(self.runs) < self.MAX_RUNS:
            dx = self.rng.choice(self.cols)
            self.runs.append({"col": self.column(dx), "y": 0.0, "end": self.rng.uniform(0.45, 1.0),
                              "speed": self.rng.uniform(0.08, 0.2), "t_next": t, "dry_at": None, "alpha": 1.0})
            self.next_spawn = t + self.rng.uniform(1.5, 4.0)
        for r in self.runs:
            if r["y"] < r["end"]:
                if t >= r["t_next"]:                                     # creep: short moves, random pauses
                    r["y"] = min(r["end"], r["y"] + r["speed"] * dt * self.rng.uniform(0.3, 2.0))
                    if self.rng.random() < 0.02: r["t_next"] = t + self.rng.uniform(0.3, 1.2)
                if r["y"] >= r["end"]: r["dry_at"] = t + self.rng.uniform(4.0, 9.0)
            elif r["dry_at"] is not None and t >= r["dry_at"]:
                r["alpha"] = max(0.0, r["alpha"] - dt / 3.0)              # dries out over 3 s
        self.runs = [r for r in self.runs if r["alpha"] > 0]
        out = {}
        for led, x, y in self.g.leds:
            if y < 0.05:
                out[led] = self.BAND; continue
            c = self.BOARD
            for r in self.runs:
                kx = r["col"].get(round(y, 2))
                if kx is None or abs(x - kx) > 0.002 or y > r["y"] + 0.02: continue
                f = (1 - min(1.0, (r["y"] - y) / 0.12)) if r["y"] < r["end"] else 0.0   # bright head while moving
                c = mix(c, mix(self.STREAK, self.HEAD, f), r["alpha"])
            out[led] = c
        return out

class Visor:
    """Master Chief's visor: a gold trapezoid over the number and letter rows
    of the main cluster — 1 to Backspace along the top, Q..}, S..quote, then
    C .. period along the bottom with a three-key notch (B N M) cut out of the
    bottom centre — brighter at the top, with a slow diagonal specular glint sweeping
    over it every few seconds. The rest rests on the base.
    (A fuller helmet front — grey brow row, dark one-key rim, silver cheek
    keys, dark space bar, centre-lit visor shading — was tried 2026-10-31 and
    looked terrible on the diodes; keep it to the visor.)"""
    SWEEP = 7.0
    # (Grid y of a row, half-width of the visor there): number row 1..Backspace
    # (not tilde), QWERTY Q..} (not Tab/backslash), home S..quote (not A/Enter),
    # ZXCV C..period (not X/slash). Interpolated between rows for tall keys.
    HW_ROWS = [(0.17, 0.38), (0.37, 0.345), (0.56, 0.27), (0.76, 0.19)]
    Y_TOP, Y_BOT = 0.17, 0.76
    EDGE = 0.03                    # softness of the slanted sides
    NOTCH_HW = 0.09                # half-width of the notch out of the bottom row: B N M (0.03 = N alone)
    def __init__(self, grid, base, head, colors):
        self.g, self.base, self.gold = grid, base, head
        self.glint = mix(head, (255, 240, 200), 0.75)
        self.xc = grid.numpad_x / 2                             # centre of the main cluster
    def half_width(self, y):
        rows = self.HW_ROWS
        if y <= rows[0][0]: return rows[0][1]
        for (y0, h0), (y1, h1) in zip(rows, rows[1:]):
            if y <= y1: return h0 + (h1 - h0) * (y - y0) / (y1 - y0)
        return rows[-1][1]
    def frame(self, t):
        p = (t % self.SWEEP) / self.SWEEP
        gx = -0.25 + 1.5 * smoothstep(p)                          # off the left edge to off the right
        out = {}
        for led, x, y in self.g.leds:
            if x >= self.g.numpad_x or not (self.Y_TOP - 0.05 <= y <= self.Y_BOT + 0.05):
                out[led] = self.base; continue
            u = (y - self.Y_TOP) / (self.Y_BOT - self.Y_TOP)        # 0 on the top row, 1 on the bottom
            hw = self.half_width(y)
            edge = smoothstep((hw - abs(x - self.xc)) / self.EDGE + 0.5)
            if u > 0.9 and abs(x - self.xc) <= self.NOTCH_HW: edge = 0.0   # notch out of the bottom centre
            if edge <= 0:
                out[led] = self.base; continue
            c = mix(self.base, self.gold, edge * (1 - 0.35 * u))     # top brighter than bottom
            d = (x + 0.18 * (y - 0.55)) - gx                        # diagonal glint line
            f = math.exp(-(d * d) / (2 * 0.045 ** 2))
            out[led] = mix(c, self.glint, 0.9 * f * edge)
        return out

ANIMS = {"kitt": Kitt, "blood": Blood, "visor": Visor}

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anim", choices=sorted(ANIMS), default=None, help="default: the theme's look.keyboardSleepAnimation, else kitt")
    ap.add_argument("--period", type=float, default=1.6, help="kitt: seconds for one left-to-right sweep")
    ap.add_argument("--width", type=float, default=0.14, help="kitt: tail length as a fraction of the keyboard")
    ap.add_argument("--brightness", type=float, default=None, help="base level (default: the theme's look.keyboardBrightness or 0.3)")
    ap.add_argument("--theme", default=None, help="theme whose layout to restore on exit (default: ~/.config/themes/.current)")
    ap.add_argument("--submap", default=None, help="Hyprland submap the locker holds (lock.sh: locked); reset on entry mode, re-entered when the animation resumes")
    args = ap.parse_args()

    from omen_rgb import OmenKeyboard

    kb = None
    for _ in range(30):   # the reactive daemon releases the keyboard within ~0.5 s
        try:
            kb = OmenKeyboard(); break
        except Exception:
            time.sleep(0.25)
    if kb is None:
        sys.exit("kitt: keyboard busy (reactive daemon did not release it)")
    grid = Grid(kb.layout)
    bal = grid.bal

    theme = args.theme
    if not theme:
        try: theme = open(os.path.expanduser("~/.config/themes/.current")).read().strip()
        except OSError: theme = "mech"
    try:
        tj = json.load(open(os.path.expanduser(f"~/.config/themes/{theme}.json")))
    except Exception as e:
        print(f"kitt: theme {theme}: {e}", file=sys.stderr); tj = {}
    base, head = KL.sleep_look(tj, args.brightness)
    colors = KL.keyboard_colors(tj) if "colors" in tj else {"kb": "#%02x%02x%02x" % head}
    name = args.anim or tj.get("look", {}).get("keyboardSleepAnimation", "kitt")
    if name not in ANIMS:
        print(f"kitt: unknown animation {name!r}, using kitt", file=sys.stderr); name = "kitt"
    anim = Kitt(grid, base, head, colors, args.period, args.width) if name == "kitt" else ANIMS[name](grid, base, head, colors)

    # LEDs lit in entry mode, and the keyboard's evdev devices to watch for typing
    entry_leds = set()
    for k in ENTRY_KEYS:
        try: entry_leds.update(kb.key_leds(k))
        except Exception: pass
    try:
        import evdev
        devs = KL.open_inputs()
    except Exception as e:
        print(f"kitt: no key events ({e}); animation only", file=sys.stderr); devs = []
    entry_at = None   # monotonic time of the last typed key; None = animation
    set_entry_flag(False)
    def enter_entry():
        set_entry_flag(True)
        if args.submap: hypr_submap("reset")      # first Space eaten; the rest type
    def leave_entry():
        set_entry_flag(False)
        if args.submap: hypr_submap(args.submap)  # Space is the start key again

    stop = {"now": False}
    def on_sig(*_): stop["now"] = True
    signal.signal(signal.SIGINT, on_sig); signal.signal(signal.SIGTERM, on_sig)

    t0 = time.monotonic()
    failures = 0
    try:
        while not stop["now"]:
          try:
              r, _, _ = select.select([d.fd for d in devs], [], [], 1 / FPS)
              now = time.monotonic()
              for d in devs:
                  if d.fd not in r: continue
                  try:
                      for ev in d.read():
                          if ev.type != evdev.ecodes.EV_KEY or ev.value != 1: continue
                          kname = evdev.ecodes.KEY.get(ev.code)
                          if isinstance(kname, list): kname = kname[0]
                          if kname == "KEY_ESC":
                              if entry_at is not None: leave_entry()
                              entry_at = None
                          elif entry_at is not None or kname in TYPING:
                              if entry_at is None: enter_entry()
                              entry_at = now
                  except OSError:
                      devs = []
              if entry_at is not None and now - entry_at > ENTRY_IDLE_S:
                  entry_at = None; leave_entry()
              if entry_at is not None:
                  frame = {led: (head if led in entry_leds else base) for led, _, _ in grid.leds}
              else:
                  frame = anim.frame(now - t0)
              for led, c in frame.items():
                  bf = bal.get(led, 1.0)
                  kb.set_led_color(led, int(c[0] * bf), int(c[1] * bf), int(c[2] * bf))
              kb.apply(persist=False)
              failures = 0
          except Exception as e:
            # The USB controller drops across suspend/resume; reopen a few times.
            failures += 1
            if failures > 10:
                print(f"kitt: giving up after repeated errors: {e}", file=sys.stderr); break
            time.sleep(1.0)
            try:
                kb.close()
            except Exception: pass
            try:
                kb = OmenKeyboard()
            except Exception: pass
    finally:
        set_entry_flag(False)
        # Leave the plain base on the board (no animation) so the reactive
        # daemon's wake crossfade starts from exactly what is showing.
        try:
            for led, bf in bal.items():
                kb.set_led_color(led, *(int(c * bf) for c in base))
            kb.apply(persist=False)
        except Exception: pass
        kb.close()
        py = sys.executable
        subprocess.run([py, os.path.join(HERE, "keyboard-lights.py"), theme], check=False)

if __name__ == "__main__":
    main()

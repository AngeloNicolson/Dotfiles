#!/usr/bin/env python3
"""K.I.T.T. scanner for the Omen Max 16 keyboard: a bright red bar sweeping left
and right over the dim Dr Pepper base, with a fading tail. Host-rendered (the
keyboard's MCU has only one-way wave/swipe effects), ~30 fps, ~1% of a core.

    keyboard-kitt.py [--period 1.6] [--width 0.14] [--brightness 0.3] [--theme 43pr]

Ctrl-C / SIGTERM restores the static layout (keyboard-lights.py). Run it on
omen-rgb's interpreter: ~/.local/share/uv/tools/omen-rgb/bin/python.
"""
import argparse, math, os, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))

def hex_rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", type=float, default=1.6, help="seconds for one left-to-right sweep")
    ap.add_argument("--width", type=float, default=0.14, help="tail length as a fraction of the keyboard")
    ap.add_argument("--brightness", type=float, default=0.3, help="base level (the scanner head is always full)")
    ap.add_argument("--theme", default=None, help="theme whose layout to restore on exit (default: ~/.config/themes/.current)")
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
    lay = kb.layout
    x0, y0, w, h = lay.bounds
    # x position (0..1) of every LED, from its key's rectangle centre
    led_x = {}
    for k in lay.keys:
        if not k.rect: continue
        cx = (k.rect[0] + k.rect[2] / 2 - x0) / w
        for led in k.leds: led_x[led] = cx

    theme = args.theme
    if not theme:
        try: theme = open(os.path.expanduser("~/.config/themes/.current")).read().strip()
        except OSError: theme = "mech"

    # Colours follow the theme's keyboard style: Dr Pepper themes scan red,
    # palette themes scan in their accent (head full, base a dim shade of it).
    try:
        tj = json.load(open(os.path.expanduser(f"~/.config/themes/{theme}.json")))
    except Exception:
        tj = {}
    style = tj.get("look", {}).get("keyboardStyle")
    colors = tj.get("colors", {})
    if style == "drpepper":
        head_hex = "#FF0C0C"; base_hex = "#C01010"; base_rel = 0.8
    elif style == "translucent":
        look = tj.get("look", {})
        base_hex = look.get("keyboardColor") or colors.get("accent", "#FF0C0C")
        head_hex = look.get("keyboardHighlight") or colors.get("green_bright", base_hex); base_rel = 0.6
    else:
        head_hex = colors.get("accent", "#FF0C0C"); base_hex = head_hex; base_rel = 0.35
    base = tuple(int(c * base_rel * args.brightness) for c in hex_rgb(base_hex))
    head = hex_rgb(head_hex)

    stop = {"now": False}
    def on_sig(*_): stop["now"] = True
    signal.signal(signal.SIGINT, on_sig); signal.signal(signal.SIGTERM, on_sig)

    t0 = time.monotonic()
    failures = 0
    try:
        while not stop["now"]:
          try:
              t = (time.monotonic() - t0) / args.period
              phase = t % 2.0                      # 0..1 going right, 1..2 coming back
              pos = phase if phase < 1.0 else 2.0 - phase
              pos = 0.5 - 0.5 * math.cos(pos * math.pi)   # ease at the ends, like the car
              direction = 1 if phase < 1.0 else -1
              for led, x in led_x.items():
                  d = (pos - x) * direction         # >0: behind the head (tail), <0: ahead
                  if 0 <= d <= args.width:
                      f = (1 - d / args.width) ** 2
                  elif -0.02 <= d < 0:
                      f = 1.0
                  else:
                      f = 0.0
                  r = int(base[0] + (head[0] - base[0]) * f)
                  g = int(base[1] + (head[1] - base[1]) * f)
                  b = int(base[2] + (head[2] - base[2]) * f)
                  kb.set_led_color(led, r, g, b)
              kb.apply(persist=False)
              failures = 0
              time.sleep(1 / 30)
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
        kb.close()
        py = sys.executable
        subprocess.run([py, os.path.join(HERE, "keyboard-lights.py"), theme], check=False)

if __name__ == "__main__":
    main()

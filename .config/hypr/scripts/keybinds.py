#!/usr/bin/env python3
"""Keybind cheat sheets, generated from the live config files.

  keybinds.py desktop [filter]      Hyprland + app-launch keys (terminal table)
  keybinds.py terminal [filter]     foot, tmux, nvim, fish keys (terminal table)
  keybinds.py rofi                  desktop keys as rofi rows (used by keybinds-menu.sh)
  keybinds.py run <index>           run the action of desktop row <index>

Nothing is hardcoded except friendly names: the lists are read from
hypr/keybindings.lua (+ custom/keybinds.lua), foot.ini, ~/.tmux.conf and the
nvim lua config every time, so they never go stale.
"""
import os
import re
import subprocess
import sys

HOME = os.path.expanduser("~")
HYPR = os.path.join(HOME, ".config/hypr")

# ── Hyprland ────────────────────────────────────────────────────────────────

KEY_NAMES = {
    "space": "Space", "comma": ",", "period": ".", "slash": "/", "grave": "`",
    "Return": "Enter", "Tab": "Tab", "escape": "Esc", "print": "Print",
    "mouse:272": "Left-drag", "mouse:273": "Right-drag",
    "mouse_down": "Scroll ↓", "mouse_up": "Scroll ↑",
    "left": "←", "right": "→", "up": "↑", "down": "↓",
    "XF86Calculator": "Calculator key", "XF86Assistant": "Assistant key",
    "XF86MonBrightnessUp": "Brightness ↑", "XF86MonBrightnessDown": "Brightness ↓",
    "XF86PowerOff": "Power button", "code:201": "Copilot key",
    "switch:on:Lid Switch": "Lid closed", "switch:off:Lid Switch": "Lid opened",
}

AGS_REQUESTS = {
    "toggle-bar": "Show / hide sidebar",
    "cycle-sidebar": "Next sidebar page",
    "cycle-sidebar-back": "Previous sidebar page",
    "toggle-periodic-table": "Periodic table",
    "toggle-displays": "Display arranger (screens + workspaces)",
    "toggle-wallpapers": "Wallpaper carousel + themes",
    "toggle-settings": "Settings window",
    "toggle-destination": "Destination menu",
    "toggle-galaxy": "Galaxy overlay",
    "toggle-bluetooth": "Bluetooth manager",
}

APP_NAMES = {
    "foot": "Terminal (foot)", "firefox": "Firefox", "nemo": "File manager (nemo)",
    "blender": "Blender", "wl-color-picker": "Colour picker",
    "hyprctl kill": "Kill a window (click it)",
}

SCRIPT_NAMES = [
    ("open_nvim_workspace", "Neovim workspace"), ("rotate_external", "Rotate external monitor"),
    ("brightnesscontrol.sh i", "Brightness up"), ("brightnesscontrol.sh d", "Brightness down"),
    ("lid_handler.sh close", "Lid closed: move workspaces / blank panel"),
    ("lid_handler.sh open", "Lid opened: restore laptop panel"),
    ("systemctl suspend", "Suspend"), ("armorpaint", "ArmorPaint"),
    ("yt-x.sh", "yt-x (YouTube in the terminal)"), ("wlogout.sh", "Power menu (logout / reboot / shutdown)"),
    ("launcher.sh", "App launcher (rofi)"), ("keybinds-menu.sh", "This keybind menu"),
]

DIRS = {"l": "left", "r": "right", "u": "up", "d": "down"}


def pretty_mods(expr: str) -> str:
    expr = expr.strip()
    expr = expr.replace("mainMod", '"SUPER"')
    parts = re.findall(r'"([^"]*)"', expr)
    mods = "".join(parts).replace(" ", "")
    if not mods:
        return ""
    names = [m for m in mods.split("+") if m]
    names = ["Right-Alt" if m == "MOD5" else m.capitalize() if m in ("SHIFT", "CTRL", "ALT") else m for m in names]
    return " + ".join(names)


def pretty_key(k: str) -> str:
    return KEY_NAMES.get(k, k.upper() if len(k) == 1 else k)


def describe(action: str, loop: str | None) -> str:
    a = action
    m = re.search(r'exec_cmd\("([^"]+)"\)', a)
    if m:
        cmd = m.group(1)
        r = re.match(r"ags request (\S+)", cmd)
        if r:
            return AGS_REQUESTS.get(r.group(1), "AGS: " + r.group(1))
        if cmd in APP_NAMES:
            return APP_NAMES[cmd]
        s = re.search(r"screenshot\.sh (\w+)", cmd)
        if s:
            return {"s": "Screenshot: snip region / window", "sf": "Screenshot: frozen-screen snip",
                    "m": "Screenshot: focused monitor", "p": "Screenshot: all monitors"}.get(s.group(1), "Screenshot")
        if "qb-overlay" in cmd:
            prof = cmd.split("qb-overlay")[-1].strip()
            return f"qutebrowser ({prof} profile)" if prof else "qutebrowser (browser overlay)"
        if "foot -e" in cmd:
            return "Terminal: " + cmd.split("foot -e", 1)[1].strip()
        for needle, text in SCRIPT_NAMES:
            if needle in cmd:
                return text
        base = os.path.basename(cmd.split()[0])
        name = re.sub(r"\.(sh|py)$", "", base).replace("_", " ").replace("-", " ")
        return name[:1].upper() + name[1:]
    m = re.search(r"toggle_special\(\s*(?:\"([^\"]+)\")?\s*\)", a)
    if m:
        return f"Toggle {m.group(1)} scratchpad" if m.group(1) else "Toggle scratchpad"
    m = re.search(r"focus\(\{\s*direction\s*=\s*\"(\w)\"", a)
    if m:
        return f"Focus window {DIRS[m.group(1)]}"
    m = re.search(r"window\.move\(\{\s*direction\s*=\s*\"(\w)\"", a)
    if m:
        return f"Move window {DIRS[m.group(1)]}"
    if "focus({ workspace = ws" in a:
        return "Go to workspace"
    if re.search(r'focus\(\{\s*workspace\s*=\s*"e\+1"', a):
        return "Next workspace"
    if re.search(r'focus\(\{\s*workspace\s*=\s*"e-1"', a):
        return "Previous workspace"
    m = re.search(r'window\.move\(\{\s*workspace\s*=\s*"special(?::(\w+))?"', a)
    if m:
        return f"Send window to {m.group(1) + ' ' if m.group(1) else ''}scratchpad"
    if "window.move({ workspace = ws" in a:
        return "Send window to workspace"
    table = [
        ("window.close()", "Close window"), ("window.pin()", "Pin window (all workspaces)"),
        ("window.fullscreen()", "Fullscreen"), ('layout("togglesplit")', "Toggle split direction"),
        ("window.drag()", "Move window"), ("window.resize()", "Resize window"),
        ("window.resize({", "Resize window"), ("toggle_floating", "Toggle floating (centred)"),
        ("cycle_blur", "Cycle blur (light / default / heavy)"), ("cycle_next()", "Cycle windows"),
        ('submap("browser")', "Browser profile chord"), ('submap("reset")', "Leave chord"),
    ]
    for needle, text in table:
        if needle in a:
            return text
    return a.strip()[:60]


def runnable(action: str) -> str | None:
    """Shell command that performs the bind, or None (loop vars / Lua functions)."""
    m = re.search(r'exec_cmd\("([^"]+)"\)', action)
    if m:
        return m.group(1)
    if "function" in action or re.search(r"\b(ws|key|delta)\b", action) or "lib." in action:
        return None
    m = re.search(r"(dsp\.[\w.]+\(.*\))", action)
    if m and "mouse" not in action:
        expr = "hl." + m.group(1)
        # strip a trailing bind() options table / closing paren of bind(...)
        depth, end = 0, 0
        for i, ch in enumerate(expr):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0 and ch == ")":
                end = i + 1
                break
        return "hyprctl dispatch " + sh_quote(expr[:end])
    return None


def sh_quote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


def hypr_binds():
    rows = []  # (section, keys, description, command)
    for path in (os.path.join(HYPR, "keybindings.lua"), os.path.join(HYPR, "custom/keybinds.lua")):
        try:
            lines = open(path).read().split("\n")
        except OSError:
            continue
        section = "Custom" if "custom" in path else "General"
        loop_vals = None
        loop_kind = None
        submap = None  # (mods, key) of the chord that enters it
        for idx, raw in enumerate(lines):
            line = raw.strip()
            h = re.match(r"--\s*──+\s*(.+?)\s*──", line)
            if h:
                section = re.sub(r"\s*\(.*\)\s*$", "", h.group(1))
                continue
            if line.startswith("--") or not line:
                continue
            m = re.match(r"for _, ws in ipairs\(\{([^}]*)\}\)", line)
            if m:
                nums = [int(x) for x in re.findall(r"\d+", m.group(1))]
                loop_vals, loop_kind = nums, "ws"
                continue
            if re.match(r"for key, delta in pairs\(", line):
                loop_kind, loop_vals = "resize", None
                continue
            if line.startswith("end") and loop_kind:
                loop_kind = loop_vals = None
                continue
            m = re.match(r'bind\("MOD5", "(\w)",\s*dsp\.submap\("(\w+)"\)\)', line)
            if m:
                submap = (m.group(2), "Right-Alt + " + m.group(1).upper())
                continue
            m = re.match(r'launch\("(\w)",\s*"([^"]+)"\)', line)
            if m and submap:
                cmd = m.group(2)
                rows.append((section, f"{submap[1]}, then {m.group(1)}", describe(f'exec_cmd("{cmd}")', None), cmd))
                continue
            m = re.match(r'bind\((.+?),\s*("([^"]*)"|tostring\(ws\)|key),\s*(.*)$', line)
            if not m or line.startswith("local function"):
                continue
            mods, key, action = m.group(1), m.group(3), m.group(4)
            if action.rstrip().endswith("function()") and idx + 1 < len(lines):
                action += " " + lines[idx + 1].strip()  # body of an inline function bind
            comment = ""
            if "--" in action:
                action, comment = action.split("--", 1)
                comment = comment.strip()
            mod_s = pretty_mods(mods)
            if loop_kind == "ws":
                keytxt = numbers_range(loop_vals)
            elif loop_kind == "resize":
                keytxt = "H J K L / arrows"
            else:
                keytxt = pretty_key(key)
            keys = f"{mod_s} + {keytxt}" if mod_s else keytxt
            desc = describe(action, loop_kind)
            if comment and not desc.startswith(("Screenshot", "Run ")) and desc not in AGS_REQUESTS.values():
                desc = f"{desc} — {comment}" if len(comment) < 50 else desc
            elif comment and desc.startswith("Run "):
                desc = comment[0].upper() + comment[1:]
            rows.append((section, keys, desc, None if loop_kind else runnable(action)))
    return rows


def numbers_range(nums):
    if not nums:
        return "N"
    out, start, prev = [], nums[0], nums[0]
    for n in nums[1:] + [None]:
        if n is not None and n == prev + 1:
            prev = n
            continue
        out.append(f"{start}–{prev}" if prev != start else str(start))
        if n is not None:
            start = prev = n
    return ", ".join(out)


# ── Terminal side ───────────────────────────────────────────────────────────

FOOT_ACTIONS = {
    "scrollback-up-page": "Scroll back a page", "scrollback-down-page": "Scroll forward a page",
    "clipboard-copy": "Copy selection", "clipboard-paste": "Paste", "search-start": "Search scrollback",
    "font-increase": "Bigger font", "font-decrease": "Smaller font", "font-reset": "Reset font size",
    "spawn-terminal": "New terminal here", "show-urls-launch": "Open a URL from the screen",
}


def foot_binds():
    rows, in_sec = [], False
    try:
        for line in open(os.path.join(HOME, ".config/foot/foot.ini")):
            line = line.strip()
            if line.startswith("["):
                in_sec = line == "[key-bindings]"
                continue
            if in_sec and "=" in line and not line.startswith("#"):
                act, keys = [x.strip() for x in line.split("=", 1)]
                keys = keys.replace("Control", "Ctrl").replace("+", " + ")
                rows.append(("foot (terminal)", keys, FOOT_ACTIONS.get(act, act)))
    except OSError:
        pass
    return rows


TMUX_CMDS = [
    (r"^source-file", "Reload tmux config"), (r"^select-pane -L", "Focus pane left"),
    (r"^select-pane -R", "Focus pane right"), (r"^select-pane -U", "Focus pane up"),
    (r"^select-pane -D", "Focus pane down"), (r"^split-window -v", "Split pane below"),
    (r"^split-window -h", "Split pane right"), (r"^new-window", "New window"),
    (r"^kill-pane", "Close pane"), (r"^resize-pane", "Resize pane"),
]


def tmux_binds():
    rows, prefix = [], "Ctrl + b"
    path = os.path.join(HOME, ".tmux.conf")
    try:
        text = open(path).read()
    except OSError:
        return rows
    m = re.search(r"^\s*set(?:-option)?\s+-g\s+prefix\s+(\S+)", text, re.M)
    if m:
        prefix = m.group(1).replace("C-", "Ctrl + ").replace("M-", "Alt + ")
    for line in text.split("\n"):
        m = re.match(r"\s*bind(?:-key)?\s+((?:-\w\s+)*)(\S+)\s+(.+)", line)
        if not m:
            continue
        flags, key, cmd = m.group(1), m.group(2), m.group(3).split("#")[0].strip()
        desc = next((d for pat, d in TMUX_CMDS if re.search(pat, cmd)), cmd)
        keys = key if "-n" in flags else f"{prefix}, {key}"
        rows.append(("tmux", keys, desc))
    rows.insert(0, ("tmux", f"{prefix}, d", "Detach (tmux default)"))
    return rows


def nvim_binds():
    rows = []
    root = os.path.join(HOME, ".config/nvim")
    leader = "Space"
    pat_set = re.compile(r"""keymap\.set\(\s*(\{[^}]*\}|["'][^"']*["'])\s*,\s*["']([^"']+)["'].*?desc\s*=\s*["']([^"']+)["']""")
    pat_lazy = re.compile(r"""^\s*\{\s*["']([^"']+)["']\s*,.*?desc\s*=\s*["']([^"']+)["']""")
    for dirpath, _, files in os.walk(root):
        for f in sorted(files):
            if not f.endswith(".lua"):
                continue
            try:
                text = open(os.path.join(dirpath, f)).read()
            except OSError:
                continue
            for line in text.split("\n"):
                m = pat_set.search(line)
                lhs = desc = None
                if m:
                    lhs, desc = m.group(2), m.group(3)
                else:
                    m = pat_lazy.search(line)
                    if m and ("<" in m.group(1) or len(m.group(1)) <= 4):
                        lhs, desc = m.group(1), m.group(2)
                if lhs:
                    k = lhs.replace("<leader>", f"{leader} ").replace("<C-", "Ctrl+").replace("<A-", "Alt+").replace("<S-", "Shift+").replace(">", "")
                    rows.append(("neovim", k.strip(), desc))
    seen, out = set(), []
    for r in rows:
        if (r[1], r[2]) not in seen:
            seen.add((r[1], r[2]))
            out.append(r)
    return out


FISH = [
    ("Ctrl + R", "Search command history"), ("→ / Ctrl + F", "Accept autosuggestion"),
    ("Alt + →", "Accept one word of the suggestion"), ("Alt + ↑ / ↓", "History search for the token under the cursor"),
    ("Tab", "Complete (Tab again for the menu)"), ("Alt + E", "Edit the command in $EDITOR"),
    ("Alt + S", "Prepend / remove sudo"), ("Alt + L", "List the current directory"),
    ("Alt + W", "What is this command?"), ("Ctrl + L", "Clear screen"),
    ("Ctrl + W", "Delete word left"), ("Ctrl + U", "Delete to line start"),
    ("Ctrl + A / E", "Line start / end"), ("Ctrl + C", "Cancel line"),
]


def terminal_binds():
    return foot_binds() + tmux_binds() + [("fish (shell)", k, d) for k, d in FISH] + nvim_binds()


# ── Output ──────────────────────────────────────────────────────────────────

def print_table(rows, flt):
    tty = sys.stdout.isatty()
    B, K, D, R = ("\033[1;37m", "\033[36m", "\033[2m", "\033[0m") if tty else ("", "", "", "")
    if flt:
        f = flt.lower()
        rows = [r for r in rows if f in (r[0] + " " + r[1] + " " + r[2]).lower()]
    width = max((len(r[1]) for r in rows), default=10) + 2
    section = None
    for r in rows:
        if r[0] != section:
            section = r[0]
            print(f"\n{B}{section.upper()}{R}")
        print(f"  {K}{r[1]:<{width}}{R}{r[2]}")
    if not rows:
        print("no keybinds match", flt)
    print(f"\n{D}(desktop: SUPER + / or `keys hypr` · terminal: `keys` · filter: `keys <word>`){R}")


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "desktop"
    arg = sys.argv[2] if len(sys.argv) > 2 else ""
    if mode == "rofi":
        for sec, keys, desc, cmd in hypr_binds():
            hint = "" if cmd else "  <span alpha='45%'>(key only)</span>"
            print(f"<b>{esc(keys)}</b>   {esc(desc)}   <span alpha='55%'>{esc(sec)}</span>{hint}")
    elif mode == "run":
        rows = hypr_binds()
        i = int(arg)
        if 0 <= i < len(rows) and rows[i][3]:
            subprocess.Popen(["sh", "-c", os.path.expandvars(rows[i][3])], start_new_session=True)
    elif mode == "terminal":
        print_table(terminal_binds(), arg)
    else:
        print_table([r[:3] for r in hypr_binds()], arg)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
hypr_compat - run Hyprland *write* commands under both config managers

Hyprland 0.55 introduced a Lua config manager (hyprland.lua) next to the
legacy hyprlang one (hyprland.conf); 0.57 drops hyprlang entirely.  The two
managers expose different hyprctl surfaces:

    legacy (hyprlang)                    lua (hyprland.lua)
    ---------------------------------    -------------------------------------------
    hyprctl dispatch workspace 3         hyprctl dispatch 'hl.dsp.focus({ workspace = 3 })'
    hyprctl keyword windowrule '...'     hyprctl eval 'hl.window_rule({ ... })'
    hyprctl --batch "dispatch a; ..."    hyprctl eval 'hl.dispatch(a)\\nhl.dispatch(b)'

Read-only queries (`hyprctl -j clients|monitors|activewindow|...`) are the
same in both modes and are NOT wrapped here.

Every helper below builds the command for the active mode from one source of
truth, so callers never hand-assemble either syntax.  Each dispatcher wrapper
comes in two flavours:

    cmd_<name>(...)  -> Cmd(legacy, lua)   pure, no side effects (for batching/tests)
    <name>(...)      -> CompletedProcess   runs it via `dispatch()`

Nothing here has third-party dependencies.  Import from a sibling script with:

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import hypr_compat as hc
"""

import subprocess
from collections import namedtuple


# ---------------------------------------------------------------------------
# Mode detection
# ---------------------------------------------------------------------------

_IS_LUA = None  # cached per process; None = not probed yet


def is_lua():
    """True if the running Hyprland uses the Lua config manager.

    Probed once with `hyprctl eval 'do end'` (a harmless empty chunk): prints
    exactly `ok` under Lua, an error under hyprlang.  Cached per process.
    """
    global _IS_LUA
    if _IS_LUA is None:
        try:
            result = subprocess.run(['hyprctl', 'eval', 'do end'],
                                    capture_output=True, text=True, check=False)
            _IS_LUA = result.stdout.strip() == 'ok'
        except Exception:
            _IS_LUA = False
    return _IS_LUA


def reset_mode_cache():
    """Forget the cached detection result (mainly for tests)."""
    global _IS_LUA
    _IS_LUA = None


# ---------------------------------------------------------------------------
# Lua literal helpers
# ---------------------------------------------------------------------------

def lua_str(s):
    """Render `s` as a double-quoted Lua string literal."""
    s = str(s)
    s = s.replace('\\', '\\\\').replace('"', '\\"')
    s = s.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
    return f'"{s}"'


def lua_val(v):
    """Render a Python value as a Lua literal.

    bool -> true/false, int/float -> bare number, list/tuple -> {a, b, ...},
    dict -> { k = v, ... } (insertion order kept), anything else -> lua_str().
    """
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (list, tuple)):
        return '{' + ', '.join(lua_val(x) for x in v) + '}'
    if isinstance(v, dict):
        return lua_table(v)
    return lua_str(v)


def lua_table(d):
    """Render a dict as a Lua table constructor: `{ k = v, k2 = v2 }`."""
    if not d:
        return '{}'
    return '{ ' + ', '.join(f'{k} = {lua_val(v)}' for k, v in d.items()) + ' }'


def _ws_val(ws):
    """Workspace selector for Lua: numeric -> bare number, else quoted string."""
    if isinstance(ws, int) and not isinstance(ws, bool):
        return repr(ws)
    s = str(ws).strip()
    if s.lstrip('-').isdigit():
        return s
    return lua_str(s)


# ---------------------------------------------------------------------------
# Low-level runners
# ---------------------------------------------------------------------------

Cmd = namedtuple('Cmd', ['legacy', 'lua'])
"""One dispatcher in both syntaxes.

legacy: str (split on whitespace) or list of argv fragments after `hyprctl dispatch`
lua:    a Lua dispatcher expression, e.g. `hl.dsp.focus({ workspace = 3 })`
"""


def _run(argv, **run_kwargs):
    """subprocess.run(['hyprctl', ...]) with capture_output=True, check=False defaults.

    Any run_kwargs override the defaults (e.g. capture_output=False to let
    hyprctl's `ok` reach the terminal, as some call sites historically did).
    """
    kwargs = {'check': False}
    if 'stdout' not in run_kwargs and 'stderr' not in run_kwargs:
        kwargs['capture_output'] = True
    kwargs.update(run_kwargs)
    return subprocess.run(argv, **kwargs)


def _legacy_parts(legacy):
    if isinstance(legacy, (list, tuple)):
        return list(legacy)
    return str(legacy).split()


def build_dispatch(legacy, lua=None):
    """argv for one dispatch in the active mode (no side effects)."""
    if isinstance(legacy, Cmd) and lua is None:
        legacy, lua = legacy
    if is_lua():
        return ['hyprctl', 'dispatch', lua]
    return ['hyprctl', 'dispatch'] + _legacy_parts(legacy)


def dispatch(legacy, lua=None, **run_kwargs):
    """Run one dispatcher: `hyprctl dispatch <legacy>` or `hyprctl dispatch '<lua>'`."""
    return _run(build_dispatch(legacy, lua), **run_kwargs)


def build_dispatch_many(cmds):
    """argv for several dispatchers issued in one hyprctl call.

    legacy: hyprctl --batch "dispatch a; dispatch b"
    lua:    hyprctl eval 'hl.dispatch(a)<newline>hl.dispatch(b)'
    """
    cmds = [c if isinstance(c, Cmd) else Cmd(*c) for c in cmds]
    if is_lua():
        chunk = '\n'.join(f'hl.dispatch({c.lua})' for c in cmds)
        return ['hyprctl', 'eval', chunk]
    batch = '; '.join('dispatch ' + ' '.join(_legacy_parts(c.legacy)) for c in cmds)
    return ['hyprctl', '--batch', batch]


def dispatch_many(cmds, **run_kwargs):
    """Run several dispatchers in one hyprctl call (see build_dispatch_many)."""
    if not cmds:
        return None
    return _run(build_dispatch_many(cmds), **run_kwargs)


def eval_lua(chunk, **run_kwargs):
    """Run an arbitrary Lua chunk (`hyprctl eval`).  Lua mode only."""
    return _run(['hyprctl', 'eval', chunk], **run_kwargs)


# ---------------------------------------------------------------------------
# Dispatcher wrappers
#   cmd_* -> Cmd(legacy, lua), pure      |   plain -> runs it
# ---------------------------------------------------------------------------

def cmd_move_to_workspace_silent(ws, address):
    return Cmd(
        f'movetoworkspacesilent {ws},address:{address}',
        f'hl.dsp.window.move({{ workspace = {_ws_val(ws)}, follow = false, window = {lua_str(f"address:{address}")} }})',
    )


def cmd_move_to_workspace(ws, address):
    return Cmd(
        f'movetoworkspace {ws},address:{address}',
        f'hl.dsp.window.move({{ workspace = {_ws_val(ws)}, follow = true, window = {lua_str(f"address:{address}")} }})',
    )


def cmd_resize_window_pixel_exact(w, h, address):
    w, h = int(w), int(h)
    return Cmd(
        f'resizewindowpixel exact {w} {h},address:{address}',
        f'hl.dsp.window.resize({{ x = {w}, y = {h}, window = {lua_str(f"address:{address}")} }})',
    )


def cmd_move_window_pixel_exact(x, y, address):
    x, y = int(x), int(y)
    return Cmd(
        f'movewindowpixel exact {x} {y},address:{address}',
        f'hl.dsp.window.move({{ x = {x}, y = {y}, window = {lua_str(f"address:{address}")} }})',
    )


def cmd_toggle_floating(address):
    return Cmd(
        f'togglefloating address:{address}',
        f'hl.dsp.window.float({{ action = "toggle", window = {lua_str(f"address:{address}")} }})',
    )


def cmd_tag_window(tag, address):
    """`tag` is passed verbatim, including its +/- prefix (e.g. '+lay_foo_ws_1_pos_0')."""
    return Cmd(
        ['tagwindow', str(tag), f'address:{address}'],
        f'hl.dsp.window.tag({{ tag = {lua_str(tag)}, window = {lua_str(f"address:{address}")} }})',
    )


def cmd_focus_workspace(ws):
    return Cmd(
        f'workspace {ws}',
        f'hl.dsp.focus({{ workspace = {_ws_val(ws)} }})',
    )


def cmd_move_cursor(x, y):
    x, y = int(x), int(y)
    return Cmd(
        ['movecursor', f'{x} {y}'],
        f'hl.dsp.cursor.move({{ x = {x}, y = {y} }})',
    )


def cmd_focus_window(selector):
    """`selector` is a window selector string: address:0x..., class:..., title:..., pid:..."""
    return Cmd(
        f'focuswindow {selector}',
        f'hl.dsp.focus({{ window = {lua_str(selector)} }})',
    )


def move_to_workspace_silent(ws, address, **kw):
    return dispatch(cmd_move_to_workspace_silent(ws, address), **kw)


def move_to_workspace(ws, address, **kw):
    return dispatch(cmd_move_to_workspace(ws, address), **kw)


def resize_window_pixel_exact(w, h, address, **kw):
    return dispatch(cmd_resize_window_pixel_exact(w, h, address), **kw)


def move_window_pixel_exact(x, y, address, **kw):
    return dispatch(cmd_move_window_pixel_exact(x, y, address), **kw)


def toggle_floating(address, **kw):
    return dispatch(cmd_toggle_floating(address), **kw)


def tag_window(tag, address, **kw):
    return dispatch(cmd_tag_window(tag, address), **kw)


def focus_workspace(ws, **kw):
    return dispatch(cmd_focus_workspace(ws), **kw)


def move_cursor(x, y, **kw):
    return dispatch(cmd_move_cursor(x, y), **kw)


def focus_window(selector, **kw):
    return dispatch(cmd_focus_window(selector), **kw)


# ---------------------------------------------------------------------------
# Rules (exec rule prefix / window rules)
#
# A "rules" dict maps window-rule effect name -> value, in the order the
# effects should be emitted:
#   {'workspace': '3 silent', 'float': True, 'size': (800, 600), 'move': (10, 20)}
# Values: True -> flag ('float'), False/None -> omitted, str/int -> 'name value',
#         list/tuple -> 'name a b'.
# ---------------------------------------------------------------------------

def _legacy_effect(name, value, flag_style):
    """One effect in legacy syntax.

    flag_style: 'bare' -> boolean effects are bare flags (`float`), as in the
                exec rule prefix `[float;workspace 3]`;
                'on'   -> boolean effects take on/off (`float on`), as in
                windowrule lines.
    """
    if value is None or value is False:
        return None
    if value is True:
        return name if flag_style == 'bare' else f'{name} on'
    if isinstance(value, (list, tuple)):
        return f'{name} ' + ' '.join(str(v) for v in value)
    return f'{name} {value}'


def legacy_rule_prefix(rules):
    """`[workspace 3 silent;float;size 800 600;move 10 20]` (empty string if no rules)."""
    parts = [p for p in (_legacy_effect(k, v, 'bare') for k, v in (rules or {}).items()) if p]
    return f'[{";".join(parts)}]' if parts else ''


def _lua_effect_val(name, value):
    if name in ('workspace', 'monitor', 'opacity'):
        return lua_str(value)  # always strings in Lua (e.g. "3 silent")
    if isinstance(value, (list, tuple)):
        return '{' + ', '.join(lua_val(v) for v in value) + '}'
    return lua_val(value)


def lua_rule_table(rules):
    """`{ workspace = "3 silent", float = true, size = {800, 600}, move = {10, 20} }`."""
    items = [(k, v) for k, v in (rules or {}).items() if v is not None and v is not False]
    if not items:
        return '{}'
    return '{ ' + ', '.join(f'{k} = {_lua_effect_val(k, v)}' for k, v in items) + ' }'


def build_exec_cmd(command, rules=None):
    """argv for `exec` in the active mode (no side effects).

    legacy: hyprctl dispatch exec '[k v;k v] cmd'
    lua:    hyprctl dispatch 'hl.dsp.exec_cmd("cmd", { k = v, ... })'
    """
    if is_lua():
        if rules:
            expr = f'hl.dsp.exec_cmd({lua_str(command)}, {lua_rule_table(rules)})'
        else:
            expr = f'hl.dsp.exec_cmd({lua_str(command)})'
        return ['hyprctl', 'dispatch', expr]
    prefix = legacy_rule_prefix(rules)
    full = f'{prefix} {command}' if prefix else command
    return ['hyprctl', 'dispatch', 'exec', full]


def exec_cmd(command, rules=None, popen=False, **kw):
    """Launch `command` through Hyprland's exec dispatcher with optional rules.

    popen=True returns a subprocess.Popen (kw go to Popen, e.g. stdout=...),
    otherwise runs to completion and returns a CompletedProcess.
    """
    argv = build_exec_cmd(command, rules)
    if popen:
        return subprocess.Popen(argv, **kw)
    return _run(argv, **kw)


def legacy_windowrule_match(match):
    """`match:title ^X$, match:workspace 3` from {'title': '^X$', 'workspace': 3}."""
    return ', '.join(f'match:{k} {v}' for k, v in match.items())


def build_window_rules(match, effects):
    """argv list(s) for hot-adding a window rule (no side effects).

    legacy: one `hyprctl keyword windowrule '<effect>, match:<f> <re>'` per effect
    lua:    one `hyprctl eval 'hl.window_rule({ match = {...}, <effects> })'`
    Returns a list of argv lists.
    """
    if is_lua():
        body = {'match': dict(match)}
        body_src = f'match = {lua_table(body["match"])}'
        eff = [f'{k} = {_lua_effect_val(k, v)}' for k, v in (effects or {}).items()
               if v is not None and v is not False]
        return [['hyprctl', 'eval', 'hl.window_rule({ ' + ', '.join([body_src] + eff) + ' })']]
    match_src = legacy_windowrule_match(match)
    argvs = []
    for k, v in (effects or {}).items():
        eff = _legacy_effect(k, v, 'on')
        if eff:
            argvs.append(['hyprctl', 'keyword', 'windowrule', f'{eff}, {match_src}'])
    return argvs


def add_window_rule(match, effects, **run_kwargs):
    """Hot-add a window rule.  See build_window_rules for the shapes.

    match:   {'title': '^regex$'} / {'class': '^x$', 'workspace': 3} / ...
    effects: {'float': True, 'size': (w, h), 'move': (x, y)} / {'workspace': 3} / ...
    Returns the list of CompletedProcess results.
    """
    return [_run(argv, **run_kwargs) for argv in build_window_rules(match, effects)]

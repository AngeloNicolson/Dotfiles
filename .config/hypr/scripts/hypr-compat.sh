#!/usr/bin/env bash
# hypr-compat.sh — source this from scripts that poke Hyprland at runtime.
#
# Hyprland 0.55+ reads a Lua config (hyprland.lua). Under Lua, `hyprctl keyword`
# no longer exists and `hyprctl dispatch` expects Lua (hl.dsp.*) syntax; the
# hyprlang (.conf) config manager — still used until 0.57 — only understands the
# old forms. These helpers pick the right one at runtime, so the same script
# works in both sessions (and keeps working if you fall back to the .conf files).
#
#   hypr_is_lua                      # 0 = Lua config manager, 1 = hyprlang
#   hypr_eval  'hl.something(...)'   # Lua only: run a chunk (no-op on hyprlang)
#   hypr_set   general:gaps_in 5     # keyword-style option set (both)
#   hypr_set   general:col.active_border 'rgb(ff0000)'
#   hypr_monitor 'NAME,MODE,POS,SCALE[,transform,T]'  # or 'NAME,disable'
#   hypr_dispatch 'legacy args' 'hl.dsp.lua_call(...)' # run whichever applies
#   hypr_lua_str "$s"                # quote a string as a Lua literal
#
# Nothing here needs jq; values are passed through untouched.

hypr_is_lua() {
    if [ -z "${_HYPR_IS_LUA:-}" ]; then
        if [ "$(hyprctl eval 'do end' 2>/dev/null)" = "ok" ]; then
            _HYPR_IS_LUA=1
        else
            _HYPR_IS_LUA=0
        fi
        export _HYPR_IS_LUA
    fi
    [ "$_HYPR_IS_LUA" = 1 ]
}

# Quote as a Lua string literal (handles backslashes, quotes, newlines).
hypr_lua_str() {
    local s=$1
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    s=${s//$'\n'/\\n}
    printf '"%s"' "$s"
}

# Numbers/booleans go through bare, everything else quoted — mirrors what the
# Lua config expects for option values (hl.config rejects "6" for an int).
hypr_lua_value() {
    case "$1" in
        ''|*[!0-9.eE+-]*)
            case "$1" in
                true|false|yes|no|on|off)
                    case "$1" in yes|on) printf 'true' ;; no|off) printf 'false' ;; *) printf '%s' "$1" ;; esac ;;
                *) hypr_lua_str "$1" ;;
            esac ;;
        *) printf '%s' "$1" ;;
    esac
}

hypr_eval() {
    hypr_is_lua || return 0
    hyprctl eval "$1" >/dev/null
}

# hypr_set SECTION:SUB:OPTION VALUE   e.g. decoration:blur:size 6, general:col.active_border rgb(..)
# Both ':' and '.' separate nesting levels (col.active_border → col = { active_border = ... }).
hypr_set() {
    local key=$1 value=$2
    if hypr_is_lua; then
        local IFS=':.' parts
        read -ra parts <<<"$key"
        local n=${#parts[@]} expr='' i
        for ((i = 0; i < n - 1; i++)); do expr+="${parts[i]} = { "; done
        expr+="${parts[n-1]} = $(hypr_lua_value "$value")"
        for ((i = 0; i < n - 1; i++)); do expr+=" }"; done
        hyprctl eval "hl.config({ $expr })" >/dev/null
    else
        hyprctl keyword "$key" "$value" >/dev/null
    fi
}

# hypr_monitor 'NAME,MODE,POSITION,SCALE[,transform,T]'   |  'NAME,disable'
hypr_monitor() {
    local spec=$1
    if ! hypr_is_lua; then
        hyprctl keyword monitor "$spec" >/dev/null
        return
    fi
    local IFS=',' f
    read -ra f <<<"$spec"
    local name="${f[0]// /}"
    if [ "${f[1]// /}" = "disable" ]; then
        hyprctl eval "hl.monitor({ output = $(hypr_lua_str "$name"), disabled = true })" >/dev/null
        return
    fi
    local mode="${f[1]// /}" pos="${f[2]// /}" scale="${f[3]// /}" extra='' i
    for ((i = 4; i < ${#f[@]}; i += 2)); do
        local k="${f[i]// /}" v="${f[i+1]// /}"
        case "$k" in
            transform|vrr|bitdepth) extra+=", $k = $v" ;;
            mirror|cm)              extra+=", $k = $(hypr_lua_str "$v")" ;;
        esac
    done
    hyprctl eval "hl.monitor({ output = $(hypr_lua_str "$name"), mode = $(hypr_lua_str "$mode"), position = $(hypr_lua_str "$pos"), scale = $(hypr_lua_value "$scale")$extra })" >/dev/null
}

# hypr_dispatch 'LEGACY ARGS' 'LUA DISPATCHER EXPRESSION'
#   hypr_dispatch 'workspace 3' 'hl.dsp.focus({ workspace = 3 })'
hypr_dispatch() {
    if hypr_is_lua; then
        hyprctl dispatch "$2" >/dev/null
    else
        # shellcheck disable=SC2086
        hyprctl dispatch $1 >/dev/null
    fi
}

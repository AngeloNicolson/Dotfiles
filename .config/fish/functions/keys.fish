function keys --description 'Keybind cheat sheet: keys [hypr] [filter]'
    # Terminal keys (foot, tmux, fish, neovim) by default; `keys hypr` for the
    # desktop/Hyprland ones (also SUPER + / as a searchable menu).
    set -l script ~/.config/hypr/scripts/keybinds.py
    set -l mode terminal
    if test "$argv[1]" = hypr -o "$argv[1]" = desktop
        set mode desktop
        set -e argv[1]
    end
    if command -q less; and isatty stdout
        python3 $script $mode $argv[1] | less -RFX
    else
        python3 $script $mode $argv[1]
    end
end

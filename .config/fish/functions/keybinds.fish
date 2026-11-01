function keybinds -d "Show keybinds for a tool"
    # Tools whose keys live in config files are read live by
    # ~/.config/hypr/scripts/keybinds.py (via `keys`); the rest are short
    # hand-written sheets under ~/.config/fish/keybinds/.
    set -l keybinds_dir ~/.config/fish/keybinds
    set -l live hypr hyprland desktop neovim nvim foot tmux
    set -l static (command ls $keybinds_dir)

    if test (count $argv) -eq 0
        echo ""
        echo "  Live (from the config files): "(string join ' ' $live)
        echo "  Sheets:                       "(string join ' ' $static)
        echo ""
        echo "  Usage: keybinds <tool>     (also: keys [hypr] [filter], SUPER + / on the desktop)"
        echo ""
        return
    end

    set -l tool $argv[1]
    switch $tool
        case hypr hyprland desktop
            keys hypr $argv[2]
            return
        case neovim nvim foot tmux
            test $tool = nvim; and set tool neovim
            keys $tool
            return
    end

    set -l file $keybinds_dir/$tool
    if not test -f $file
        echo "  No keybinds found for '$tool'"
        echo "  Live: "(string join ' ' $live)"  ·  Sheets: "(string join ' ' $static)
        return 1
    end

    cat $file | command cat
end

function keybinds -d "Show keybinds for a tool"
    set -l keybinds_dir ~/.config/fish/keybinds

    if test (count $argv) -eq 0
        echo ""
        echo "  Available: "(ls $keybinds_dir | tr '\n' ' ')
        echo ""
        echo "  Usage: keybinds <tool>"
        echo ""
        return
    end

    set -l tool $argv[1]
    set -l file $keybinds_dir/$tool

    if not test -f $file
        echo "  No keybinds found for '$tool'"
        echo "  Available: "(ls $keybinds_dir | tr '\n' ' ')
        return 1
    end

    cat $file | command cat
end

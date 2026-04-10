function fetch -d "Display Kondor logo centered with system info"
    set -l cols (tput cols)
    set -l rows (tput lines)
    set -l logo_lines (cat ~/.config/kondor-logo.txt)

    # Gather stats
    set -l os (uname -sr)
    set -l host (cat /etc/hostname)
    set -l uptime (uptime -p | sed 's/up //')
    set -l pkgs (pacman -Q 2>/dev/null | wc -l | string trim)
    set -l mem_used (free -h | awk '/Mem:/ {print $3}')
    set -l mem_total (free -h | awk '/Mem:/ {print $2}')

    set -l stats
    set -a stats ""
    set -a stats "  $os    fish    $host"
    set -a stats "󰅐  $uptime   󰏖  $pkgs pkgs   󰍛  $mem_used / $mem_total"

    set -l all_lines $logo_lines $stats
    set -l total_height (count $all_lines)

    # Vertical centering
    set -l top_pad (math -s0 "($rows - $total_height) / 2")
    for i in (seq $top_pad)
        echo
    end

    # Horizontal centering
    for line in $all_lines
        set -l line_len (string length -- "$line")
        set -l pad (math -s0 "($cols - $line_len) / 2")
        if test $pad -gt 0
            printf "%*s%s\n" $pad "" "$line"
        else
            echo "$line"
        end
    end
end

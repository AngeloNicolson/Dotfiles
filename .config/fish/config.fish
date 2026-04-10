function fish_prompt -d "Write out the prompt"
    # This shows up as USER@HOST /home/user/ >, with the directory colored
    # $USER and $hostname are set by fish, so you can just use them
    # instead of using `whoami` and `hostname`
    printf '%s@%s %s%s%s > ' $USER $hostname \
        (set_color $fish_color_cwd) (prompt_pwd) (set_color normal)
end

if status is-interactive
    # Commands to run in interactive sessions can go here
    set fish_greeting

end

starship init fish | source

# System fetch on launch
if status is-interactive; and not set -q INSIDE_EMACS; and not set -q VSCODE_INJECTION
    fastfetch
end
#if test -f ~/.cache/ags/user/generated/terminal/sequences.txt
#    cat ~/.cache/ags/user/generated/terminal/sequences.txt
#end

# Universal aliases
alias pamcan=pacman
alias ls='eza --icons'
alias la='eza --icons -a'
alias ll='eza --icons -la'
alias lt='eza --icons --tree --level=2'
alias cat='bat'
alias lg='lazygit'

# Source machine-specific configuration
if test -f ~/.config/fish/system-local.fish
    source ~/.config/fish/system-local.fish
end

set -x JAVA_HOME /opt/android-studio/jbr
set -x PATH $JAVA_HOME/bin $PATH

# Go
set -x GOPATH $HOME/.local/share/go
set -x GOBIN $HOME/.local/bin

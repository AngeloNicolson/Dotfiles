#!/bin/bash
# Dotfiles Installation Script
# Usage: ./install.sh [module ...]
# No args = full interactive install

set -e

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}==>${NC} $1"; }
success() { echo -e "${GREEN} ✓${NC} $1"; }
warn()    { echo -e "${YELLOW} !${NC} $1"; }
error()   { echo -e "${RED} ✗${NC} $1"; }

# ─── Package manager detection ───────────────────────────────────────────────

pkg_install() {
    local pkgs="$1"
    [[ -z "$pkgs" ]] && return 0

    if command -v yay &>/dev/null; then
        yay -S --needed --noconfirm $pkgs
    elif command -v paru &>/dev/null; then
        paru -S --needed --noconfirm $pkgs
    elif command -v pacman &>/dev/null; then
        sudo pacman -S --needed --noconfirm $pkgs
    else
        error "No package manager found (yay/paru/pacman)"
        return 1
    fi
}

parse_packages() {
    # Strip comments and blank lines from package files
    local file="$1"
    [[ -f "$file" ]] || return 0
    sed 's/#.*//' "$file" | tr -s ' ' | sed 's/^ *//;s/ *$//' | grep -v '^$'
}

# ─── ensure_symlink ─────────────────────────────────────────────────────────

ensure_symlink() {
    local target="$1"  # what the link points to (in dotfiles)
    local link="$2"    # where the link lives (in $HOME)

    # Already correct
    if [[ -L "$link" ]] && [[ "$(readlink "$link")" == "$target" ]]; then
        success "Already linked: $link"
        return 0
    fi

    # Wrong symlink
    if [[ -L "$link" ]]; then
        rm "$link"
        ln -s "$target" "$link"
        success "Relinked: $link"
        return 0
    fi

    # Real file/dir exists — back up
    if [[ -e "$link" ]]; then
        local backup="${link}.backup.$(date +%Y%m%d%H%M%S)"
        mv "$link" "$backup"
        warn "Backed up: $link -> $backup"
    fi

    # Ensure parent dir exists
    mkdir -p "$(dirname "$link")"
    ln -s "$target" "$link"
    success "Linked: $link -> $target"
}

# ─── Modules ─────────────────────────────────────────────────────────────────

mod_packages() {
    info "Installing packages..."

    local pkgs=""
    pkgs="$(parse_packages "$DOTFILES_DIR/packages/core.txt")"

    [[ "$OPT_NVIDIA" == "y" ]]  && pkgs="$pkgs $(parse_packages "$DOTFILES_DIR/packages/nvidia.txt")"
    [[ "$OPT_OLLAMA" == "y" ]]  && pkgs="$pkgs $(parse_packages "$DOTFILES_DIR/packages/ollama.txt")"
    [[ "$OPT_TABLET" == "y" ]]  && pkgs="$pkgs $(parse_packages "$DOTFILES_DIR/packages/tablet.txt")"
    [[ "$OPT_FIREFOX" == "y" ]] && pkgs="$pkgs $(parse_packages "$DOTFILES_DIR/packages/firefox.txt")"
    [[ "$OPT_EXTRAS" == "y" ]]  && pkgs="$pkgs $(parse_packages "$DOTFILES_DIR/packages/extras.txt")"

    # Deduplicate
    pkgs="$(echo "$pkgs" | tr ' ' '\n' | sort -u | tr '\n' ' ')"

    pkg_install "$pkgs"
    success "Packages installed"
}

mod_symlinks() {
    info "Symlinking config directories..."

    local config_dirs=(
        ags fish foot gtk-3.0 gtk-4.0 hypr nvim swappy
        systemd themes tmux-powerline wireplumber zathura
        OpenTabletDriver hyperdocs
    )

    mkdir -p "$HOME/.config"
    for dir in "${config_dirs[@]}"; do
        [[ -d "$DOTFILES_DIR/.config/$dir" ]] || continue
        ensure_symlink "$DOTFILES_DIR/.config/$dir" "$HOME/.config/$dir"
    done

    # File symlinks in .config
    info "Symlinking config files..."
    ensure_symlink "$DOTFILES_DIR/.config/starship.toml" "$HOME/.config/starship.toml"

    # .tmux.conf
    ensure_symlink "$DOTFILES_DIR/.tmux.conf" "$HOME/.tmux.conf"

    # .local/bin scripts
    info "Symlinking scripts in .local/bin..."
    mkdir -p "$HOME/.local/bin"
    if [[ -d "$DOTFILES_DIR/.local/bin" ]]; then
        for script in "$DOTFILES_DIR/.local/bin/"*; do
            [[ -f "$script" ]] || continue
            local name="$(basename "$script")"
            ensure_symlink "$script" "$HOME/.local/bin/$name"
        done
    fi
}

mod_scripts() {
    info "Making scripts executable..."

    # Hyprland scripts
    if [[ -d "$DOTFILES_DIR/.config/hypr/scripts" ]]; then
        find "$DOTFILES_DIR/.config/hypr/scripts" -type f \( -name "*.sh" -o -name "*.py" \) -exec chmod +x {} \;
        success "Hyprland scripts"
    fi

    # .local/bin
    if [[ -d "$DOTFILES_DIR/.local/bin" ]]; then
        find "$DOTFILES_DIR/.local/bin" -type f -exec chmod +x {} \;
        success ".local/bin scripts"
    fi

    # Theme scripts
    if [[ -d "$DOTFILES_DIR/.config/themes" ]]; then
        find "$DOTFILES_DIR/.config/themes" -type f -name "*.sh" -exec chmod +x {} \;
        success "Theme scripts"
    fi
}

mod_templates() {
    info "Setting up template configs..."

    local custom_dir="$DOTFILES_DIR/.config/hypr/custom"
    for example in "$custom_dir"/*.conf.example; do
        [[ -f "$example" ]] || continue
        local conf="${example%.example}"
        local name="$(basename "$conf")"
        if [[ -f "$conf" ]]; then
            success "Already exists: $name"
        else
            cp "$example" "$conf"
            success "Created: $name from template"
        fi
    done
}

mod_dirs() {
    info "Creating supplementary directories..."

    mkdir -p "$HOME/.config/pipewire/filter-chain.conf.d"
    success "PipeWire filter-chain directory"

    mkdir -p "$HOME/.config/hypr/shaders"
    success "Hyprland shaders directory"
}

mod_services() {
    info "Enabling systemd user services..."

    local services=(audio-autoswitch)
    for svc in "${services[@]}"; do
        if systemctl --user is-enabled "$svc" &>/dev/null; then
            success "Already enabled: $svc"
        else
            systemctl --user enable "$svc"
            success "Enabled: $svc"
        fi
    done
}

mod_ags() {
    info "Setting up AGS..."

    if [[ -f "$DOTFILES_DIR/.config/ags/package.json" ]]; then
        (cd "$DOTFILES_DIR/.config/ags" && npm install)
        success "AGS npm dependencies installed"
    fi

    # Clear compiled bundle to force recompile on next start
    rm -f /run/user/$(id -u)/ags.js
    success "AGS compiled bundle cleared"
}

mod_theme() {
    info "Applying default theme..."

    local theme_script="$DOTFILES_DIR/.config/themes/apply-theme.sh"
    if [[ -x "$theme_script" ]]; then
        bash "$theme_script" mech
        success "Theme 'mech' applied"
    else
        warn "Theme script not found or not executable"
    fi
}

mod_firefox() {
    info "Setting up Firefox..."

    local profile_dir
    profile_dir="$(find "$HOME/.mozilla/firefox" -maxdepth 1 -type d -name "*.default-release" 2>/dev/null | head -n 1)"

    if [[ -z "$profile_dir" ]]; then
        warn "Firefox profile not found. Run Firefox once to create a profile, then re-run: ./install.sh firefox"
        return 0
    fi

    ensure_symlink "$DOTFILES_DIR/.mozilla/firefox/chrome" "$profile_dir/chrome"
    ensure_symlink "$DOTFILES_DIR/.mozilla/firefox/user.js" "$profile_dir/user.js"
    success "Firefox customization installed"
}

mod_ollama() {
    info "Setting up Ollama..."

    if ! command -v ollama &>/dev/null; then
        warn "Ollama not installed. Run packages module first."
        return 0
    fi

    sudo systemctl enable ollama
    sudo systemctl start ollama
    success "Ollama service enabled and started"

    sleep 2
    info "Pulling qwen3-coder:30b (this may take a while)..."
    ollama pull qwen3-coder:30b
    success "AI model installed"
}

# ─── Interactive prompts ─────────────────────────────────────────────────────

ask_yn() {
    local prompt="$1" default="$2" reply
    while true; do
        read -rp "  [y/n] $prompt " reply
        reply="${reply:-$default}"
        case "$reply" in
            [Yy]) echo "y"; return ;;
            [Nn]) echo "n"; return ;;
        esac
    done
}

interactive_prompts() {
    echo ""
    echo "Dotfiles Installer"
    echo "=================="
    echo ""
    echo "Select optional components to install:"
    OPT_NVIDIA="$(ask_yn  "NVIDIA drivers (VA-API, CUDA)?" "n")"
    OPT_OLLAMA="$(ask_yn  "Ollama AI (local LLMs, ~18GB model download)?" "n")"
    OPT_TABLET="$(ask_yn  "OpenTabletDriver (Wacom tablet support)?" "n")"
    OPT_FIREFOX="$(ask_yn "Firefox (browser + custom CSS theme)?" "n")"
    OPT_EXTRAS="$(ask_yn  "Extras (kitty, ktouch, rnote)?" "n")"
    echo ""
}

# ─── Module runner ───────────────────────────────────────────────────────────

run_module() {
    local mod="$1"
    case "$mod" in
        packages)  mod_packages ;;
        symlinks)  mod_symlinks ;;
        scripts)   mod_scripts ;;
        templates) mod_templates ;;
        dirs)      mod_dirs ;;
        services)  mod_services ;;
        ags)       mod_ags ;;
        theme)     mod_theme ;;
        firefox)   mod_firefox ;;
        tablet)    info "Tablet: no extra setup needed (handled by symlinked configs)"; success "Tablet ready" ;;
        ollama)    mod_ollama ;;
        *)         error "Unknown module: $mod"; return 1 ;;
    esac
}

# ─── Main ────────────────────────────────────────────────────────────────────

# Defaults for optional selections (used when running specific modules)
OPT_NVIDIA="${OPT_NVIDIA:-n}"
OPT_OLLAMA="${OPT_OLLAMA:-n}"
OPT_TABLET="${OPT_TABLET:-n}"
OPT_FIREFOX="${OPT_FIREFOX:-n}"
OPT_EXTRAS="${OPT_EXTRAS:-n}"

if [[ $# -eq 0 ]]; then
    # Full interactive install
    interactive_prompts

    CORE_MODULES=(packages symlinks scripts templates dirs services ags theme)
    OPTIONAL_MODULES=()

    [[ "$OPT_FIREFOX" == "y" ]] && OPTIONAL_MODULES+=(firefox)
    [[ "$OPT_TABLET" == "y" ]] && OPTIONAL_MODULES+=(tablet)
    [[ "$OPT_OLLAMA" == "y" ]] && OPTIONAL_MODULES+=(ollama)

    for mod in "${CORE_MODULES[@]}" "${OPTIONAL_MODULES[@]}"; do
        echo ""
        run_module "$mod"
    done

    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Restart your session or reboot"
    [[ "$OPT_FIREFOX" == "y" ]] && echo "  2. Restart Firefox to apply custom CSS"
    echo "  - Check hyprland config at ~/.config/hypr/custom/"
else
    # Direct module invocation
    for mod in "$@"; do
        echo ""
        run_module "$mod"
    done
fi

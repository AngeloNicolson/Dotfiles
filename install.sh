#!/bin/bash
# Dotfiles Installation Script
# Usage: ./install.sh [module ...]
# No args = full interactive install

set +e

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Colors & output ───────────────────────────────────────────────────────

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "  ${BLUE}::${NC} $1"; }
success() { echo -e "  ${GREEN} ✓${NC} $1"; }
skip()    { echo -e "  ${DIM} ✓ $1${NC}"; }
warn()    { echo -e "  ${YELLOW} !${NC} $1"; }
error()   { echo -e "  ${RED} ✗${NC} $1"; }

MOD_INDEX=0
TOTAL_MODULES=0

header() {
    ((MOD_INDEX++))
    echo ""
    echo -e "  ${CYAN}${BOLD}[$MOD_INDEX/$TOTAL_MODULES]${NC} ${BOLD}$1${NC}"
    echo -e "  ${DIM}$(printf '%.0s─' $(seq 1 40))${NC}"
}

banner() {
    echo ""
    echo -e "${BOLD}  ┌─────────────────────────────────────┐${NC}"
    echo -e "${BOLD}  │${NC}       ${CYAN}${BOLD}Dotfiles Installer${NC}            ${BOLD}│${NC}"
    echo -e "${BOLD}  │${NC}  ${DIM}hyprland · ags · neovim · fish${NC}    ${BOLD}│${NC}"
    echo -e "${BOLD}  └─────────────────────────────────────┘${NC}"
    echo ""
}

# ─── Distro detection ──────────────────────────────────────────────────────

detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        case "$ID" in
            arch|endeavouros|manjaro|garuda|cachyos)
                DISTRO="arch" ;;
            ubuntu|debian|pop|linuxmint|elementary|zorin)
                DISTRO="ubuntu" ;;
            fedora|nobara|ultramarine)
                DISTRO="fedora" ;;
            opensuse*|suse)
                DISTRO="opensuse" ;;
            void)
                DISTRO="void" ;;
            *)
                DISTRO="$ID" ;;
        esac
    else
        DISTRO="unknown"
    fi

    PKG_DIR="$DOTFILES_DIR/packages/$DISTRO"
}

pkg_install() {
    local pkgs="$1"
    [[ -z "$pkgs" ]] && return 0

    local failed=""
    case "$DISTRO" in
        arch)
            # Ensure yay is functional — rebuild if broken by pacman update
            if command -v yay &>/dev/null && ! yay --version &>/dev/null; then
                warn "yay is broken (likely pacman update) — rebuilding..."
                sudo pacman -S --needed --noconfirm base-devel
                local _yay_tmp="$(mktemp -d)"
                git clone https://aur.archlinux.org/yay-bin.git "$_yay_tmp/yay-bin"
                (cd "$_yay_tmp/yay-bin" && makepkg -si --noconfirm)
                rm -rf "$_yay_tmp"
                success "yay rebuilt"
            fi

            # Split packages into repo and locked AUR
            local lockfile="$PKG_DIR/versions.lock"
            local repo_pkgs=""
            local locked_pkgs=""

            if [[ -f "$lockfile" ]]; then
                local locked_names
                locked_names="$(sed 's/#.*//' "$lockfile" | grep -v '^$' | cut -d= -f1)"

                for pkg in $pkgs; do
                    if echo "$locked_names" | grep -qx "$pkg"; then
                        locked_pkgs="$locked_pkgs $pkg"
                    else
                        repo_pkgs="$repo_pkgs $pkg"
                    fi
                done
            else
                repo_pkgs="$pkgs"
            fi

            # Install repo packages normally
            if [[ -n "$repo_pkgs" ]]; then
                if command -v yay &>/dev/null && yay --version &>/dev/null; then
                    yay -S --needed --noconfirm --overwrite '*' $repo_pkgs || failed="y"
                elif command -v paru &>/dev/null; then
                    paru -S --needed --noconfirm --overwrite '*' $repo_pkgs || failed="y"
                else
                    sudo pacman -S --needed --noconfirm --overwrite '*' $repo_pkgs || failed="y"
                fi
            fi

            # Install locked AUR packages from GitHub release
            if [[ -n "$locked_pkgs" ]]; then
                local release_url="https://github.com/AngeloNicolson/Dotfiles/releases/download/pkg-v1"
                local pkg_dir="$(mktemp -d)"

                for pkg in $locked_pkgs; do
                    local ver
                    ver="$(grep "^${pkg}=" "$lockfile" | cut -d= -f2)"
                    if [[ -z "$ver" ]]; then
                        warn "No locked version for $pkg — skipping"
                        continue
                    fi

                    # Check if already installed at correct version
                    local installed_ver
                    installed_ver="$(pacman -Q "$pkg" 2>/dev/null | awk '{print $2}')"
                    if [[ "$installed_ver" == "$ver" ]]; then
                        skip "$pkg ($ver)"
                        continue
                    fi

                    # Try to download the pre-built package
                    info "Downloading $pkg ($ver)..."
                    local found=""
                    for arch in x86_64 any; do
                        local url="${release_url}/${pkg}-${ver}-${arch}.pkg.tar.zst"
                        if curl -fsSL "$url" -o "$pkg_dir/${pkg}.pkg.tar.zst" 2>/dev/null; then
                            found="y"
                            break
                        fi
                    done

                    if [[ "$found" != "y" ]]; then
                        warn "$pkg not found in release cache — trying AUR build"
                        if command -v yay &>/dev/null; then
                            yay -S --needed --noconfirm --overwrite '*' "$pkg" || warn "Failed to install $pkg"
                        fi
                        continue
                    fi

                    sudo pacman -U --needed --noconfirm --overwrite '*' "$pkg_dir/${pkg}.pkg.tar.zst" || warn "Failed to install $pkg"
                    success "$pkg ($ver)"
                done

                rm -rf "$pkg_dir"
            fi
            ;;
        ubuntu)
            sudo apt-get update -qq
            sudo apt-get install -y $pkgs || failed="y"
            ;;
        fedora)
            sudo dnf install -y $pkgs || failed="y"
            ;;
        opensuse)
            sudo zypper install -y $pkgs || failed="y"
            ;;
        void)
            sudo xbps-install -y $pkgs || failed="y"
            ;;
        *)
            error "No package install method for distro: $DISTRO"
            return 1
            ;;
    esac

    if [[ "$failed" == "y" ]]; then
        warn "Some packages failed to install — check output above"
    fi
}

parse_packages() {
    local file="$1"
    [[ -f "$file" ]] || return 0
    sed 's/#.*//' "$file" | tr -s ' ' | sed 's/^ *//;s/ *$//' | grep -v '^$'
}

# ─── ensure_symlink ────────────────────────────────────────────────────────

ensure_symlink() {
    local target="$1"  # what the link points to (in dotfiles)
    local link="$2"    # where the link lives (in $HOME)

    # Source doesn't exist in dotfiles
    if [[ ! -e "$target" ]]; then
        warn "$(basename "$target") not found in dotfiles — skipping"
        return 1
    fi

    # Already correct
    if [[ -L "$link" ]] && [[ "$(readlink "$link")" == "$target" ]]; then
        skip "$(basename "$link")"
        return 0
    fi

    # Anything else (wrong symlink, real file/dir) — back up and replace
    if [[ -L "$link" ]] || [[ -e "$link" ]]; then
        mv "$link" "${link}.old"
        warn "Backed up: $(basename "$link") -> $(basename "$link").old"
    fi

    mkdir -p "$(dirname "$link")"
    ln -s "$target" "$link"
    success "Linked: $(basename "$link")"
}

# ─── Modules ───────────────────────────────────────────────────────────────

mod_packages() {
    header "Packages"

    if [[ ! -d "$PKG_DIR" ]]; then
        warn "No package lists for '$DISTRO' (packages/$DISTRO/ not found)"
        info "Skipping package install — create package lists to enable"
        info "See packages/arch/ for reference"
        return 0
    fi

    local pkgs=""
    pkgs="$(parse_packages "$PKG_DIR/core.txt")"

    local groups="core"
    [[ "$OPT_NVIDIA" == "y" ]]  && pkgs="$pkgs $(parse_packages "$PKG_DIR/nvidia.txt")" && groups="$groups, nvidia"
    [[ "$OPT_OLLAMA" == "y" ]]  && pkgs="$pkgs $(parse_packages "$PKG_DIR/ollama.txt")" && groups="$groups, ollama"
    [[ "$OPT_TABLET" == "y" ]]  && pkgs="$pkgs $(parse_packages "$PKG_DIR/tablet.txt")" && groups="$groups, tablet"
    [[ "$OPT_FIREFOX" == "y" ]] && pkgs="$pkgs $(parse_packages "$PKG_DIR/firefox.txt")" && groups="$groups, firefox"
    [[ "$OPT_EXTRAS" == "y" ]]  && pkgs="$pkgs $(parse_packages "$PKG_DIR/extras.txt")" && groups="$groups, extras"

    # Deduplicate
    pkgs="$(echo "$pkgs" | tr ' ' '\n' | sort -u | tr '\n' ' ')"

    if [[ "$DISTRO" == "arch" ]]; then
        # Refresh keyring to avoid signature trust issues
        info "Refreshing keyring..."
        sudo pacman -Sy --noconfirm archlinux-keyring || warn "Keyring refresh failed"
        success "Keyring up to date"

        # Find and remove installed packages that conflict with what we're about to install
        info "Checking for package conflicts..."
        local to_remove=""
        local installed
        installed="$(pacman -Qq 2>/dev/null)"

        while read -r wanted; do
            [[ -z "$wanted" ]] && continue

            # Already installed — skip
            echo "$installed" | grep -qx "$wanted" && continue

            # Check what this package provides (e.g. aylurs-gtk-shell-git provides ags)
            local provides
            provides="$(yay -Si "$wanted" 2>/dev/null | grep "Provides" | sed 's/Provides *: //' | tr ' ' '\n' | sed 's/[>=<].*//' | grep -v '^None$' || true)"

            # If it provides something that's already installed under a different name, remove the old one
            while read -r prov; do
                [[ -z "$prov" ]] && continue
                local alt
                alt="$(echo "$installed" | grep -x "$prov" || true)"
                if [[ -n "$alt" ]] && [[ "$alt" != "$wanted" ]]; then
                    to_remove="$to_remove $alt"
                fi
            done <<< "$provides"

            # Check name-based variants (-git, -nightly, -bin)
            local alt
            alt="$(echo "$installed" | grep -E "^${wanted}-(git|nightly|bin|nightly-bin)$" || true)"
            if [[ -n "$alt" ]]; then
                to_remove="$to_remove $alt"
            fi

            # Reverse: if we want foo-git but stable foo is installed
            local base="${wanted%-git}"
            base="${base%-nightly}"
            base="${base%-nightly-bin}"
            base="${base%-bin}"
            if [[ "$base" != "$wanted" ]]; then
                alt="$(echo "$installed" | grep -x "$base" || true)"
                if [[ -n "$alt" ]]; then
                    to_remove="$to_remove $alt"
                fi
            fi
        done <<< "$(echo "$pkgs" | tr ' ' '\n')"

        to_remove="$(echo "$to_remove" | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)"
        if [[ -n "$to_remove" ]]; then
            info "Removing conflicting packages..."
            for pkg in $to_remove; do
                echo -e "    ${DIM}$pkg${NC}"
            done
            sudo pacman -Rdd --noconfirm $to_remove || warn "Some packages could not be removed"
            success "Cleaned up conflicts"
        fi
    fi
    local count
    count="$(echo "$pkgs" | wc -w)"

    info "Distro: $DISTRO"
    info "Groups: $groups ($count packages)"
    pkg_install "$pkgs"
    success "$count packages installed"
}

mod_symlinks() {
    header "Symlinks"

    # Verify dotfiles source is intact
    if [[ ! -d "$DOTFILES_DIR/.config" ]]; then
        error "Dotfiles .config directory missing at: $DOTFILES_DIR/.config"
        info "The git clone may be incomplete or corrupted"
        info "Try: rm -rf $DOTFILES_DIR && git clone git@github.com:AngeloNicolson/Dotfiles.git $DOTFILES_DIR"
        return 1
    fi

    local config_dirs=(
        ags fish foot gtk-3.0 gtk-4.0 hypr mpv nvim swappy
        systemd themes tmux-powerline wireplumber zathura
        OpenTabletDriver hyperdocs
    )

    info "Config directories"
    mkdir -p "$HOME/.config"
    for dir in "${config_dirs[@]}"; do
        if [[ ! -d "$DOTFILES_DIR/.config/$dir" ]]; then
            warn "$dir not found in dotfiles — skipping"
            continue
        fi
        ensure_symlink "$DOTFILES_DIR/.config/$dir" "$HOME/.config/$dir"
    done

    info "Config files"
    ensure_symlink "$DOTFILES_DIR/.config/starship.toml" "$HOME/.config/starship.toml"
    ensure_symlink "$DOTFILES_DIR/.tmux.conf" "$HOME/.tmux.conf"

    info "Scripts (.local/bin)"
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
    header "Permissions"

    if [[ -d "$DOTFILES_DIR/.config/hypr/scripts" ]]; then
        find "$DOTFILES_DIR/.config/hypr/scripts" -type f \( -name "*.sh" -o -name "*.py" \) -exec chmod +x {} \;
        success "Hyprland scripts"
    fi

    if [[ -d "$DOTFILES_DIR/.local/bin" ]]; then
        find "$DOTFILES_DIR/.local/bin" -type f -exec chmod +x {} \;
        success ".local/bin scripts"
    fi

    if [[ -d "$DOTFILES_DIR/.config/themes" ]]; then
        find "$DOTFILES_DIR/.config/themes" -type f -name "*.sh" -exec chmod +x {} \;
        success "Theme scripts"
    fi
}

mod_templates() {
    header "Templates"

    local custom_dir="$DOTFILES_DIR/.config/hypr/custom"
    for example in "$custom_dir"/*.conf.example; do
        [[ -f "$example" ]] || continue
        local conf="${example%.example}"
        local name="$(basename "$conf")"
        if [[ -f "$conf" ]]; then
            skip "$name"
        else
            cp "$example" "$conf"
            success "Created: $name"
        fi
    done

    # Fish system-local
    local fish_local="$DOTFILES_DIR/.config/fish/system-local.fish"
    local fish_example="$DOTFILES_DIR/.config/fish/system-local.fish.example"
    if [[ -f "$fish_example" ]]; then
        if [[ -f "$fish_local" ]]; then
            skip "system-local.fish"
        else
            cp "$fish_example" "$fish_local"
            success "Created: system-local.fish"
        fi
    fi
}

mod_dirs() {
    header "Directories"

    mkdir -p "$HOME/.config/pipewire/filter-chain.conf.d"
    success "PipeWire filter-chain"

    mkdir -p "$HOME/.config/hypr/shaders"
    success "Hyprland shaders"
}

mod_services() {
    header "Services"

    local services=(audio-autoswitch)
    for svc in "${services[@]}"; do
        if systemctl --user is-enabled "$svc" &>/dev/null; then
            skip "$svc"
        else
            systemctl --user enable "$svc"
            success "Enabled: $svc"
        fi
    done
}

mod_ags() {
    header "AGS"

    if [[ -f "$DOTFILES_DIR/.config/ags/package.json" ]]; then
        (cd "$DOTFILES_DIR/.config/ags" && npm install --silent 2>&1)
        success "Dependencies installed"

        # Apply gjs dbus compatibility patch if gjs >= 1.88
        local gjs_ver
        gjs_ver="$(gjs --version 2>/dev/null | grep -oP '[\d.]+')"
        local patch_file="$DOTFILES_DIR/.config/ags/gnim-dbus-fix.patch"
        if [[ -f "$patch_file" ]] && [[ "$(printf '%s\n' "1.88" "$gjs_ver" | sort -V | head -1)" == "1.88" ]]; then
            info "gjs $gjs_ver detected — applying dbus compatibility patch..."
            (cd "$DOTFILES_DIR/.config/ags" && patch -Np1 --forward -i "$patch_file" 2>/dev/null) && success "gnim patch applied" || skip "gnim patch already applied"
        fi
    fi

    rm -f /run/user/$(id -u)/ags.js
    success "Compiled bundle cleared"
}

mod_theme() {
    header "Theme"

    local theme_script="$DOTFILES_DIR/.config/themes/apply-theme.sh"
    if [[ -x "$theme_script" ]]; then
        bash "$theme_script" mech
        success "Applied: mech"
    else
        warn "Theme script not found or not executable"
    fi
}

mod_firefox() {
    header "Firefox"

    local profile_dir
    profile_dir="$(find "$HOME/.mozilla/firefox" -maxdepth 1 -type d -name "*.default-release" 2>/dev/null | head -n 1)"

    if [[ -z "$profile_dir" ]]; then
        warn "No Firefox profile found"
        info "Run Firefox once, then re-run: ./install.sh firefox"
        return 0
    fi

    ensure_symlink "$DOTFILES_DIR/.mozilla/firefox/chrome" "$profile_dir/chrome"
    ensure_symlink "$DOTFILES_DIR/.mozilla/firefox/user.js" "$profile_dir/user.js"
    success "Firefox theme installed"
}

mod_ollama() {
    header "Ollama"

    if ! command -v ollama &>/dev/null; then
        warn "Ollama not installed — run packages module first"
        return 0
    fi

    sudo systemctl enable ollama
    sudo systemctl start ollama
    success "Service enabled"

    sleep 2
    info "Pulling qwen3-coder:30b (this may take a while)..."
    ollama pull qwen3-coder:30b
    success "Model installed"
}

mod_lock() {
    header "Lock Versions"

    local lockfile="$PKG_DIR/versions.lock"
    local pkg_list="$PKG_DIR/core.txt"

    if [[ ! -f "$pkg_list" ]]; then
        error "No package list found"
        return 1
    fi

    info "Scanning installed AUR packages..."
    local aur_installed
    aur_installed="$(pacman -Qm)"

    echo "# Locked AUR package versions — generated from working system" > "$lockfile"
    echo "# Format: package=version" >> "$lockfile"
    echo "# Update by running: ./install.sh lock" >> "$lockfile"

    local count=0
    while read -r pkg; do
        [[ -z "$pkg" ]] && continue
        local ver
        ver="$(echo "$aur_installed" | awk -v p="$pkg" '$1 == p {print $2}')"
        if [[ -n "$ver" ]]; then
            echo "$pkg=$ver" >> "$lockfile"
            success "$pkg=$ver"
            ((count++))
        fi
    done <<< "$(sed 's/#.*//' "$pkg_list" | tr -s ' ' | sed 's/^ *//;s/ *$//' | grep -v '^$')"

    success "Locked $count AUR packages"
    info "Lockfile: $lockfile"
    info "Run 'gh release upload pkg-v1 ~/.cache/yay/*/\*.pkg.tar.zst' to update cached packages"
}

# ─── Interactive prompts ───────────────────────────────────────────────────

ask_yn() {
    local prompt="$1" default="$2" reply
    while true; do
        read -rp "    $prompt [y/n] " reply
        reply="${reply:-$default}"
        case "$reply" in
            [Yy]) echo "y"; return ;;
            [Nn]) echo "n"; return ;;
        esac
    done
}

interactive_prompts() {
    echo -e "  ${BOLD}Optional components:${NC}"
    echo ""
    OPT_NVIDIA="$(ask_yn  "NVIDIA drivers (VA-API, CUDA)?" "n")"
    OPT_OLLAMA="$(ask_yn  "Ollama (local LLMs, ~18GB download)?" "n")"
    OPT_TABLET="$(ask_yn  "OpenTabletDriver (Wacom tablet)?" "n")"
    OPT_FIREFOX="$(ask_yn "Firefox (browser + custom CSS)?" "n")"
    OPT_EXTRAS="$(ask_yn  "Extras (kitty, ktouch, rnote)?" "n")"
}

# ─── Module runner ─────────────────────────────────────────────────────────

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
        tablet)    header "Tablet"; skip "Handled by symlinked configs" ;;
        ollama)    mod_ollama ;;
        lock)      mod_lock ;;
        *)         error "Unknown module: $mod"; return 1 ;;
    esac
    local status=$?
    if [[ $status -ne 0 ]]; then
        error "Module '$mod' failed (exit $status)"
        warn "Continuing with remaining modules..."
    fi
}

# ─── Summary ───────────────────────────────────────────────────────────────

print_summary() {
    echo ""
    echo -e "  ${GREEN}${BOLD}Installation complete.${NC}"
    echo ""
    echo -e "  ${BOLD}Next steps:${NC}"
    echo -e "  ${DIM}1.${NC} Start Hyprland:"
    echo -e "     From TTY: ${CYAN}start-hyprland${NC}"
    echo -e "     From display manager: select ${CYAN}Hyprland${NC} from session list"
    echo -e "  ${DIM}2.${NC} Edit machine-specific configs:"
    echo -e "     ${DIM}~/.config/hypr/custom/*.conf${NC}"
    echo -e "     ${DIM}~/.config/fish/system-local.fish${NC}"
    [[ "$OPT_FIREFOX" == "y" ]] && echo -e "  ${DIM}3.${NC} Restart Firefox to apply custom CSS"
    echo ""
}

# ─── Main ──────────────────────────────────────────────────────────────────

detect_distro

OPT_NVIDIA="${OPT_NVIDIA:-n}"
OPT_OLLAMA="${OPT_OLLAMA:-n}"
OPT_TABLET="${OPT_TABLET:-n}"
OPT_FIREFOX="${OPT_FIREFOX:-n}"
OPT_EXTRAS="${OPT_EXTRAS:-n}"

if [[ $# -eq 0 ]]; then
    banner
    info "Detected distro: ${BOLD}$DISTRO${NC}"
    echo ""
    interactive_prompts

    CORE_MODULES=(packages symlinks scripts templates dirs services ags theme)
    OPTIONAL_MODULES=()

    [[ "$OPT_FIREFOX" == "y" ]] && OPTIONAL_MODULES+=(firefox)
    [[ "$OPT_TABLET" == "y" ]] && OPTIONAL_MODULES+=(tablet)
    [[ "$OPT_OLLAMA" == "y" ]] && OPTIONAL_MODULES+=(ollama)

    ALL_MODULES=("${CORE_MODULES[@]}" "${OPTIONAL_MODULES[@]}")
    TOTAL_MODULES=${#ALL_MODULES[@]}

    for mod in "${ALL_MODULES[@]}"; do
        run_module "$mod"
    done

    print_summary
else
    TOTAL_MODULES=$#
    for mod in "$@"; do
        run_module "$mod"
    done
    echo ""
fi

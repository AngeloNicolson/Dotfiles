#!/bin/bash
# Dotfiles Installation Script
# Usage: ./install.sh [--dry-run] [--yes] [module ...]
#   no module    = full interactive install
#   --dry-run    = print what would change, touch nothing
#   --yes / -y   = non-interactive (optional components default to "no" unless
#                  OPT_NVIDIA=y etc. are set in the environment)
#   doctor       = check this machine against what the config expects
#   update       = git pull, then re-run only the modules whose inputs changed
# Modules: packages symlinks scripts templates dirs services omen ags theme nvim
#          tmux shell wallpapers hostconfig update firefox ollama doctor lock

set +e

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN="${DRY_RUN:-0}"
ASSUME_YES="${ASSUME_YES:-0}"

# Minimum versions the tracked config relies on (syntax/protocol features).
#   hyprland  0.55  match:class windowrule syntax, ext-background-effect blur
#   foot      1.27  built-in blur (ext-background-effect) + include support
declare -A MIN_VERSIONS=( [hyprland]=0.55.0 [foot]=1.27.0 )

# Run a mutating command, or just print it under --dry-run.
run() {
    if [[ "$DRY_RUN" == "1" ]]; then
        echo -e "  \033[2m(dry-run) $*\033[0m"
        return 0
    fi
    "$@"
}

# true if $1 >= $2 (dotted versions)
version_ge() { [[ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" == "$2" ]]; }

# ─── Components ────────────────────────────────────────────────────────────
# Everything beyond the required core is a component the setup screen asks
# about. Each has a package list packages/<distro>/<id>.txt (if it installs
# anything) and may gate installer modules / doctor checks.
#   id | default | one-line description shown in the prompt
COMPONENTS=(
    "themes|y|Themed look: adw-gtk3 GTK theme + Bibata cursor (the config is written for these)"
    "idle|y|Idle management: lock + dim after 7 min, screen off after 77 min (hypridle)"
    "lockscreen|n|Lock screen: hyprlock on lid-close / power key (skip if you never lock)"
    "neovim|y|Neovim: editor with LSP/Treesitter, plugins pinned by lazy-lock.json"
    "tmux|y|Tmux: multiplexer with powerline + tpm plugins"
    "zathura|y|Zathura: PDF viewer"
    "media|y|Media: mpv, live video wallpapers (mpvpaper), cava visualiser, pavucontrol"
    "display|y|Display controls: colour temperature/gamma (wl-gammarelay), shaders (hyprshade)"
    "wallpapers|n|Wallpaper pack: download ~2 GB of images/videos from the GitHub release"
    "clojure|n|Clojure toolchain: JDK, clojure, babashka, clojure-lsp"
    "gpu-debug|n|GPU & JVM debugging: Nsight Compute/Systems, perf+hotspot, heaptrack, async-profiler, tracy, visualvm"
    "tablet|n|OpenTabletDriver: Wacom tablet support"
    "nvidia|n|NVIDIA: VA-API driver (libva-nvidia-driver)"
    "firefox|n|Firefox: browser + custom CSS / Sidebery theme"
    "zen|y|Zen Browser: Firefox-based browser with vertical tabs + workspaces (AUR)"
    "ntfs|n|NTFS: mount Windows drives (ntfs-3g)"
    "ollama|n|Ollama: enable the service + pull the model (ollama itself is a manual install, see packages/arch/ollama.txt)"
)
REQUIRED_SUMMARY="Hyprland, AGS shell, foot + fish, fonts, PipeWire, wallpaper daemon, notifications, launcher/power menu, screenshot/clipboard/brightness tools"

# Machine profiles: hardware-specific pieces that are REQUIRED on that machine
# and meaningless anywhere else. Asked first on the setup screen (the default
# comes from auto-detection), saved to install.conf next to the components,
# OPT_<ID>=y|n overrides like a component.
#   id | question shown in the prompt
MACHINES=(
    "omen-max-16|Is this an HP Omen Max 16? Adds (required): per-key keyboard RGB stack, the EC keyboard-backlight switch (board is dark after boot/lid-open without it), keyboard USB autosuspend fix"
)
machine_ids()  { local m; for m in "${MACHINES[@]}"; do echo "${m%%|*}"; done; }
machine_desc() { local m; for m in "${MACHINES[@]}"; do [[ "${m%%|*}" == "$1" ]] && { echo "${m#*|}"; return; }; done; }
# Auto-detection (true = this machine). Omen Max 16: DMI board 8D41 / "OMEN MAX"
# product name, or its HP Gaming Keyboard II (USB 0d62:54bf) present.
detect_machine() {
    case "$1" in
        omen-max-16)
            grep -qs '^8D41$' /sys/class/dmi/id/board_name && return 0
            grep -qsi 'OMEN MAX' /sys/class/dmi/id/product_name && return 0
            local d
            for d in /sys/bus/usb/devices/*/; do
                [[ "$(cat "$d/idVendor" 2>/dev/null)" == "0d62" && "$(cat "$d/idProduct" 2>/dev/null)" == "54bf" ]] && return 0
            done
            return 1 ;;
    esac
    return 1
}
is_omen() { [[ "${CHOICE[omen-max-16]:-n}" == "y" ]]; }
CHOICES_FILE="$DOTFILES_DIR/install.conf"   # gitignored, per machine
declare -A CHOICE

comp_ids()     { local c; for c in "${COMPONENTS[@]}"; do echo "${c%%|*}"; done; }
comp_default() { local c; for c in "${COMPONENTS[@]}"; do [[ "${c%%|*}" == "$1" ]] && { c="${c#*|}"; echo "${c%%|*}"; return; }; done; echo n; }
comp_desc()    { local c; for c in "${COMPONENTS[@]}"; do [[ "${c%%|*}" == "$1" ]] && { echo "${c##*|}"; return; }; done; }
chosen()       { [[ "${CHOICE[$1]:-n}" == "y" ]]; }

# Precedence: OPT_<ID>=y|n in the environment > saved install.conf > default.
load_choices() {
    local id val
    for id in $(comp_ids); do CHOICE[$id]="$(comp_default "$id")"; done
    for id in $(machine_ids); do detect_machine "$id" && CHOICE[$id]=y || CHOICE[$id]=n; done
    if [[ -f "$CHOICES_FILE" ]]; then
        while IFS='=' read -r id val; do
            [[ -z "$id" || "$id" == \#* ]] && continue
            [[ -n "${CHOICE[$id]+x}" ]] && CHOICE[$id]="$val"
        done < "$CHOICES_FILE"
    fi
    for id in $(machine_ids) $(comp_ids); do
        local envvar="OPT_${id^^}"; envvar="${envvar//-/_}"   # gpu-debug -> OPT_GPU_DEBUG
        [[ -n "${!envvar:-}" ]] && CHOICE[$id]="${!envvar}"
    done
}

save_choices() {
    [[ "$DRY_RUN" == "1" ]] && return 0
    {
        echo "# Component choices for this machine — written by ./install.sh, read by"
        echo "# every later run (packages, doctor, wallpapers...). Edit or delete to re-ask."
        echo "# machine profiles (hardware-specific, required when y):"
        local id; for id in $(machine_ids); do echo "$id=${CHOICE[$id]}"; done
        echo "# optional components:"
        for id in $(comp_ids); do echo "$id=${CHOICE[$id]}"; done
    } > "$CHOICES_FILE"
}

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
    echo -e "  ${YELLOW}${BOLD}NOTE:${NC} This script is designed for a ${BOLD}fresh Arch install${NC}."
    echo -e "  ${DIM}Running on a system with an existing rice/DE may cause${NC}"
    echo -e "  ${DIM}package conflicts that cannot be automatically resolved.${NC}"
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
            # Ensure yay exists and is functional
            if ! command -v yay &>/dev/null || ! yay --version &>/dev/null; then
                info "Installing yay..."
                sudo pacman -S --needed --noconfirm base-devel curl
                local _yay_tmp="$(mktemp -d)"
                git clone https://aur.archlinux.org/yay-bin.git "$_yay_tmp/yay-bin"
                (cd "$_yay_tmp/yay-bin" && makepkg -si --noconfirm)
                rm -rf "$_yay_tmp"
                success "yay installed"
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
                info "Installing repo packages..."
                if command -v yay &>/dev/null && yay --version &>/dev/null; then
                    yay -S --needed --noconfirm --overwrite '*' $repo_pkgs || failed="y"
                elif command -v paru &>/dev/null; then
                    paru -S --needed --noconfirm --overwrite '*' $repo_pkgs || failed="y"
                else
                    sudo pacman -S --needed --noconfirm --overwrite '*' $repo_pkgs || failed="y"
                fi

                if [[ "$failed" == "y" ]]; then
                    error "Repo package install failed — checking what's missing..."
                    for pkg in $repo_pkgs; do
                        if ! pacman -Qq "$pkg" &>/dev/null; then
                            error "  MISSING: $pkg"
                        fi
                    done
                else
                    success "Repo packages installed"
                fi
            fi

            # Install locked AUR packages from GitHub release
            if [[ -n "$locked_pkgs" ]]; then
                info "Installing locked AUR packages from cache..."
                local release_url="https://github.com/AngeloNicolson/Dotfiles/releases/download/pkg-v1"
                local pkg_dir="$(mktemp -d)"

                # Get list of all available packages in the release
                local asset_list
                asset_list="$(curl -fsSL "https://api.github.com/repos/AngeloNicolson/Dotfiles/releases/tags/pkg-v1" 2>/dev/null | grep '"name"' | sed 's/.*"name": "//;s/".*//' | grep '.pkg.tar.zst$')"

                # Download all available packages
                local downloaded=0
                while read -r asset; do
                    [[ -z "$asset" ]] && continue
                    # Skip debug packages
                    echo "$asset" | grep -q "\-debug-" && continue
                    info "Downloading $asset..."
                    curl -fsSL "${release_url}/${asset}" -o "$pkg_dir/${asset}" || { warn "Failed to download $asset"; continue; }
                    ((downloaded++))
                done <<< "$asset_list"

                if [[ $downloaded -gt 0 ]]; then
                    info "Installing $downloaded cached packages..."
                    sudo pacman -U --noconfirm --overwrite '*' "$pkg_dir"/*.pkg.tar.zst || warn "Some cached packages failed to install"
                    success "Cached AUR packages installed"
                else
                    warn "No packages downloaded from cache — falling back to AUR build"
                    for pkg in $locked_pkgs; do
                        if command -v yay &>/dev/null; then
                            yay -S --needed --noconfirm --overwrite '*' "$pkg" || warn "Failed to install $pkg"
                        fi
                    done
                fi

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
        run mv "$link" "${link}.old"
        warn "Backed up: $(basename "$link") -> $(basename "$link").old"
    fi

    run mkdir -p "$(dirname "$link")"
    run ln -s "$target" "$link"
    success "Linked: $(basename "$link")"
}

# ─── template_drift ────────────────────────────────────────────────────────
# Per-machine files are copied from a .example once and never touched again.
# When the template later changes in git (a pull brought a new option), say so
# instead of silently leaving the copy behind; the owner merges by hand.

template_drift() {
    local example="$1" conf="$2" ex_ts conf_ts
    ex_ts="$(git -C "$DOTFILES_DIR" log -1 --format=%ct -- "$example" 2>/dev/null)"
    conf_ts="$(stat -c %Y "$conf" 2>/dev/null)"
    [[ -n "$ex_ts" && -n "$conf_ts" ]] || return 0
    if (( ex_ts > conf_ts )); then
        warn "$(basename "$example") changed after $(basename "$conf") was made from it (kept as is) — review: diff $conf $example"
    fi
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

    local groups="core" id
    for id in $(machine_ids); do
        [[ "${CHOICE[$id]:-n}" == "y" && -f "$PKG_DIR/$id.txt" ]] || continue
        pkgs="$pkgs $(parse_packages "$PKG_DIR/$id.txt")"
        groups="$groups, $id"
    done
    for id in $(comp_ids); do
        chosen "$id" || continue
        [[ -f "$PKG_DIR/$id.txt" ]] || continue   # component with no packages (e.g. wallpapers)
        pkgs="$pkgs $(parse_packages "$PKG_DIR/$id.txt")"
        groups="$groups, $id"
    done

    # Deduplicate
    pkgs="$(echo "$pkgs" | tr ' ' '\n' | sort -u | tr '\n' ' ')"

    if [[ "$DISTRO" == "arch" ]]; then
        # Refresh keyring to avoid signature trust issues
        info "Refreshing keyring..."
        run sudo pacman -Sy --noconfirm archlinux-keyring || warn "Keyring refresh failed"
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
            run sudo pacman -Rdd --noconfirm $to_remove || warn "Some packages could not be removed"
            success "Cleaned up conflicts"
        fi
    fi
    local count
    count="$(echo "$pkgs" | wc -w)"

    info "Distro: $DISTRO"
    info "Groups: $groups ($count packages)"
    if [[ "$DRY_RUN" == "1" ]]; then
        info "(dry-run) would install: $pkgs"
        return 0
    fi
    pkg_install "$pkgs"

    # Final check — report any packages that are still missing
    local missing=""
    for pkg in $pkgs; do
        if ! pacman -Qq "$pkg" &>/dev/null; then
            missing="$missing $pkg"
        fi
    done
    if [[ -n "$missing" ]]; then
        error "The following packages failed to install:"
        for pkg in $missing; do
            error "  $pkg"
        done
        warn "These must be resolved before continuing"
    else
        success "All $count packages installed"
    fi
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
        hyperdocs OpenTabletDriver
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
        run find "$DOTFILES_DIR/.config/hypr/scripts" -type f \( -name "*.sh" -o -name "*.py" \) -exec chmod +x {} \;
        success "Hyprland scripts"
    fi

    if [[ -d "$DOTFILES_DIR/.local/bin" ]]; then
        run find "$DOTFILES_DIR/.local/bin" -type f -exec chmod +x {} \;
        success ".local/bin scripts"
    fi

    if [[ -d "$DOTFILES_DIR/.config/themes" ]]; then
        run find "$DOTFILES_DIR/.config/themes" -type f -name "*.sh" -exec chmod +x {} \;
        success "Theme scripts"
    fi
}

mod_templates() {
    header "Templates"

    # Hyprland ≥ 0.55 reads hyprland.lua; per-machine files are custom/*.lua.
    # A hyprland.conf next to it is a leftover (pre-Lua install, or autogenerated by
    # an old Hyprland that found no .conf). 0.55/0.56 warn about it, 0.57 ignores
    # it; either way it is not ours — move it aside so the Lua config is the only one.
    local hypr_dir="$DOTFILES_DIR/.config/hypr"
    if [[ -f "$hypr_dir/hyprland.lua" && -f "$hypr_dir/hyprland.conf" ]]; then
        run mv "$hypr_dir/hyprland.conf" "$hypr_dir/hyprland.conf.old"
        warn "Stale hyprland.conf found beside hyprland.lua — moved to hyprland.conf.old (the Lua config is the only one read from Hyprland 0.57)"
    fi
    local custom_dir="$DOTFILES_DIR/.config/hypr/custom"
    for example in "$custom_dir"/*.lua.example; do
        [[ -f "$example" ]] || continue
        local conf="${example%.example}"
        local name="$(basename "$conf")"
        if [[ -f "$conf" ]]; then
            skip "$name"
            template_drift "$example" "$conf"
        else
            run cp "$example" "$conf"
            success "Created: $name"
        fi
    done

    # Single-file templates (@HOME@ in the .example is substituted):
    #   fish system-local, foot host overrides (foot refuses to start without
    #   host.ini since it is `include`d), swappy config (the app rewrites it).
    local pair
    for pair in \
        "$DOTFILES_DIR/.config/fish/system-local.fish" \
        "$DOTFILES_DIR/.config/foot/host.ini" \
        "$DOTFILES_DIR/.config/swappy/config"; do
        local example="$pair.example"
        [[ -f "$example" ]] || continue
        if [[ -f "$pair" ]]; then
            skip "$(basename "$(dirname "$pair")")/$(basename "$pair")"
            template_drift "$example" "$pair"
        elif [[ "$DRY_RUN" == "1" ]]; then
            echo -e "  ${DIM}(dry-run) create $pair from template${NC}"
        else
            sed "s|@HOME@|$HOME|g" "$example" > "$pair"
            success "Created: $(basename "$(dirname "$pair")")/$(basename "$pair")"
        fi
    done
}

mod_dirs() {
    header "Directories"

    run mkdir -p "$HOME/.config/pipewire/filter-chain.conf.d"
    success "PipeWire filter-chain"

    run mkdir -p "$HOME/.config/hypr/shaders"
    success "Hyprland shaders"

    # XDG state dir used by AGS (ui-state.json, display-eq.json) — machine-local
    run mkdir -p "${XDG_STATE_HOME:-$HOME/.local/state}/ags"
    success "AGS state dir"
}

mod_services() {
    header "Services"

    if ! systemctl --user show-environment &>/dev/null; then
        warn "No user systemd session (container/TTY?) — skipping"
        return 0
    fi

    # Explicit list — NOT every unit in .config/systemd/user. A unit that is
    # shipped but left out here stays opt-in (enable it by hand).
    #   bluetooth-autoconnect.service  reconnect trusted BT devices at login
    #   monolith-reindex.timer         nightly retrieval-index rebuild (needs monolith-tui)
    #   keyboard-reactive.service      Omen Max 16 only (machine profile)
    local -a units=(bluetooth-autoconnect.service monolith-reindex.timer)
    is_omen && units+=(keyboard-reactive.service)
    local svc
    for svc in "${units[@]}"; do
        if [[ ! -f "$DOTFILES_DIR/.config/systemd/user/$svc" ]]; then
            warn "$svc not in repo — skipping"
            continue
        fi
        if systemctl --user is-enabled "$svc" &>/dev/null; then
            skip "$svc"
        else
            run systemctl --user enable "$svc" && success "Enabled: $svc"
        fi
    done
}

mod_ags() {
    header "AGS"

    if [[ -f "$DOTFILES_DIR/.config/ags/package.json" ]]; then
        if ! command -v npm &>/dev/null; then
            warn "npm not found — install nodejs/npm, then re-run: ./install.sh ags"
            return 0
        fi
        if [[ "$DRY_RUN" == "1" ]]; then
            info "(dry-run) would run npm install in .config/ags"
        else
            (cd "$DOTFILES_DIR/.config/ags" && npm install --silent 2>&1)
            success "Dependencies installed"
        fi

        # Apply gjs dbus compatibility patch if gjs >= 1.88
        local gjs_ver
        gjs_ver="$(gjs --version 2>/dev/null | grep -oP '[\d.]+')"
        local patch_file="$DOTFILES_DIR/.config/ags/gnim-dbus-fix.patch"
        if [[ -f "$patch_file" ]] && [[ "$(printf '%s\n' "1.88" "$gjs_ver" | sort -V | head -1)" == "1.88" ]]; then
            info "gjs $gjs_ver detected — applying dbus compatibility patch..."
            (cd "$DOTFILES_DIR/.config/ags" && patch -Np1 --forward -i "$patch_file" 2>/dev/null) && success "gnim patch applied" || skip "gnim patch already applied"
        fi
    fi

    run rm -f "/run/user/$(id -u)/ags.js"
    success "Compiled bundle cleared"
}

mod_theme() {
    header "Theme"

    # The full theme (shell CSS, foot, GTK, Hyprland, Firefox) is applied by AGS
    # (ags/theme.ts). apply-theme.sh only does dunst + live-reload hooks.
    if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v ags &>/dev/null && ags request help &>/dev/null; then
        run ags request theme mech && success "Applied via AGS: mech"
    else
        info "AGS not running — theme is applied on its first start (themes/.current)"
    fi
    local theme_script="$DOTFILES_DIR/.config/themes/apply-theme.sh"
    if [[ -x "$theme_script" ]]; then
        run bash "$theme_script" mech
        success "dunst colours: mech"
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

    run sudo systemctl enable ollama
    run sudo systemctl start ollama
    success "Service enabled"

    sleep 2
    info "Pulling qwen3-coder:30b (this may take a while)..."
    run ollama pull qwen3-coder:30b
    success "Model installed"
}

mod_omen() {
    header "HP Omen Max 16"

    # Machine profile (setup screen / auto-detected): everything here is
    # REQUIRED on this laptop. Without it the keyboard is dark after every boot
    # and lid-open, drops keys after long sessions, and has no RGB control.
    if ! command -v uv &>/dev/null; then
        error "uv not installed — run the packages module first, then: ./install.sh omen"
        return 1
    fi

    # User side: omen-rgb (per-key RGB over USB HID) + evdev for the reactive daemon.
    local src="$HOME/projects/personal/omen-rgb-linux-src"
    if [[ ! -d "$src/.git" ]]; then
        info "Cloning arfelious/omen-rgb-linux..."
        run git clone -q --depth 1 https://github.com/arfelious/omen-rgb-linux "$src" || { error "clone failed"; return 1; }
    fi
    info "Installing omen-rgb (uv tool) + evdev for the reactive daemon..."
    run uv tool install --quiet "$src" || { error "uv tool install failed"; return 1; }
    run uv pip install --quiet --python "$HOME/.local/share/uv/tools/omen-rgb/bin/python" evdev
    success "omen-rgb installed"

    # Root side (system/, see system/README.md):
    #   70-omen-rgb.rules               USB + hidraw + input access for the login session
    #   50-hp-keyboard-nosuspend.rules  keyboard USB autosuspend off (key drops)
    #   omen-kbd-backlight + sleep hook + service + acpi_call autoload
    #                                   EC backlight switch: on at boot and after resume
    local f mode udev_changed=0
    for f in etc/udev/rules.d/70-omen-rgb.rules etc/udev/rules.d/50-hp-keyboard-nosuspend.rules \
             usr/local/bin/omen-kbd-backlight etc/systemd/system-sleep/omen-kbd-backlight \
             etc/systemd/system/omen-kbd-backlight.service etc/modules-load.d/acpi_call.conf; do
        case "$f" in usr/local/bin/*|etc/systemd/system-sleep/*) mode=755 ;; *) mode=644 ;; esac
        if cmp -s "$DOTFILES_DIR/system/$f" "/$f"; then
            skip "/$f"
        else
            info "Installing /$f (sudo)..."
            run sudo install -Dm"$mode" "$DOTFILES_DIR/system/$f" "/$f" || { error "could not install /$f"; return 1; }
            [[ "$f" == etc/udev/* ]] && udev_changed=1
        fi
    done
    if [[ $udev_changed -eq 1 ]]; then
        run sudo udevadm control --reload
        run sudo udevadm trigger --subsystem-match=usb --subsystem-match=hidraw --subsystem-match=input
    fi
    success "udev rules in place"

    run sudo systemctl daemon-reload
    run sudo systemctl enable omen-kbd-backlight.service
    if [[ "$DRY_RUN" == "1" ]]; then
        info "(dry-run) would start omen-kbd-backlight.service"
    elif [[ -e /proc/acpi/call ]] || sudo modprobe acpi_call 2>/dev/null; then
        run sudo systemctl start omen-kbd-backlight.service \
            && success "EC backlight switch: on now, at boot and after resume" \
            || error "omen-kbd-backlight.service failed — see: systemctl status omen-kbd-backlight.service"
    else
        warn "acpi_call cannot load into the running kernel (kernel upgraded, reboot pending) — the backlight switch works from the next boot"
    fi
    # keyboard-reactive.service is enabled by the services module (gated on this
    # machine); the theme module's first apply paints the layout.
}

mod_nvim() {
    header "Neovim plugins"

    if ! command -v nvim &>/dev/null; then
        warn "nvim not installed — run packages module first"
        return 0
    fi
    # `Lazy! restore` installs exactly the versions in lazy-lock.json (tracked),
    # so a new machine gets the same plugin set as the last working one.
    if [[ "$DRY_RUN" == "1" ]]; then
        info "(dry-run) would run: nvim --headless '+Lazy! restore' +qa"
        return 0
    fi
    info "Restoring plugins from lazy-lock.json (first run can take a minute)..."
    if nvim --headless "+Lazy! restore" +qa 2>/dev/null; then
        success "Plugins restored"
    else
        warn "Lazy restore reported errors — open nvim and run :Lazy to inspect"
    fi
}

mod_tmux() {
    header "Tmux plugins"

    local tpm="$HOME/.tmux/plugins/tpm"
    if [[ -d "$tpm" ]]; then
        skip "tpm present"
    else
        run git clone -q https://github.com/tmux-plugins/tpm "$tpm" && success "tpm cloned"
    fi
    if [[ -x "$tpm/bin/install_plugins" ]]; then
        run "$tpm/bin/install_plugins" >/dev/null && success "Plugins installed"
    fi
}

mod_shell() {
    header "Login shell"

    local fish_bin
    fish_bin="$(command -v fish 2>/dev/null)"
    if [[ -z "$fish_bin" ]]; then
        warn "fish not installed — run packages module first"
        return 0
    fi
    local current
    current="$(getent passwd "$USER" | cut -d: -f7)"
    if [[ "$current" == "$fish_bin" ]]; then
        skip "fish is already the login shell"
        return 0
    fi
    if [[ "$DRY_RUN" == "1" ]]; then
        info "(dry-run) would run: chsh -s $fish_bin"
        return 0
    fi
    if [[ ! -t 0 ]]; then
        warn "No TTY — run manually: chsh -s $fish_bin"
        return 0
    fi
    if chsh -s "$fish_bin"; then
        success "Login shell set to fish (takes effect on next login)"
    else
        warn "chsh failed — run manually: chsh -s $fish_bin"
    fi
}

mod_wallpapers() {
    header "Wallpapers"

    # Wallpapers ship in the repo (.config/ags/wallpapers). awww keeps its
    # "current" state in ~/.config/awww; make sure the dir exists so hyprlock's
    # background path and the AGS selector never point at nothing, and leave a
    # generated default if the wallpaper dir is somehow empty.
    local walls="$DOTFILES_DIR/.config/ags/wallpapers"
    run mkdir -p "$HOME/.config/awww" "$walls"
    success "awww state dir"

    # Wallpapers are not in git (2 GB) — fetch them from the wallpapers-v1
    # release of this repo, skipping anything already present. Only when the
    # component was chosen, or this module was asked for by name.
    if ! chosen wallpapers && [[ " ${EXPLICIT_MODULES[*]:-} " != *" wallpapers "* ]]; then
        skip "wallpaper pack not selected (enable in ./install.sh, or run: ./install.sh wallpapers)"
    else
    local api="https://api.github.com/repos/AngeloNicolson/Dotfiles/releases/tags/wallpapers-v1"
    local dl="https://github.com/AngeloNicolson/Dotfiles/releases/download/wallpapers-v1"
    local assets
    assets="$(curl -fsSL "$api" 2>/dev/null | grep '"name"' | sed 's/.*"name": "//;s/".*//' | grep -vE '^(Wallpapers v1|wallpapers-v1)$' || true)"
    if [[ -z "$assets" ]]; then
        warn "Could not list the wallpapers-v1 release (offline, or not published yet)"
    else
        local asset got=0 have=0
        while read -r asset; do
            [[ -z "$asset" ]] && continue
            if [[ -f "$walls/$asset" ]]; then ((have++)); continue; fi
            if [[ "$DRY_RUN" == "1" ]]; then
                echo -e "  ${DIM}(dry-run) download $asset${NC}"; continue
            fi
            info "Downloading $asset..."
            if curl -fsSL "$dl/$asset" -o "$walls/$asset.part" && mv "$walls/$asset.part" "$walls/$asset"; then
                ((got++))
            else
                rm -f "$walls/$asset.part"; warn "Failed: $asset"
            fi
        done <<< "$assets"
        success "Wallpapers: $got downloaded, $have already present"
    fi
    fi

    if ! find -L "$walls" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) 2>/dev/null | grep -q .; then
        if command -v ffmpeg &>/dev/null; then
            run ffmpeg -loglevel error -y -f lavfi -i "gradients=s=2560x1600:c0=0x1a120b:c1=0x3a2a1a:nb_colors=2:x0=0:y0=0:x1=2560:y1=1600" -frames:v 1 "$walls/default.png" \
                && success "Generated default wallpaper (dir was empty)"
        else
            warn "No wallpapers and no ffmpeg to generate one — add images to $walls"
        fi
    else
        skip "wallpapers present"
    fi
}

mod_hostconfig() {
    header "Host config (monitors / scale)"

    local gen="$DOTFILES_DIR/.config/hypr/scripts/gen-host-config.sh"
    if [[ -z "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]] || ! command -v hyprctl &>/dev/null; then
        info "Not inside a Hyprland session — monitors.lua stays at the template"
        info "After first login run: ~/.config/hypr/scripts/gen-host-config.sh && hyprctl reload"
        return 0
    fi
    if [[ "$DRY_RUN" == "1" ]]; then
        bash "$gen" --dry-run
        return 0
    fi
    bash "$gen" && success "monitors.lua / LAPTOP_SCALE generated from connected displays"
}

# A fresh clone checks out the remote's default branch (origin/HEAD, main by
# convention). When this machine works on another branch, everything not on
# the default branch is invisible to a new machine even though it is pushed.
# Prints "<default-branch> <commits it is behind HEAD>", or nothing when HEAD
# tracks the default branch itself (or there is no remote default to compare).
default_branch_lag() {
    local def up
    def="$(git -C "$DOTFILES_DIR" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)"
    git -C "$DOTFILES_DIR" rev-parse -q --verify "$def^{commit}" >/dev/null 2>&1 || return 0
    up="$(git -C "$DOTFILES_DIR" rev-parse --abbrev-ref '@{u}' 2>/dev/null)"
    [[ "$up" == "$def" ]] && return 0
    echo "$def $(git -C "$DOTFILES_DIR" rev-list --count "$def..HEAD" 2>/dev/null || echo 0)"
}

# ─── Update ───────────────────────────────────────────────────────────────
# Every config dir is a symlink into this clone and every per-machine file
# (hypr/custom/*.lua, foot/host.ini, fish/system-local.fish, swappy/config,
# install.conf) is gitignored, so `git pull` IS the file update: it can only
# touch tracked files and can never overwrite a per-machine one. What a pull
# does not do is the follow-up — new npm deps, new .example templates, new
# units, system/ files, the stale AGS bundle, the running shell. That is this
# module: pull, then re-run only the modules whose inputs changed, then reload
# the live session.

mod_update() {
    header "Update"

    if ! command -v git &>/dev/null || [[ ! -d "$DOTFILES_DIR/.git" ]]; then
        error "$DOTFILES_DIR is not a git clone — nothing to pull (clone the repo, then ./install.sh)"
        return 1
    fi
    local -a g=(git -C "$DOTFILES_DIR")

    # Local edits to tracked files would be clobbered or conflict — refuse.
    local dirty
    dirty="$("${g[@]}" status --porcelain --untracked-files=no 2>/dev/null)"
    if [[ -n "$dirty" ]]; then
        error "Tracked files edited on this machine — not pulling over them:"
        sed 's/^/       /' <<<"$dirty"
        info "Commit and push them (so other machines get them), or drop them: git -C $DOTFILES_DIR stash"
        return 1
    fi

    local upstream before after ahead behind
    upstream="$("${g[@]}" rev-parse --abbrev-ref '@{u}' 2>/dev/null)"
    if [[ -z "$upstream" ]]; then
        error "No upstream branch (detached HEAD?) — run: git -C $DOTFILES_DIR checkout main"
        return 1
    fi
    before="$("${g[@]}" rev-parse HEAD)"
    info "Fetching $upstream..."
    if ! "${g[@]}" fetch -q; then
        error "fetch failed (offline? ssh key?) — nothing changed"
        return 1
    fi
    ahead="$("${g[@]}" rev-list --count "$upstream..HEAD")"
    behind="$("${g[@]}" rev-list --count "HEAD..$upstream")"
    if (( ahead > 0 )); then
        warn "$ahead local commit(s) not on $upstream — a machine cloning the repo gets the old config until: git -C $DOTFILES_DIR push"
    fi
    local def lag
    read -r def lag < <(default_branch_lag)
    if [[ -n "$def" ]] && (( lag > 0 )); then
        warn "$def (what a fresh clone checks out) is $lag commit(s) behind this branch — new machines get the old config until: git -C $DOTFILES_DIR push origin HEAD:${def#origin/}"
    fi
    if (( behind == 0 )); then
        skip "up to date with $upstream ($("${g[@]}" log -1 --format='%h %s'))"
        return 0
    fi

    info "$behind new commit(s):"
    "${g[@]}" log --format='%h %s' "HEAD..$upstream" | head -n 20 | while IFS= read -r line; do echo -e "     ${DIM}$line${NC}"; done
    (( behind > 20 )) && echo -e "     ${DIM}…${NC}"
    "${g[@]}" diff --shortstat "HEAD..$upstream" | sed 's/^/    /'
    if [[ "$DRY_RUN" == "1" ]]; then
        echo -e "  ${DIM}(dry-run) git pull --ff-only, then:${NC}"
        update_followups "HEAD" "$upstream"
        return 0
    fi
    if ! "${g[@]}" pull -q --ff-only; then
        error "pull --ff-only failed — local and remote history diverged; sort it out by hand: git -C $DOTFILES_DIR status"
        return 1
    fi
    after="$("${g[@]}" rev-parse HEAD)"
    success "Updated ${before:0:7} → ${after:0:7}"

    # The pull may have replaced this very script — hand over to the new one
    # for the follow-ups rather than finishing on stale code.
    if "${g[@]}" diff --name-only "$before" "$after" | grep -qx 'install.sh'; then
        info "install.sh itself changed — continuing with the new version"
        exec bash "$DOTFILES_DIR/install.sh" ${ASSUME_YES:+--yes} "--followups=$before..$after"
    fi
    update_followups "$before" "$after"
}

# Re-run the modules whose inputs changed between two commits (git diff
# --name-only), then reload what is running so the update shows without a
# logout. Modules that only act on first install (shell, tmux, wallpapers,
# hostconfig, theme) are left alone: they would reset per-machine choices.
update_followups() {
    local changed
    changed="$(git -C "$DOTFILES_DIR" diff --name-only "$1" "$2")"
    touched() { grep -qE "$1" <<<"$changed"; }

    local -a mods=()
    touched '^packages/'                                         && mods+=(packages)
    touched '^install\.sh$|^\.local/bin/|^\.config/[^/]+/?$'    && mods+=(symlinks)
    touched '^install\.sh$|\.(sh|py)$'                           && mods+=(scripts)
    touched '^install\.sh$|\.example$'                           && mods+=(templates)
    touched '^install\.sh$'                                      && mods+=(dirs)
    touched '^install\.sh$|^\.config/systemd/'                   && mods+=(services)
    is_omen && touched '^system/'                                && mods+=(omen)
    touched '^\.config/ags/'                                     && mods+=(ags)
    chosen neovim && touched '^\.config/nvim/lazy-lock\.json$'   && mods+=(nvim)
    chosen firefox && touched '^\.mozilla/'                      && mods+=(firefox)
    mods+=(doctor)

    info "Changed: $(wc -l <<<"$changed") file(s) → modules: ${mods[*]}"
    TOTAL_MODULES=$(( TOTAL_MODULES + ${#mods[@]} ))
    local m
    for m in "${mods[@]}"; do run_module "$m"; done

    # Live session. The theme re-applies itself on AGS start (themes/.current),
    # so a restart is enough; nothing here changes which theme is on.
    if [[ -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]] && command -v hyprctl &>/dev/null; then
        echo ""
        if touched '^\.config/hypr/'; then
            run hyprctl reload >/dev/null && success "Hyprland config reloaded"
        fi
        if touched '^\.config/ags/' && command -v ags &>/dev/null && ags request help &>/dev/null; then
            run ags quit
            [[ "$DRY_RUN" == "1" ]] || sleep 1
            run setsid -f bash -c "ags run '$HOME/.config/ags/app.tsx' >/dev/null 2>&1" \
                && success "AGS restarted on the new bundle"
        fi
    elif touched '^\.config/(hypr|ags)/'; then
        info "Not inside a Hyprland session — the new config applies at the next login"
    fi
    return 0
}

# ─── Doctor ───────────────────────────────────────────────────────────────
# Read-only. Exit 1 if anything the config depends on is missing/outdated.

DOCTOR_FAILS=0
d_ok()   { success "$1"; }
d_bad()  { error "$1"; ((DOCTOR_FAILS++)); }
d_warn() { warn "$1"; }

mod_doctor() {
    header "Doctor"
    DOCTOR_FAILS=0

    local on="" off="" id
    for id in $(machine_ids); do [[ "${CHOICE[$id]}" == y ]] && on="$on $id" || off="$off $id"; done
    info "Machine profiles on:${on:- (none)}"
    echo -e "     ${DIM}off:${off:- (none)}${NC}"
    on=""; off=""
    for id in $(comp_ids); do chosen "$id" && on="$on $id" || off="$off $id"; done
    info "Components on:${on:- (none)}"
    echo -e "     ${DIM}off:${off:- (none)}  — change with ./install.sh (setup screen) or edit install.conf${NC}"

    info "Binaries"
    local bin
    for bin in Hyprland hyprctl foot fish ags gjs jq brightnessctl grim slurp wl-copy awww ffmpeg fc-list gsettings dunst rofi wlogout socat bluetoothctl; do
        if command -v "$bin" &>/dev/null; then d_ok "$bin"; else d_bad "$bin missing"; fi
    done
    if is_omen; then
        info "HP Omen Max 16 (machine profile — all required)"
        command -v omen-rgb &>/dev/null && d_ok "omen-rgb" || d_bad "omen-rgb missing — run: ./install.sh omen"
        grep -qs 'SUBSYSTEM=="input"' /etc/udev/rules.d/70-omen-rgb.rules && d_ok "udev rule 70-omen-rgb (usb+hidraw+input)" || d_bad "udev rule missing or old: /etc/udev/rules.d/70-omen-rgb.rules — run: ./install.sh omen"
        cmp -s "$DOTFILES_DIR/system/etc/udev/rules.d/50-hp-keyboard-nosuspend.rules" /etc/udev/rules.d/50-hp-keyboard-nosuspend.rules && d_ok "udev rule 50-hp-keyboard-nosuspend" || d_bad "keyboard autosuspend rule missing (key drops) — run: ./install.sh omen"
        [[ -x /usr/local/bin/omen-kbd-backlight && -x /etc/systemd/system-sleep/omen-kbd-backlight ]] && d_ok "EC backlight switch script + resume hook" || d_bad "EC backlight switch not installed (keyboard dark after boot/suspend) — run: ./install.sh omen"
        [[ "$(systemctl is-enabled omen-kbd-backlight.service 2>/dev/null)" == enabled ]] && d_ok "omen-kbd-backlight.service enabled" || d_bad "omen-kbd-backlight.service not enabled — run: ./install.sh omen"
        [[ -e /proc/acpi/call ]] && d_ok "acpi_call loaded" || d_bad "acpi_call not loaded (package missing, or reboot pending after a kernel upgrade)"
        [[ "$(systemctl --user is-enabled keyboard-reactive.service 2>/dev/null)" == enabled ]] && d_ok "keyboard-reactive.service enabled" || d_bad "keyboard-reactive.service not enabled — run: ./install.sh services"
        [[ "$(systemctl --user is-active keyboard-reactive.service 2>/dev/null)" == active ]] && d_ok "keyboard-reactive.service active" || d_warn "keyboard-reactive.service not active (starts with the graphical session)"
    fi
    for bin in npm git; do
        command -v "$bin" &>/dev/null && d_ok "$bin" || d_warn "$bin missing (optional but used)"
    done
    # Component binaries: required only if the component was chosen
    local cid cbin
    for cid in lockscreen:hyprlock idle:hypridle neovim:nvim tmux:tmux zathura:zathura media:mpv display:hyprshade; do
        cbin="${cid#*:}"; cid="${cid%%:*}"
        if chosen "$cid"; then
            command -v "$cbin" &>/dev/null && d_ok "$cbin ($cid)" || d_bad "$cbin missing but component '$cid' is on — run: ./install.sh packages"
        else
            command -v "$cbin" &>/dev/null && d_ok "$cbin (present; component '$cid' off)" || skip "$cbin — component '$cid' off"
        fi
    done

    info "Minimum versions"
    local have
    if command -v Hyprland &>/dev/null; then
        have="$(Hyprland --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)"
        if [[ -n "$have" ]] && version_ge "$have" "${MIN_VERSIONS[hyprland]}"; then
            d_ok "hyprland $have (>= ${MIN_VERSIONS[hyprland]})"
            version_ge "$have" "0.57.0" || d_warn "hyprland $have still reads hyprland.conf if one exists and nags about it; 0.57+ is Lua-only (this config is maintained on 0.57)"
        else d_bad "hyprland ${have:-?} < ${MIN_VERSIONS[hyprland]} (Lua config, windowrule match: syntax, blur protocol) — update Hyprland"; fi
    fi
    if command -v foot &>/dev/null; then
        have="$(foot --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1)"
        if [[ -n "$have" ]] && version_ge "$have" "${MIN_VERSIONS[foot]}"; then d_ok "foot $have (>= ${MIN_VERSIONS[foot]})"
        else d_bad "foot ${have:-?} < ${MIN_VERSIONS[foot]} (blur + include)"; fi
        foot --version 2>/dev/null | grep -q '+blur' && d_ok "foot built with +blur" || d_warn "foot built without blur — terminal blur won't render"
    fi

    info "Fonts (fc-list)"
    local font
    for font in "JetBrainsMono Nerd Font" "CaskaydiaCove Nerd Font Mono" "Noto Sans CJK JP" "Symbols Nerd Font"; do
        if fc-list 2>/dev/null | grep -qi "$font"; then d_ok "$font"; else d_bad "font missing: $font"; fi
    done

    if chosen themes; then
    info "Themes / cursors / icons"
    local d found
    for d in "themes/adw-gtk3-dark:GTK theme adw-gtk3-dark" "icons/Bibata-Modern-Ice:cursor Bibata-Modern-Ice"; do
        found=0
        for root in /usr/share "$HOME/.local/share" "$HOME/.themes" "$HOME/.icons"; do
            [[ -d "$root/${d%%:*}" || -d "$root/$(basename "${d%%:*}")" ]] && found=1
        done
        if [[ $found -eq 1 ]]; then d_ok "${d#*:}"; else d_bad "${d#*:} not installed"; fi
    done
    else
        skip "themes component off — GTK falls back to Adwaita/default cursor"
    fi

    info "Machine-specific files"
    local f
    for f in "$DOTFILES_DIR"/.config/hypr/custom/*.lua.example; do
        [[ -f "${f%.example}" ]] && d_ok "$(basename "${f%.example}")" || d_bad "$(basename "${f%.example}") missing — run: ./install.sh templates"
    done
    [[ -f "$DOTFILES_DIR/.config/foot/host.ini" ]] && d_ok "foot host.ini" || d_bad "foot/host.ini missing (foot will not start) — run: ./install.sh templates"
    [[ -f "$DOTFILES_DIR/.config/fish/system-local.fish" ]] && d_ok "fish system-local.fish" || d_warn "fish/system-local.fish missing — run: ./install.sh templates"
    [[ -f "$DOTFILES_DIR/.config/swappy/config" ]] && d_ok "swappy config" || d_warn "swappy/config missing — run: ./install.sh templates"
    if grep -qE '^[[:space:]]*hl\.monitor\(' "$DOTFILES_DIR/.config/hypr/custom/monitors.lua" "$DOTFILES_DIR/.config/hypr/custom/general.lua" 2>/dev/null; then
        d_ok "monitor layout defined (custom/monitors.lua or general.lua)"
    else
        d_warn "no monitor lines yet — universal fallback in use; run gen-host-config.sh inside Hyprland"
    fi

    info "Config parses"
    [[ -f "$DOTFILES_DIR/.config/hypr/hyprland.lua" ]] && d_ok "hyprland.lua present (Lua config; .conf is dropped in Hyprland 0.57)" || d_warn "hyprland.lua missing — Hyprland will fall back to hyprland.conf (removed in 0.57)"
    if [[ -f "$DOTFILES_DIR/.config/hypr/hyprland.conf" ]]; then
        d_bad "stale hyprland.conf beside hyprland.lua (not part of these dotfiles; old Hyprland warns about it) — run: ./install.sh templates"
    else
        d_ok "no stray hyprland.conf"
    fi
    if command -v Hyprland &>/dev/null; then
        # Hyprland aborts before parsing without XDG_RUNTIME_DIR (TTY/CI) — give it one.
        local xdg="${XDG_RUNTIME_DIR:-}"
        if [[ -z "$xdg" || ! -d "$xdg" ]]; then xdg="$(mktemp -d)"; fi
        if XDG_RUNTIME_DIR="$xdg" Hyprland --verify-config 2>&1 | grep -q 'config ok'; then d_ok "Hyprland --verify-config"; else d_bad "Hyprland --verify-config reports errors (run it to see them)"; fi
    fi
    if [[ -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]] && command -v hyprctl &>/dev/null; then
        local cfgerr; cfgerr="$(hyprctl configerrors 2>/dev/null)"
        [[ -z "$cfgerr" || "$cfgerr" == "no errors" ]] && d_ok "hyprctl configerrors: none" || d_bad "hyprctl configerrors: $cfgerr"
    fi
    if command -v foot &>/dev/null; then
        if foot --check-config &>/dev/null; then d_ok "foot --check-config"; else d_bad "foot --check-config failed: $(foot --check-config 2>&1 | head -n1)"; fi
    fi

    info "Clone"
    if [[ -d "$DOTFILES_DIR/.git" ]] && command -v git &>/dev/null; then
        local up ahead behind dirty
        up="$(git -C "$DOTFILES_DIR" rev-parse --abbrev-ref '@{u}' 2>/dev/null)"
        if [[ -n "$up" ]]; then
            ahead="$(git -C "$DOTFILES_DIR" rev-list --count "$up..HEAD" 2>/dev/null || echo 0)"
            behind="$(git -C "$DOTFILES_DIR" rev-list --count "HEAD..$up" 2>/dev/null || echo 0)"
            (( ahead == 0 )) && d_ok "nothing unpushed" || d_warn "$ahead commit(s) not pushed to $up — a new machine cloning the repo gets the old config: git -C $DOTFILES_DIR push"
            local def lag
            read -r def lag < <(default_branch_lag)
            if [[ -n "$def" ]]; then
                (( lag == 0 )) && d_ok "$def (what a fresh clone checks out) has everything on this branch" \
                    || d_warn "$def (what a fresh clone checks out) is $lag commit(s) behind this branch ($up) — new machines get the old config: git -C $DOTFILES_DIR push origin HEAD:${def#origin/}"
            fi
            (( behind == 0 )) && d_ok "up to date with $up (as of the last fetch)" || d_warn "$behind commit(s) behind $up — run: ./install.sh update"
            dirty="$(git -C "$DOTFILES_DIR" status --porcelain --untracked-files=no 2>/dev/null | wc -l)"
            (( dirty == 0 )) && d_ok "no uncommitted edits to tracked files" || d_warn "$dirty tracked file(s) edited but not committed — this machine only; blocks ./install.sh update"
        else
            d_warn "no upstream branch — ./install.sh update cannot pull"
        fi
    else
        d_warn "not a git clone — no update path (git clone the repo instead of copying it)"
    fi

    info "Symlinks"
    for d in hypr ags foot fish nvim themes; do
        if [[ -L "$HOME/.config/$d" && "$(readlink "$HOME/.config/$d")" == "$DOTFILES_DIR/.config/$d" ]]; then d_ok "~/.config/$d"; else d_bad "~/.config/$d not linked — run: ./install.sh symlinks"; fi
    done

    info "AGS"
    [[ -d "$DOTFILES_DIR/.config/ags/node_modules" ]] && d_ok "node_modules present" || d_bad "ags/node_modules missing — run: ./install.sh ags"
    [[ -f "$DOTFILES_DIR/.config/nvim/lazy-lock.json" ]] && d_ok "nvim lazy-lock.json tracked" || d_warn "nvim lazy-lock.json missing"
    find -L "$DOTFILES_DIR/.config/ags/wallpapers" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.png' -o -iname '*.jpeg' -o -iname '*.webp' \) 2>/dev/null | grep -q . \
        && d_ok "wallpapers present" || d_warn "no wallpapers — run: ./install.sh wallpapers"

    echo ""
    if [[ $DOCTOR_FAILS -eq 0 ]]; then
        success "Doctor: all checks passed"
        return 0
    else
        error "Doctor: $DOCTOR_FAILS problem(s) found"
        return 1
    fi
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
    local prompt="$1" default="$2" reply hint
    [[ "$default" == "y" ]] && hint="[Y/n]" || hint="[y/N]"
    while true; do
        read -rp "    $prompt $hint " reply
        reply="${reply:-$default}"
        case "$reply" in
            [Yy]) echo "y"; return ;;
            [Nn]) echo "n"; return ;;
        esac
    done
}

interactive_prompts() {
    echo -e "  ${BOLD}Always installed (required by the config):${NC}"
    echo -e "    ${DIM}$REQUIRED_SUMMARY${NC}"
    echo ""
    local id def
    if [[ "$ASSUME_YES" == "1" ]]; then
        info "Non-interactive: machine profiles + components from OPT_<NAME>=y|n env, else install.conf, else auto-detect / defaults"
    else
        echo -e "  ${BOLD}Machine${NC} ${DIM}(hardware-specific pieces; required on a match, skipped otherwise)${NC}"
        echo ""
        for id in $(machine_ids); do
            if detect_machine "$id"; then
                echo -e "    ${DIM}detected: $(tr -d '\n' < /sys/class/dmi/id/product_name 2>/dev/null || echo "matching hardware")${NC}"
            fi
            CHOICE[$id]="$(ask_yn "$(machine_desc "$id")" "${CHOICE[$id]}")"
        done
        echo ""
        echo -e "  ${BOLD}Optional components${NC} ${DIM}(Enter keeps the default shown; saved to install.conf)${NC}"
        echo ""
        for id in $(comp_ids); do
            def="${CHOICE[$id]}"
            CHOICE[$id]="$(ask_yn "$(comp_desc "$id")" "$def")"
        done
    fi
    echo ""
    local on=""
    for id in $(machine_ids); do [[ "${CHOICE[$id]}" == y ]] && on="$on $id"; done
    info "Machine:${on:- generic}"
    on=""
    for id in $(comp_ids); do chosen "$id" && on="$on $id"; done
    info "Components:${on:- (none beyond required)}"
    save_choices
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
        ollama)    mod_ollama ;;
        omen|keyboard-rgb) mod_omen ;;
        tablet)    header "Tablet"; skip "Handled by symlinked configs (OpenTabletDriver)" ;;
        nvim)      mod_nvim ;;
        tmux)      mod_tmux ;;
        shell)     mod_shell ;;
        wallpapers) mod_wallpapers ;;
        hostconfig) mod_hostconfig ;;
        update)    mod_update ;;
        doctor)    mod_doctor ;;
        lock)      mod_lock ;;
        *)         error "Unknown module: $mod"; return 1 ;;
    esac
    local status=$?
    if [[ "$mod" == "doctor" ]]; then DOCTOR_STATUS=$status; return $status; fi
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
    echo -e "  ${DIM}2.${NC} Inside Hyprland, generate the monitor/scale config for this machine:"
    echo -e "     ${CYAN}~/.config/hypr/scripts/gen-host-config.sh && hyprctl reload${NC}"
    echo -e "  ${DIM}3.${NC} Tweak machine-specific files if needed:"
    echo -e "     ${DIM}~/.config/hypr/custom/*.lua  ·  ~/.config/foot/host.ini  ·  ~/.config/fish/system-local.fish${NC}"
    echo -e "  ${DIM}4.${NC} Check everything: ${CYAN}./install.sh doctor${NC}"
    chosen firefox && echo -e "  ${DIM}5.${NC} Restart Firefox to apply custom CSS"
    if is_omen && [[ ! -e /proc/acpi/call ]]; then
        echo -e "  ${YELLOW}!${NC} Omen Max 16: reboot once so acpi_call loads — until then the keyboard backlight needs Fn+F4 after boot/lid-open"
    fi
    echo ""
}

# ─── Main ──────────────────────────────────────────────────────────────────

ARGS=()
for arg in "$@"; do
    case "$arg" in
        --dry-run)     DRY_RUN=1 ;;
        --yes|-y)      ASSUME_YES=1 ;;
        --followups=*) FOLLOWUPS="${arg#*=}" ;;   # internal: update re-execs into the pulled script
        -h|--help)     sed -n '2,11p' "$0"; exit 0 ;;
        --*)           echo "Unknown flag: $arg"; exit 2 ;;
        *)             ARGS+=("$arg") ;;
    esac
done
set -- "${ARGS[@]}"
[[ "$DRY_RUN" == "1" ]] && echo -e "  ${YELLOW}${BOLD}DRY RUN${NC} — nothing will be changed"

detect_distro
load_choices
EXPLICIT_MODULES=("$@")

if [[ -n "${FOLLOWUPS:-}" ]]; then
    TOTAL_MODULES=0
    update_followups "${FOLLOWUPS%..*}" "${FOLLOWUPS#*..}"
    echo ""
    exit "${DOCTOR_STATUS:-0}"
fi

if [[ $# -eq 0 ]]; then
    banner
    info "Detected distro: ${BOLD}$DISTRO${NC}"
    echo ""
    interactive_prompts

    # omen (machine profile) runs before theme: the theme's first apply paints the keyboard.
    CORE_MODULES=(packages symlinks scripts templates dirs wallpapers services)
    is_omen && CORE_MODULES+=(omen)
    CORE_MODULES+=(ags theme shell hostconfig)
    OPTIONAL_MODULES=()

    chosen neovim  && OPTIONAL_MODULES+=(nvim)
    chosen tmux    && OPTIONAL_MODULES+=(tmux)
    chosen firefox && OPTIONAL_MODULES+=(firefox)
    chosen ollama  && OPTIONAL_MODULES+=(ollama)
    chosen tablet  && OPTIONAL_MODULES+=(tablet)

    ALL_MODULES=("${CORE_MODULES[@]}" "${OPTIONAL_MODULES[@]}" doctor)
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

# `./install.sh doctor` (alone or with others) exits non-zero when checks fail,
# so it can gate CI or a shell prompt.
exit "${DOCTOR_STATUS:-0}"

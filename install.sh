#!/bin/bash
# Dotfiles Installation Script

set -e

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing dotfiles from $DOTFILES_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Install packages
print_status "Installing packages..."
if command -v yay &> /dev/null; then
    yay -S --needed --noconfirm $(cat "$DOTFILES_DIR/packages.txt" | grep -v '^#' | grep -v '^$')
elif command -v paru &> /dev/null; then
    paru -S --needed --noconfirm $(cat "$DOTFILES_DIR/packages.txt" | grep -v '^#' | grep -v '^$')
elif command -v pacman &> /dev/null; then
    sudo pacman -S --needed --noconfirm $(cat "$DOTFILES_DIR/packages.txt" | grep -v '^#' | grep -v '^$')
else
    echo "No package manager found. Please install packages manually from packages.txt"
fi
print_success "Packages installed"

# Symlink config files
print_status "Symlinking config files..."
ln -sf "$DOTFILES_DIR/.config/"* "$HOME/.config/"
print_success "Config files symlinked"

# Symlink tmux config
print_status "Symlinking tmux config..."
ln -sf "$DOTFILES_DIR/.tmux.conf" "$HOME/.tmux.conf"
print_success "Tmux config symlinked"

# Symlink local bin directory
print_status "Symlinking local bin..."
mkdir -p "$HOME/.local/bin"
ln -sf "$DOTFILES_DIR/.local/bin/"* "$HOME/.local/bin/"
print_success "Local bin symlinked"

# Setup Firefox
print_status "Setting up Firefox..."

# Find Firefox profile directory
FIREFOX_PROFILE_DIR=$(find "$HOME/.mozilla/firefox" -maxdepth 1 -type d -name "*.default-release" | head -n 1)

if [ -z "$FIREFOX_PROFILE_DIR" ]; then
    echo "Firefox profile not found. Please run Firefox once to create a profile, then run this script again."
else
    # Symlink chrome directory
    rm -rf "$FIREFOX_PROFILE_DIR/chrome"
    ln -sf "$DOTFILES_DIR/.mozilla/firefox/chrome" "$FIREFOX_PROFILE_DIR/chrome"

    # Symlink user.js (contains Potatofox settings + performance tweaks)
    ln -sf "$DOTFILES_DIR/.mozilla/firefox/user.js" "$FIREFOX_PROFILE_DIR/user.js"

    print_success "Firefox customization installed"
fi

# Setup Hyprland
print_status "Setting up Hyprland..."
if [ -d "$HOME/.config/hypr" ]; then
    print_success "Hyprland config is ready"
else
    echo "Hyprland config directory not found. Make sure symlinking worked correctly."
fi

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart your session or reboot"
echo "  2. If using Firefox, restart it to apply the custom CSS"
echo "  3. Check hyprland config at ~/.config/hypr/"

# Make scripts executable
print_status "Making scripts executable..."
find "$HOME/.config/hypr/scripts" -type f -name "*.sh" -exec chmod +x {} \;
find "$HOME/.config/hypr/scripts" -type f -name "*.py" -exec chmod +x {} \;
print_success "Scripts are executable"

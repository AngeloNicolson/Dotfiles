# Dotfiles

My personal configuration files for Hyprland, AGS, Neovim, Fish, and more.

## Contents

- **Hyprland** - Wayland compositor configuration
  - Custom keybindings
  - Window rules and workspace management
  - Layout manager scripts (visual layout designer, browser, and apply tools)
- **AGS** - Desktop UI (bar, notifications, widgets)
- **Neovim** - Editor configuration
- **Fish** - Shell configuration with Starship prompt
- **Foot** - Terminal emulator configuration

## Prerequisites

Install required packages (Arch Linux):

```bash
# Install all dependencies
sudo pacman -S --needed $(cat packages.txt)
```

## Installation

### Quick Install (Copy files)

```bash
# Clone the repository
git clone https://github.com/yourusername/dotfiles.git ~/dotfiles-temp
cd ~/dotfiles-temp

# Backup existing configs
mkdir -p ~/.config-backup
cp -r ~/.config/hypr ~/.config-backup/ 2>/dev/null
cp -r ~/.config/ags ~/.config-backup/ 2>/dev/null
cp -r ~/.config/nvim ~/.config-backup/ 2>/dev/null
cp -r ~/.config/fish ~/.config-backup/ 2>/dev/null
cp -r ~/.config/foot ~/.config-backup/ 2>/dev/null

# Copy configs
cp -r .config/* ~/.config/

# Create fish system-local.fish from template
cp ~/.config/fish/system-local.fish.example ~/.config/fish/system-local.fish

# Edit system-local.fish for your system
$EDITOR ~/.config/fish/system-local.fish

# Install Neovim plugins
nvim --headless "+Lazy! sync" +qa

# Install tmux plugin manager (TPM)
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Set fish as default shell (optional)
chsh -s /usr/bin/fish

# Cleanup
cd ~
rm -rf ~/dotfiles-temp
```

### Development Install (Symlinks)

For active development where you want changes tracked by git:

```bash
# Clone the repository
git clone https://github.com/yourusername/dotfiles.git ~/dotfiles
cd ~/dotfiles

# Backup existing configs
mkdir -p ~/.config-backup
mv ~/.config/hypr ~/.config-backup/ 2>/dev/null
mv ~/.config/ags ~/.config-backup/ 2>/dev/null
mv ~/.config/nvim ~/.config-backup/ 2>/dev/null
mv ~/.config/fish ~/.config-backup/ 2>/dev/null
mv ~/.config/foot ~/.config-backup/ 2>/dev/null
mv ~/.config/starship.toml ~/.config-backup/ 2>/dev/null

# Create symlinks
ln -s ~/dotfiles/.config/hypr ~/.config/hypr
ln -s ~/dotfiles/.config/ags ~/.config/ags
ln -s ~/dotfiles/.config/nvim ~/.config/nvim
ln -s ~/dotfiles/.config/fish ~/.config/fish
ln -s ~/dotfiles/.config/foot ~/.config/foot
ln -s ~/dotfiles/.config/starship.toml ~/.config/starship.toml

# Create fish system-local.fish
cp ~/.config/fish/system-local.fish.example ~/.config/fish/system-local.fish
$EDITOR ~/.config/fish/system-local.fish

# Install Neovim plugins
nvim --headless "+Lazy! sync" +qa

# Install tmux plugin manager (TPM) for tmux-powerline
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
# Then in tmux, press: prefix + I (capital i) to install plugins
```

## Post-Installation

1. **Configure fish shell:**
   - Edit `~/.config/fish/system-local.fish` for machine-specific paths
   - Restart your shell

2. **Configure Hyprland:**
   - Edit `~/.config/hypr/custom/` files for personal customizations
   - Reload: `hyprctl reload`

3. **Start Hyprland:**
   ```bash
   Hyprland
   ```

## Features

### Hyprland Layout Manager

Custom layout management system with visual designer:

- **Visual Layout Designer** - Create layouts with GTK GUI
  ```bash
  ~/.config/hypr/scripts/visual_layout_designer.py
  ```

- **Layout Browser** - Browse and preview saved layouts
  ```bash
  ~/.config/hypr/scripts/layout_browser.py
  ```

- **Apply Layout** - Apply a saved layout
  ```bash
  ~/.config/hypr/scripts/apply_layout.py ~/.config/hypr/layouts/example_dev_layout.json
  ```

### Keybindings

- `SUPER + Enter` - Open terminal (foot)
- `SUPER + T` - Open kitty
- `SUPER + F` - Open Firefox
- `SUPER + A` - Toggle app launcher
- `SUPER + Q` - Close window
- See `~/.config/hypr/keybindings.conf` for complete list

## Configuration Notes

### Fish Shell

- Universal config in `config.fish`
- Machine-specific settings in `system-local.fish` (git-ignored)
- Template provided in `system-local.fish.example`

### Hyprland

- Main config: `~/.config/hypr/hyprland.conf`
- Custom overrides: `~/.config/hypr/custom/`
- Layouts: `~/.config/hypr/layouts/`
- Applications database: `~/.config/hypr/apps.conf`

## License

MIT

## Credits

- AGS by Aylur
- Hyprland by vaxry

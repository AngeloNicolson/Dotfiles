# Dotfiles

My personal configuration files for Hyprland, AGS, Neovim, Fish, and more.

## Contents

- **Theme System** - Unified theme management (Mech, Famicom, E-Ink)
  - Synchronized colors across Neovim, Foot, GTK, and Hyprland
  - Single command theme switching
- **Hyprland** - Wayland compositor configuration
  - Custom keybindings
  - Window rules and workspace management
  - Layout manager scripts (visual layout designer, browser, and apply tools)
- **AGS** - Desktop UI (bar, notifications, widgets)
- **Neovim** - Editor configuration with AI coding assistants
- **Fish** - Shell configuration with Starship prompt
- **Foot** - Terminal emulator configuration
- **Ollama** - Local AI/LLM server with GPU acceleration
  - Qwen3-Coder 30B model for coding assistance
  - Integrated with Neovim (CodeCompanion, Avante)
  - CLI management tool (Monolith)

## AI Coding Features

### Local AI Integration

This dotfiles setup includes local AI coding assistants powered by Ollama with GPU acceleration:

**Models:**
- **Qwen3-Coder 30B** (Q4_K_M quantized, 18GB)
  - Optimized for code generation and programming tasks
  - 262K token context window
  - Runs on NVIDIA GPU (RTX 5090 24GB VRAM)

**Tools:**
- **CodeCompanion** (Neovim) - Chat and inline code editing
  - `Space cc` - Toggle chat window
  - `Space ci` - Inline code generation
  - `Space ca` - Code actions (explain, refactor, fix)
- **Avante** (Neovim) - Cursor-like AI editing experience
  - `Space aa` - Show sidebar
  - `Space ae` - Edit selection (visual mode)
  - Apply/reject AI suggestions with `a` / `co` / `ct`
- **Monolith** (CLI) - Ollama management tool
  - Interactive model selection
  - Service management (start/stop)
  - Status monitoring

**System Requirements:**
- NVIDIA GPU with 20GB+ VRAM (for 30B models)
- CUDA drivers installed
- ~20GB disk space for models

### Using the AI Features

**Start the AI service:**
```bash
monolith         # Interactive menu
monolith start   # Quick start
monolith status  # Check status
```

**In Neovim:**
```vim
Space cc         # Open AI chat
Space ci         # Inline code generation
Space ae         # AI edit (visual mode)
```

**Chat with AI directly:**
```bash
ollama run qwen3-coder:30b
```

## Theme System

Unified theme management system that synchronizes colors across all applications.

### Available Themes

- **Mech** (dark, gruvbox-inspired) - Warm dark theme with high contrast
- **Famicom** (light, retro) - Cream background with vibrant gaming-inspired colors
- **E-Ink** (monochrome) - Pure black and white for minimal distraction

### Architecture

Themes are defined in JSON files at `~/.config/themes/`:
- `mech.json`, `famicom.json`, `e-ink.json` - Theme definitions with color palettes and settings
- `.current` - Stores the currently active theme name
- `apply-theme.sh` - Script to apply themes system-wide

Each theme file defines:
- **Colors** - Complete palette (background, foreground, accents, ANSI colors)
- **GTK** - GTK theme, icon theme, cursor theme, color scheme preference
- **Hyprland** - Border radius, gaps, border size

### Switching Themes

```bash
# Apply a theme
~/.config/themes/apply-theme.sh mech
~/.config/themes/apply-theme.sh famicom
~/.config/themes/apply-theme.sh e-ink

# The script automatically:
# 1. Updates Foot terminal colors
# 2. Applies GTK theme settings
# 3. Updates Hyprland appearance (gaps, borders, rounding)
# 4. Saves theme selection to .current file
```

### Neovim Integration

Neovim automatically syncs with the system theme on startup by:
1. Reading `~/.config/themes/.current` to detect active theme
2. Loading matching colorscheme from `~/.config/nvim/colors/`

To reload theme in Neovim after changing system theme:
```vim
:ReloadSystemTheme
```

The Neovim colorschemes use identical color values from the theme JSON files, ensuring perfect synchronization.

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
cp -r ~/.config/themes ~/.config-backup/ 2>/dev/null

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
mv ~/.config/themes ~/.config-backup/ 2>/dev/null
mv ~/.config/starship.toml ~/.config-backup/ 2>/dev/null

# Create symlinks
ln -s ~/dotfiles/.config/hypr ~/.config/hypr
ln -s ~/dotfiles/.config/ags ~/.config/ags
ln -s ~/dotfiles/.config/nvim ~/.config/nvim
ln -s ~/dotfiles/.config/fish ~/.config/fish
ln -s ~/dotfiles/.config/foot ~/.config/foot
ln -s ~/dotfiles/.config/themes ~/.config/themes
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

2. **Apply a theme:**
   ```bash
   ~/.config/themes/apply-theme.sh mech
   ```

3. **Configure Hyprland:**
   - Edit `~/.config/hypr/custom/` files for personal customizations
   - Reload: `hyprctl reload`

4. **Restore rnote settings (if using rnote):**
   ```bash
   dconf load /com/github/flxzt/rnote/ < ~/.config/rnote-dconf-settings.ini
   ```

5. **Start Hyprland:**
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

### Wacom Tablet

- See [README_WACOM.md](README_WACOM.md) for Wacom tablet setup (Intuos Pro)
- Uses OpenTabletDriver for best Wayland/Hyprland compatibility

### Rnote

- Application settings stored in dconf: `/com/github/flxzt/rnote/`
- GTK styling in `.config/gtk-4.0/rnote.css`
- Restore settings with: `dconf load /com/github/flxzt/rnote/ < ~/.config/rnote-dconf-settings.ini`

### Firefox Custom CSS

Custom Firefox theme with:
- Centered, always-visible URL/search bar with rounded corners
- Auto-hiding navigation bar (shows on hover)
- Auto-hiding sidebar (Sidebery)
- Hidden tab bar (tabs managed by Sidebery)
- Dark theme

**Installation:**

1. Find your Firefox profile folder:
   ```bash
   # Profile is typically at:
   ~/.mozilla/firefox/XXXXXXXX.default-release/
   ```

2. Copy the chrome folder and config files:
   ```bash
   # Copy chrome folder to your Firefox profile
   cp -r .mozilla/firefox/chrome ~/.mozilla/firefox/XXXXXXXX.default-release/

   # Copy performance config
   cp .mozilla/firefox/user.js ~/.mozilla/firefox/XXXXXXXX.default-release/
   ```
   Replace `XXXXXXXX.default-release` with your actual profile folder name.

3. Symlink user.js (contains Potatofox settings + performance tweaks):
   ```bash
   ln -sf ~/projects/personal/dotfiles/.mozilla/firefox/user.js ~/.mozilla/firefox/XXXXXXXX.default-release/user.js
   ```
   This enables userChrome CSS and sets required Firefox preferences automatically.

4. Install the Sidebery extension and import settings:
   - Install [Sidebery](https://addons.mozilla.org/en-US/firefox/addon/sidebery)
   - Open Sidebery Settings > Help > Import addon data
   - Import `.mozilla/firefox/Sidebery-Data.json`

5. Restart Firefox

**Files included:**
- `chrome/` - Custom CSS theme (Potatofox-based)
- `user.js` - Potatofox theme settings + performance optimizations (NVIDIA GPU acceleration, memory management)
- `Sidebery-Data.json` - Sidebery extension configuration

## License

MIT

## Credits

- AGS by Aylur
- Hyprland by vaxry

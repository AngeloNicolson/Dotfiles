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

## Installation

```bash
git clone https://github.com/AngeloNicolson/Dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

The installer prompts for optional components, then handles everything:

```
Dotfiles Installer
==================

Select optional components to install:
  [y/n] NVIDIA drivers (VA-API, CUDA)?
  [y/n] Ollama AI (local LLMs, ~18GB model download)?
  [y/n] OpenTabletDriver (Wacom tablet support)?
  [y/n] Firefox (browser + custom CSS theme)?
  [y/n] Extras (kitty, ktouch, rnote)?
```

### What the installer does

| Module | Description |
|--------|-------------|
| `packages` | Installs from `packages/core.txt` + selected optional package files |
| `symlinks` | Symlinks config dirs and files into `$HOME` (backs up conflicts) |
| `scripts` | Makes all scripts executable |
| `templates` | Copies `.example` templates for machine-specific Hyprland configs |
| `dirs` | Creates supplementary dirs (pipewire filter-chain, shaders) |
| `services` | Enables systemd user services |
| `ags` | Runs `npm install` in AGS config, clears compiled bundle |
| `theme` | Applies default theme (mech) |
| `firefox` | Symlinks chrome/ + user.js into Firefox profile (optional) |
| `ollama` | Enables service, pulls qwen3-coder:30b (optional) |

### Running individual modules

```bash
./install.sh symlinks        # Only re-link configs
./install.sh theme           # Re-apply theme
./install.sh packages ags    # Multiple modules
```

The installer is idempotent — safe to re-run at any time.

### Package groups

Packages are split into files under `packages/`:

- `core.txt` — Always installed (hyprland, ags, foot, fish, neovim, pipewire, etc.)
- `nvidia.txt` — NVIDIA VA-API driver, ollama-cuda
- `ollama.txt` — Ollama (local LLM server)
- `tablet.txt` — OpenTabletDriver
- `firefox.txt` — Firefox
- `extras.txt` — kitty, ktouch, rnote

## Post-Installation

1. **Configure fish shell:**
   - Edit `~/.config/fish/system-local.fish` for machine-specific paths
   - Restart your shell

2. **Configure Hyprland:**
   - Edit `~/.config/hypr/custom/*.conf` for your machine (monitors, keybinds, rules)
   - Templates are created automatically from `.example` files
   - Reload: `hyprctl reload`

3. **Install Neovim plugins:**
   ```bash
   nvim --headless "+Lazy! sync" +qa
   ```

4. **Install tmux plugins:**
   ```bash
   git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
   # Then in tmux: prefix + I
   ```

5. **Set fish as default shell (optional):**
   ```bash
   chsh -s /usr/bin/fish
   ```

6. **Chromecast support (optional):**
   ```bash
   pipx install catt
   # Cast a video: catt cast /path/to/video.mkv
   # Cast to specific device: catt -d "Living Room" cast video.mkv
   ```

7. **Restore rnote settings (if using rnote):**
   ```bash
   dconf load /com/github/flxzt/rnote/ < ~/.config/rnote-dconf-settings.ini
   ```

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

### Switching Themes

```bash
~/.config/themes/apply-theme.sh mech
~/.config/themes/apply-theme.sh famicom
~/.config/themes/apply-theme.sh e-ink
```

The script automatically updates Foot, GTK, and Hyprland. Neovim syncs on startup via `~/.config/themes/.current`. Reload in Neovim with `:ReloadSystemTheme`.

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
- Custom overrides: `~/.config/hypr/custom/` (machine-specific, git-ignored)
- Templates: `~/.config/hypr/custom/*.conf.example`
- Layouts: `~/.config/hypr/layouts/`
- Applications database: `~/.config/hypr/apps.conf`

### Wacom Tablet

- See [README_WACOM.md](README_WACOM.md) for Wacom tablet setup (Intuos Pro)
- Uses OpenTabletDriver for best Wayland/Hyprland compatibility

### Firefox Custom CSS

Custom Firefox theme with auto-hiding navigation, centered URL bar, and Sidebery integration. The `firefox` install module handles symlinking automatically.

To set up Sidebery:
1. Install [Sidebery](https://addons.mozilla.org/en-US/firefox/addon/sidebery)
2. Import settings from `.mozilla/firefox/Sidebery-Data.json`
3. Restart Firefox

## License

MIT

## Credits

- AGS by Aylur
- Hyprland by vaxry

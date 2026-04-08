# Dotfiles

Personal configuration files for a Wayland desktop built on Hyprland, AGS, Neovim, and Fish.

## What's included

- **Hyprland** - Compositor with custom keybindings, window rules, and a layout manager
- **AGS** - Desktop UI (bar, app launcher, widgets, pomodoro, planner)
- **Neovim** - Editor with LSP, Treesitter, and AI coding assistants (CodeCompanion, Avante)
- **Fish + Starship** - Shell and prompt
- **Foot** - Terminal emulator
- **Tmux** - Terminal multiplexer with powerline
- **Theme System** - Unified colors across all apps (Mech, Famicom, E-Ink)
- **Firefox** - Custom CSS with auto-hiding navbar and Sidebery integration
- **Ollama** - Local AI/LLM server integrated with Neovim

## Installation

```bash
git clone https://github.com/AngeloNicolson/Dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

The installer detects your distro, prompts for optional components, then handles everything:

```
  ┌─────────────────────────────────────┐
  │       Dotfiles Installer            │
  │  hyprland · ags · neovim · fish     │
  └─────────────────────────────────────┘

  :: Detected distro: arch

  Optional components:

    NVIDIA drivers (VA-API, CUDA)? [y/n]
    Ollama (local LLMs, ~18GB download)? [y/n]
    OpenTabletDriver (Wacom tablet)? [y/n]
    Firefox (browser + custom CSS)? [y/n]
    Extras (kitty, ktouch, rnote)? [y/n]
```

### Modules

| Module | Description |
|--------|-------------|
| `packages` | Installs from `packages/<distro>/core.txt` + selected optional lists |
| `symlinks` | Symlinks config dirs and files into `$HOME` (backs up conflicts) |
| `scripts` | Makes all scripts executable |
| `templates` | Copies `.example` templates for machine-specific configs |
| `dirs` | Creates supplementary dirs (PipeWire, shaders) |
| `services` | Enables systemd user services |
| `ags` | Runs `npm install`, clears compiled bundle |
| `theme` | Applies default theme (mech) |
| `firefox` | Symlinks chrome/ + user.js into Firefox profile |
| `ollama` | Enables service, pulls AI model |

### Running individual modules

```bash
./install.sh symlinks        # Only re-link configs
./install.sh theme           # Re-apply theme
./install.sh packages ags    # Multiple modules
```

The installer is idempotent — safe to re-run at any time.

### Multi-distro support

Package lists live under `packages/<distro>/`:

```
packages/
  arch/
    core.txt
    nvidia.txt
    ollama.txt
    tablet.txt
    firefox.txt
    extras.txt
  ubuntu/        # Add lists for other distros
    core.txt
    ...
```

The installer detects the distro from `/etc/os-release` and uses the matching package manager. If no package list exists for the detected distro, it skips package install and continues with symlinks, templates, and everything else.

Supported package managers: pacman/yay/paru (Arch), apt (Ubuntu/Debian), dnf (Fedora), zypper (openSUSE), xbps (Void).

## Post-installation

1. **Edit machine-specific configs** (created from templates):
   - `~/.config/hypr/custom/*.conf` — monitors, keybinds, rules
   - `~/.config/fish/system-local.fish` — paths and env vars

2. **Install Neovim plugins:**
   ```bash
   nvim --headless "+Lazy! sync" +qa
   ```

3. **Install tmux plugins:**
   ```bash
   git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
   # Then in tmux: prefix + I
   ```

4. **Set fish as default shell:**
   ```bash
   chsh -s /usr/bin/fish
   ```

## Theme system

Three themes that synchronize colors across Foot, GTK, Hyprland, and Neovim:

- **Mech** — warm dark theme (gruvbox-inspired)
- **Famicom** — cream light theme (retro)
- **E-Ink** — pure monochrome

```bash
~/.config/themes/apply-theme.sh mech
~/.config/themes/apply-theme.sh famicom
~/.config/themes/apply-theme.sh e-ink
```

Neovim syncs on startup via `~/.config/themes/.current`. Reload in Neovim with `:ReloadSystemTheme`.

## Layout manager

Custom window layout system for Hyprland with predefined workspace arrangements:

- **Visual designer** — create layouts with a GTK GUI
- **Layout browser** — browse and preview saved layouts
- **Apply** — snap windows into a saved layout

Layouts: Study-Code, WebBrowsing, Blender, Math, Pure-Reading, and more.

See [ENVIRONMENT_LOADING.md](ENVIRONMENT_LOADING.md) for details.

## AI coding

Local AI integration via Ollama with GPU acceleration:

- **CodeCompanion** (Neovim) — `Space cc` chat, `Space ci` inline, `Space ca` actions
- **Avante** (Neovim) — `Space aa` sidebar, `Space ae` edit selection
- **Monolith** (CLI) — `monolith start`, `monolith status`

Requires a GPU with enough VRAM for the configured model. Model and VRAM requirements depend on your `ollama` setup.

## Keybindings

| Key | Action |
|-----|--------|
| `Super + Enter` | Terminal (foot) |
| `Super + A` | App launcher |
| `Super + Q` | Close window |
| `Super + F` | Firefox |
| `Super + T` | Kitty |

See `~/.config/hypr/keybindings.conf` for the full list.

## Firefox

Custom CSS theme with auto-hiding navigation, centered URL bar, and Sidebery tab sidebar.

To set up Sidebery:
1. Install [Sidebery](https://addons.mozilla.org/en-US/firefox/addon/sidebery)
2. Import settings from `.mozilla/firefox/Sidebery-Data.json`
3. Restart Firefox

## Wacom tablet

See [README_WACOM.md](README_WACOM.md) for tablet setup with OpenTabletDriver.

## License

MIT

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
git clone --depth 1 https://github.com/AngeloNicolson/Dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

(`--depth 1` is fine — wallpapers are not in git; the `wallpapers` module pulls
them from the `wallpapers-v1` release.)

The installer detects your distro, prompts for optional components, then handles everything.
Flags: `--dry-run` prints every change without touching the system, `--yes` runs
non-interactively (optional components come from `OPT_NVIDIA=y` etc.), and
`./install.sh doctor` audits a machine against what the config expects.

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
| `wallpapers` | Downloads wallpapers from the `wallpapers-v1` GitHub release (skips existing); generates a default if none |
| `nvim` | `Lazy! restore` — installs the exact plugin versions in `lazy-lock.json` |
| `tmux` | Clones tpm and installs tmux plugins |
| `shell` | `chsh` to fish (skips when already set / no TTY) |
| `hostconfig` | Runs `gen-host-config.sh` (monitors + scale) when inside a Hyprland session |
| `doctor` | Read-only audit: binaries, min versions, fonts, themes, templates, config parse, symlinks (exit 1 on problems) |
| `firefox` | Symlinks chrome/ + user.js into Firefox profile |
| `rnote` | Loads rnote dconf settings (extras) |
| `ollama` | Enables service, pulls AI model |
| `lock` | Regenerates `packages/arch/versions.lock` from the running system |

### Running individual modules

```bash
./install.sh symlinks        # Only re-link configs
./install.sh theme           # Re-apply theme
./install.sh packages ags    # Multiple modules
./install.sh --dry-run       # Show what a full install would do
./install.sh doctor          # Is this machine missing anything the config needs?
```

The installer is idempotent — safe to re-run at any time.

### New machine checklist

1. `./install.sh` (or `./install.sh --yes` unattended) — packages, symlinks, templates,
   plugins, shell, services, theme.
2. Log into Hyprland (`start-hyprland` from a TTY), then generate the monitor layout
   and scale for the displays actually connected:
   ```bash
   ~/.config/hypr/scripts/gen-host-config.sh && hyprctl reload
   ```
   This writes the gitignored `hypr/custom/monitors.conf` (resolution, DPI-derived
   scale snapped to an integer logical size, left-to-right layout) and sets
   `LAPTOP_SCALE` in `custom/env.conf`. Use `--dry-run` to preview, `--force` to
   regenerate, `--scale 1.5` to pin the laptop panel.
3. `./install.sh doctor` — fix anything it lists.

### Per-machine files (gitignored, created from `.example` templates)

| File | Purpose |
|------|---------|
| `hypr/custom/monitors.conf` | Generated monitor layout + scale (see above) |
| `hypr/custom/env.conf` | GPU backend env, `BACKLIGHT_DEVICE`, `LAPTOP_SCALE` |
| `hypr/custom/general.conf`, `rules.conf`, `keybinds.conf`, `execs.conf` | Local overrides, sourced last |
| `foot/host.ini` | Terminal font size / alpha for this screen (included last by `foot.ini`) |
| `fish/system-local.fish` | Paths and env vars |
| `swappy/config` | Screenshot save dir (swappy rewrites this file itself) |

### How sizing stays consistent across screens

Everything is authored against a 2048×1280 *logical* reference (2560×1600 @ 1.25)
and scales from there:

- **Hyprland** — `monitor = ,preferred,auto,1` is the universal fallback;
  `gen-host-config.sh` picks a scale from the panel's physical DPI.
- **AGS** — `scale.ts` computes one unit `U` from the focused monitor's logical
  short side and scales the whole stylesheet and JS-sized widgets (see
  `PORTABILITY_PLAN.md`).
- **foot** — `dpi-aware=no`, sizes in logical points so text tracks the compositor
  scale; bump per machine in `foot/host.ini`.
- **GTK** — no hardcoded `gtk-xft-dpi`; cursor theme/size come from one place
  (`Bibata-Modern-Ice`, 20) in both `gtk-3.0/4.0/settings.ini` and `hypr/theme.conf`.

### CI

`.github/workflows/ci.yml` runs on every push: shellcheck on the installer and
portability scripts, a fresh-user install of the non-package modules in an Arch
container, then `Hyprland --verify-config` and `foot --check-config` against the
resulting tree. If it goes red, the repo no longer installs cleanly on a machine
that isn't this one.

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

The `nvim`, `tmux` and `shell` modules now handle plugin install and `chsh`;
see the **New machine checklist** above for the two remaining manual steps
(generate the monitor config inside Hyprland, run the doctor). Plugin versions
are pinned by the tracked `nvim/lazy-lock.json` and `packages/arch/versions.lock`
(`./install.sh lock` refreshes the latter from a working system).

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

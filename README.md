# Dotfiles

Personal configuration files for a Wayland desktop built on Hyprland, AGS, Neovim, and Fish.

## What's included

- **Hyprland** - Compositor with custom keybindings, window rules, and a layout manager
- **AGS** - Desktop UI (bar, app launcher, widgets, pomodoro, planner)
- **Neovim** - Editor with LSP, Treesitter, nvim-dap and local AI (CodeCompanion chat + Minuet ghost text over Ollama)
- **Fish + Starship** - Shell and prompt
- **Foot** - Terminal emulator
- **Tmux** - Terminal multiplexer with powerline
- **Theme System** - Unified colors across all apps (Mech, Halo, K.I.T, Indy, Halloween)
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

The installer detects your distro, shows what is always installed, asks first
which machine this is (HP Omen Max 16? — auto-detected from DMI/USB, Enter
accepts), then a yes/no question per optional component (lock screen, idle
dimming, themed look, Neovim, tmux, media, wallpaper pack, NVIDIA, Firefox, …),
then handles everything. A machine profile is not optional: saying yes makes its
hardware pieces required (installed, and the doctor fails without them); saying
no drops them entirely. Answers are saved to a gitignored `install.conf` and
honoured by every later run (`packages`, `doctor`, `wallpapers`); edit or delete
it to be asked again.
Flags: `--dry-run` prints every change without touching the system, `--yes` runs
non-interactively (machine + components from `OPT_<NAME>=y|n` env → `install.conf`
→ auto-detect / defaults),
and `./install.sh doctor` audits a machine against what the config expects *for
the components you chose* — e.g. no lock screen selected, no complaint that
hyprlock is missing.

```
  ┌─────────────────────────────────────┐
  │       Dotfiles Installer            │
  │  hyprland · ags · neovim · fish     │
  └─────────────────────────────────────┘

  :: Detected distro: arch

  Always installed (required by the config):
    Hyprland, AGS shell, foot + fish, fonts, PipeWire, wallpaper daemon, ...

  Machine (hardware-specific pieces; required on a match, skipped otherwise)

    detected: OMEN MAX Gaming Laptop 16-ah0xxx
    Is this an HP Omen Max 16? Adds (required): per-key keyboard RGB stack, ... [Y/n]

  Optional components (Enter keeps the default shown; saved to install.conf)

    Themed look: adw-gtk3 GTK theme + Bibata cursor ... [Y/n]
    Idle management: lock + dim after 7 min, screen off after 77 min (hypridle) [Y/n]
    Lock screen: hyprlock on lid-close / power key (skip if you never lock) [y/N]
    Neovim: editor with LSP/Treesitter, plugins pinned by lazy-lock.json [Y/n]
    Tmux: multiplexer with powerline + tpm plugins [Y/n]
    ...
    Wallpaper pack: download ~2 GB of images/videos from the GitHub release [y/N]
    NVIDIA: VA-API driver (libva-nvidia-driver) [y/N]
    Ollama: enable the service + pull the model (ollama itself is a manual install) [y/N]
```

Each component maps to `packages/<distro>/<id>.txt` (the required set is
`core.txt`) and may switch installer modules on or off (`neovim` → plugin
restore, `tmux` → tpm, `firefox` → profile CSS, …). The machine profile works the
same way (`packages/arch/omen-max-16.txt` + the `omen` module, which also stages
the root-side files under `system/`; see `system/README.md`). Things the config calls
that belong to an optional component degrade when it is off: the lid-close and
power-key bindings go through `scripts/lock.sh`, which is a no-op without a
locker, and `hypridle` only starts if installed.

### Modules

| Module | Description |
|--------|-------------|
| `packages` | Installs from `packages/<distro>/core.txt` + selected optional lists |
| `symlinks` | Symlinks config dirs and files into `$HOME` (backs up conflicts) |
| `scripts` | Makes all scripts executable |
| `templates` | Copies `.example` templates for machine-specific configs |
| `dirs` | Creates supplementary dirs (PipeWire, shaders) |
| `services` | Enables the user units listed in `install.sh` (`bluetooth-autoconnect.service`, `monolith-reindex.timer`, plus `keyboard-reactive.service` on an Omen Max 16) — not every unit in the repo |
| `omen` | HP Omen Max 16 only (machine profile): omen-rgb tool, udev rules (RGB access, keyboard autosuspend off), EC keyboard-backlight switch (script + boot service + resume hook + acpi_call autoload) |
| `ags` | Runs `npm install`, clears compiled bundle |
| `theme` | Applies the default theme (mech) via `ags request theme` when AGS is running, plus dunst via `apply-theme.sh` |
| `wallpapers` | Downloads wallpapers from the `wallpapers-v1` GitHub release (skips existing); generates a default if none |
| `nvim` | `Lazy! restore` — installs the exact plugin versions in `lazy-lock.json` |
| `tmux` | Clones tpm and installs tmux plugins |
| `shell` | `chsh` to fish (skips when already set / no TTY) |
| `hostconfig` | Runs `gen-host-config.sh` (monitors + scale) when inside a Hyprland session |
| `update` | `git pull --ff-only` (refuses over uncommitted edits to tracked files), then re-runs only the modules whose inputs changed, reloads Hyprland / restarts AGS when inside a session, and ends with the doctor |
| `doctor` | Read-only audit: binaries, min versions, fonts, themes, templates, config parse, symlinks (exit 1 on problems) |
| `firefox` | Symlinks chrome/ + user.js into Firefox profile |
| `ollama` | Enables service, pulls AI model |
| `lock` | Regenerates `packages/arch/versions.lock` from the running system |

### Running individual modules

```bash
./install.sh symlinks        # Only re-link configs
./install.sh theme           # Re-apply theme
./install.sh packages ags    # Multiple modules
./install.sh --dry-run       # Show what a full install would do
./install.sh doctor          # Is this machine missing anything the config needs?
./install.sh update          # Pull the latest commits and apply what changed
```

The installer is idempotent — safe to re-run at any time.

### Updating an installed machine

```bash
~/dotfiles/install.sh update
```

Every config directory under `~/.config` is a symlink into the clone, so the
files themselves are updated by `git pull` — there is nothing to scan or copy.
The per-machine files (`hypr/custom/*.lua`, `foot/host.ini`,
`fish/system-local.fish`, `swappy/config`, `install.conf`) are gitignored, so a
pull can never touch them. `update` adds what a pull alone does not do:

- re-runs only the modules whose inputs changed (`packages/` → packages,
  `.config/ags/` → ags with `npm install` + bundle clear, `system/` → omen,
  `.example` files → templates, units → services, …), then the doctor;
- inside a session, `hyprctl reload` when `hypr/` changed and an AGS restart
  when `ags/` changed (the theme re-applies itself from `themes/.current`);
- warns when a `.example` template changed after your copy was made from it,
  with the `diff` to run — the copy is never overwritten;
- refuses to pull over uncommitted edits to tracked files, and warns when this
  clone has commits that were never pushed.

That last point is the usual reason a new machine comes up with an old UI: the
machine the config was edited on never ran `git push`. `./install.sh doctor`
reports unpushed commits on the machine you edit on, and commits behind the
remote on the ones that need an update.

### New machine checklist

1. `./install.sh` (or `./install.sh --yes` unattended) — packages, symlinks, templates,
   plugins, shell, services, theme.
2. Log into Hyprland (`start-hyprland` from a TTY), then generate the monitor layout
   and scale for the displays actually connected:
   ```bash
   ~/.config/hypr/scripts/gen-host-config.sh && hyprctl reload
   ```
   This writes the gitignored `hypr/custom/monitors.lua` (resolution, DPI-derived
   scale snapped to an integer logical size, left-to-right layout) and sets
   `LAPTOP_SCALE` in `custom/env.lua`. Use `--dry-run` to preview, `--force` to
   regenerate, `--scale 1.5` to pin the laptop panel.
3. `./install.sh doctor` — fix anything it lists.
4. Omen Max 16: reboot once if the installer said so (acpi_call loads at boot; until
   then the keyboard backlight needs Fn+F4 after boot or lid-open).

### Per-machine files (gitignored, created from `.example` templates)

| File | Purpose |
|------|---------|
| `hypr/custom/monitors.lua` | Generated monitor layout + scale (see above) |
| `hypr/custom/env.lua` | GPU backend env, `BACKLIGHT_DEVICE`, `LAPTOP_SCALE` |
| `hypr/custom/general.lua`, `rules.lua`, `keybinds.lua`, `execs.lua` | Local overrides, required last |
| `foot/host.ini` | Terminal font size / alpha for this screen (included last by `foot.ini`) |
| `fish/system-local.fish` | Paths and env vars |
| `swappy/config` | Screenshot save dir (swappy rewrites this file itself) |

### Hyprland config format (Lua)

Hyprland ≥ 0.55 reads `hypr/hyprland.lua` (the hyprlang `.conf` format is removed
in 0.57). The Lua tree mirrors the old split — `hyprland.lua`, `animations.lua`,
`keybindings.lua`, `rules.lua`, `theme.lua`, `lib.lua` (helpers), `custom/*.lua`
— and is validated by `Hyprland --verify-config` in CI and `install.sh doctor`.

Runtime scripts talk to Hyprland through `hypr/scripts/hypr-compat.sh`
(`hypr_set`, `hypr_monitor`, `hypr_dispatch`, `hypr_eval`) and AGS's
`compositor.ts` (`hyprSetOption`, `hyprDispatch`) — under Lua `hyprctl keyword`
no longer exists and `hyprctl dispatch` takes `hl.dsp.*` expressions, so these
helpers pick the right dialect for the running session.

### How sizing stays consistent across screens

Everything is authored against a 2048×1280 *logical* reference (2560×1600 @ 1.25)
and scales from there. The goal: on any machine and screen the bar, widgets and
overlays occupy the *same fraction* of the display. One number drives it —
`U = min(logical width, logical height) / 1280`, so `U = 1` here, ≈0.84 on a
1080p panel at scale 1, ≈1.69 on 4K at scale 1 — and nothing machine-specific
(monitor names, GPU env, backlight device) lives in a tracked file.

- **Hyprland** — `hl.monitor({ output = "", mode = "preferred", position = "auto", scale = 1 })`
  is the universal fallback; `gen-host-config.sh` picks a scale from the panel's
  physical DPI and writes the gitignored `custom/monitors.lua`; workspace → monitor
  pins, GPU env and autostart that depend on hardware live in `custom/*.lua`.
  Scripts detect the laptop panel / external by connector class, never by name.
- **AGS** — `scale.ts` computes `U` from the focused monitor's logical short
  side and scales the whole generated stylesheet with one regex pass (`px` →
  `px·U`) plus the JS-sized widgets via `px()`; windows on a second monitor with
  a different factor get a scoped copy of the px rules (`scopedCss`). Overlays
  open on the focused monitor, and GDK monitors are matched to Hyprland ones by
  geometry rather than index.
- **foot** — `dpi-aware=no`, sizes in logical points so text tracks the compositor
  scale; bump per machine in `foot/host.ini`.
- **GTK** — no hardcoded `gtk-xft-dpi`; cursor theme/size come from one place
  (`Bibata-Modern-Ice`, 20) in both `gtk-3.0/4.0/settings.ini` and `hypr/theme.lua`.

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
    firefox.txt
    zen.txt
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

Themes in `~/.config/themes/*.json` synchronize colors across the AGS shell,
Foot, GTK, Hyprland (gaps/borders/blur/opacity via `hypr/custom/theme.lua`),
Firefox, dunst and Neovim:

- **Mech** — warm dark theme (gruvbox-inspired)
- **Halo** — Halo / Xbox green
- **K.I.T** — monochrome (from 43PR, see the JSON's `_source` note)
- **Indy** — Indiana Jones
- **Halloween** — orange / green / purple

Switch from the AGS CORE page, the `SUPER+W` carousel, or the shell:

```bash
ags request theme mech
```

`ags/theme.ts` applies everything in-process and then runs
`~/.config/themes/apply-theme.sh <name>`, which only restyles dunst and pokes
running apps (foot `SIGUSR1`, nvim `:ReloadSystemTheme` over its server socket,
`SIGWINCH` to the TUIs). Neovim also syncs on startup via `~/.config/themes/.current`.

## AI coding

Local AI integration via Ollama with GPU acceleration:

- **CodeCompanion** (Neovim) — `Space ac` chat, `Space ai` inline, `Space ax`
  actions, `Space ae` explain, `Space ag` debug a GPU error, `Space am` pick the
  model; `/expert <engine|study|setup|code>` in the chat pulls from Monolith's indexes
- **Minuet** (Neovim) — FIM ghost text; `Space aV` toggle, `Alt+a` accept
- **Monolith** (CLI) — `monolith start`, `monolith status`, `monolith select`

Full key tables in `.config/nvim/README.md`.

Requires a GPU with enough VRAM for the configured model. Model and VRAM requirements depend on your `ollama` setup.

## Keybindings

Four modifier layers, defined in `hypr/keybindings.lua`:

| Layer | Meaning |
|-------|---------|
| `Super` | focus & navigate (windows, workspaces, desktop UI) |
| `Super+Shift` | move & send (push windows around) |
| `Super+Ctrl` | window properties (resize, float, pin, fullscreen, close) |
| `Right Alt` | launch apps (`lv3:ralt_switch` makes it a plain modifier, `MOD5`) |

`Caps Lock` is `Escape`. Local additions go in the gitignored
`hypr/custom/keybinds.lua` (template in `.example`).

The lists below are generated from the config, so the live versions are the
ones to trust: `Super + /` opens a searchable menu that also *runs* the
selected bind, `keys hypr` prints the same table in a terminal, `keys` prints
the terminal-side keys (foot, tmux, fish, Neovim) and `keys <word>` filters.
`keybinds <tool>` adds short hand-written sheets for bat, lazygit and yazi.

### Windows & workspaces

| Key | Action |
|-----|--------|
| `Super + H/J/K/L` | Focus window left / down / up / right |
| `Super + 1–7` | Go to workspace |
| `Super + Scroll` | Next / previous workspace |
| `Super + B / D / M / S` | Toggle the browser / document / media / plain scratchpad |
| `Super + N` | Neovim workspace (`open_nvim_workspace.sh`) |
| `Super + G` | Toggle the Kondor scratchpad |
| `Super + Shift + H/J/K/L` | Move window |
| `Super + Shift + 1–7` | Send window to workspace (stay) |
| `Super + Shift + B / D / M / N / S` | Send window to that scratchpad |
| `Super + Ctrl + H/J/K/L` or arrows | Resize (repeats while held) |
| `Super + Ctrl + W` | Toggle floating, centred (sized per app) |
| `Super + Ctrl + P` | Pin to all workspaces |
| `Super + Ctrl + Enter` | Fullscreen |
| `Super + Ctrl + T` | Toggle split direction (dwindle) |
| `Super + Ctrl + X` | Close window |
| `Super + left / right drag` | Move / resize with the mouse |

### Desktop UI (AGS)

| Key | Action |
|-----|--------|
| `Super + Q` | Show / hide the sidebar |
| `Super + Tab` / `Super + Shift + Tab` | Next / previous sidebar page |
| `Super + Space` | App launcher (rofi) |
| `Super + A` | Destination menu (fullscreen launcher) |
| `Super + Shift + A` | Galaxy overlay |
| `Super + P` | Planner / pomodoro edge panel on the focused screen |
| `Super + W` | Wallpaper carousel + theme picker |
| `Super + ,` | Settings window |
| `Super + Shift + P` | Display arranger: drag monitors, pin workspaces |
| `Super + T` | Periodic table |
| ``Super + ` `` | Power menu (wlogout) |
| `Super + /` | Keybind menu |
| `Super + I` | Screenshot: snip a region or click a window |
| `Super + Ctrl + I` | Screenshot: frozen-screen snip |
| `Super + Shift + I` | Screenshot: focused monitor |
| `Print` | Screenshot: all monitors |

### Apps (Right Alt)

| Key | Action |
|-----|--------|
| `Right Alt + Enter` | Terminal (foot) |
| `Right Alt + F` | Firefox |
| `Right Alt + B` | Zen on the browser overlay (`Super + B` just shows / hides it) |
| `Right Alt + W`, then `W` / `P` / `D` | qutebrowser work / personal / dev profile (`Esc` cancels) |
| `Right Alt + E` | File manager (nemo) |
| `Right Alt + N` | Blender |
| `Right Alt + A` | ArmorPaint |
| `Right Alt + Y` | ttyper |
| `Right Alt + V` | yt-x (YouTube in the terminal) |
| `Right Alt + C` | Cycle windows |
| `Right Alt + X` | Close window |
| `Right Alt + F4` | Kill a window (click it) |

### Hardware

| Key | Action |
|-----|--------|
| Brightness keys | Backlight up / down with OSD |
| Volume keys | PipeWire default sink ±5 %, mute |
| Calculator key | Cycle blur light / default / heavy ("transparency button") |
| Power button | Suspend (hypridle locks first) |
| `Super + Shift + Assistant` / Copilot key | Rotate the external monitor |
| Lid close / open | `lid-switch.sh` (see `hypr/scripts/README.md`) |

## Firefox

Custom CSS theme with auto-hiding navigation, centered URL bar, and Sidebery tab sidebar.

To set up Sidebery:
1. Install [Sidebery](https://addons.mozilla.org/en-US/firefox/addon/sidebery)
2. Import settings from `.mozilla/firefox/Sidebery-Data.json`
3. Restart Firefox

## License

MIT

## GPU & JVM debugging

Profiling/debugging toolchain for the C++/Vulkan engine (Kondor), CUDA, and the Clojure/XTDB side.

**Install** (component `gpu-debug`, off by default):

```sh
sudo pacman -S --needed $(sed 's/#.*//' packages/arch/gpu-debug.txt | grep -vE '^\s*$' | grep -vE '^(hotspot|async-profiler|tracy)$')
yay -S --needed hotspot async-profiler tracy      # AUR
```

**System files** (root-owned, staged under `system/`, see `system/README.md`): `etc/modprobe.d/nvidia-profiling.conf` lets non-root use GPU counters (`NVreg_RestrictProfilingToAdminUsers=0`, needs `sudo mkinitcpio -P` + reboot); `etc/sysctl.d/99-perf.conf` lowers `kernel.perf_event_paranoid` to -1 and `kptr_restrict` to 0 (`sudo sysctl --system`).

**Shell:** `JAVA_HOME` now follows `/usr/lib/jvm/default` (`archlinux-java`), not Android Studio's JBR. Android Studio keeps using its bundled JBR; Gradle honours `JAVA_HOME`.

**Kondor (C++) presets** — `CMakePresets.json` in the repo, all building to `build/<preset>/` so nvim cmake-tools / nvim-dap find `build/Debug/Kondor`:

```sh
cmake --preset Debug && cmake --build --preset Debug      # clangd + dap target (compile_commands.json -> build/Debug/)
cmake --preset RelWithDebInfo && cmake --build --preset RelWithDebInfo   # profile this one
cmake --preset ASan && cmake --build --preset ASan && ./build/ASan/Kondor   # address + UB sanitizer
cmake --preset TSan && cmake --build --preset TSan        # data races
```

`.clangd` reads `build/Debug`, `.clang-tidy` runs a modest bugprone/performance/modernize set. For non-CMake builds: `bear -- make` produces `compile_commands.json`.

**Vulkan validation layers** (settings dir created separately under `~/.config/vulkan/kondor-debug`):

```sh
VK_INSTANCE_LAYERS=VK_LAYER_KHRONOS_validation VK_LAYER_SETTINGS_PATH=~/.config/vulkan/kondor-debug ./build/Debug/Kondor
```

**Frame capture:** `renderdoccmd capture ./build/Debug/Kondor` or launch `qrenderdoc` and inject; `ngfx --activity="Frame Debugger" --exe ./build/RelWithDebInfo/Kondor` for Nsight Graphics (`nsight-graphics` GUI if installed).

**CPU / memory:**

```sh
heaptrack ./build/RelWithDebInfo/Kondor && heaptrack_gui heaptrack.Kondor.*.zst
perf record -g --call-graph dwarf ./build/RelWithDebInfo/Kondor && hotspot perf.data
```

**CUDA:**

```sh
compute-sanitizer --tool memcheck ./app          # also: racecheck, initcheck, synccheck
ncu --set full -o profile ./app                  # kernel profiler (needs the modprobe option above)
nsys profile -o timeline --trace=cuda,nvtx ./app # system timeline; open with nsys-ui
ASAN_OPTIONS=protect_shadow_gap=0 ./asan-build   # ASan + CUDA runtime: CUDA maps into the shadow gap otherwise
```

**Clojure / JVM** (aliases in `~/.clojure/deps.edn`: `:nrepl`, `:prof`, `:jfr`, `:portal`, `:test`):

```sh
cd ~/projects/personal/arcadia/spike0
clj -M:xtdb:nrepl            # writes .nrepl-port; Conjure (nvim) connects automatically
clj -M:xtdb:nrepl:prof       # + async-profiler and NativeMemoryTracking
clj -M:xtdb:jfr -m spike0.core   # flight recording -> recording.jfr; open in visualvm or `jfr print`
clj -X:test                  # cognitect test-runner
```

In the REPL with `:prof`: `(require '[clj-async-profiler.core :as prof]) (prof/profile (dotimes [_ 1e6] (work))) (prof/serve-ui 8080)` then open http://localhost:8080 for the flame graph. From a shell, `jcmd <pid> GC.heap_info`, `jcmd <pid> VM.native_memory summary` (needs the `:prof` alias's `-XX:NativeMemoryTracking=summary`), `jcmd <pid> JFR.start settings=profile duration=60s filename=rec.jfr`, or attach `visualvm` to the running JVM. `(require '[portal.api :as p]) (p/open) (add-tap #'p/submit)` with `:portal` for data inspection.

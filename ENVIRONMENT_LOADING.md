# Environment Loading System

## Overview

The environment loading system manages workspace-to-monitor bindings and launches application layouts on startup and during live environment switching.

## How It Works

### Workspace Rules
Workspaces are bound to monitors using Hyprland's workspace rules applied dynamically via:
```bash
hyprctl keyword workspace "WORKSPACE_ID,monitor:MONITOR_NAME"
```

This creates a **hot-applied** binding that:
- Takes effect immediately without config reload
- Ensures windows launched with `[workspace X silent]` open on the correct monitor
- Persists until Hyprland restart or rule change

### Environment Configuration

Environment configs are stored in `~/.config/hypr/layouts/environment_configs/` with structure:
```json
{
  "environment": "Main",
  "workspaces": [
    {
      "id": 1,
      "monitor": "HDMI-A-1",
      "layout": "/home/Angel/.config/hypr/layouts/Study-Code.json"
    }
  ]
}
```

### Loading Process

1. **Bind workspaces to monitors** using workspace rules
2. **Wait** for rules to apply (0.3s)
3. **Launch windows** silently on designated workspaces using layout files
   - Each window gets workspace assignment rules:
     * Terminals: workspace rule by title
     * GUI apps: workspace rule by class
4. **Return to workspace 1**

## Usage

### Startup (Automatic)
- Default environment set in `~/.config/hypr/layouts/default_environment.txt`
- Loaded via `exec-once` in `hyprland.conf`
- Runs `~/.config/hypr/scripts/load_default_environment.sh`

### Live Switching (Manual)
```bash
bash ~/.config/hypr/scripts/load_default_environment.sh
```

## Key Files

- `~/.config/hypr/scripts/load_default_environment.sh` - Main loading script
- `~/.config/hypr/layouts/default_environment.txt` - Points to default environment config
- `~/.config/hypr/layouts/environment_configs/*.json` - Environment definitions
- `~/.config/hypr/layouts/*.json` - Window layout files
- `~/.config/hypr/layouts/active_environment_state.json` - Current environment state

## Why Workspace Rules?

Previous approach used `workspace` + `moveworkspacetomonitor` dispatchers, which required **switching focus** to each workspace. This caused windows to open on the currently active workspace instead of their designated workspace.

Workspace rules solve this by:
- Pre-binding workspaces to monitors without switching focus
- Allowing `[workspace X silent]` to work correctly
- Enabling background workspace population on startup

## Window Workspace Assignment

Each window launched by the environment loader gets additional workspace assignment rules to ensure it opens on the correct workspace:

- **Terminals** (foot, kitty, alacritty, etc.):
  - Rule: `windowrulev2 = workspace {workspace_id},title:^{window_title}$`
  - Matches by unique window title set via `--title` flag

- **GUI Applications** (firefox, rnote, etc.):
  - Rule: `windowrulev2 = workspace {workspace_id},class:({app_class})`
  - Matches by application class
  - Note: Multiple instances of same app get same rule (last one wins)

These rules complement the workspace-to-monitor bindings to ensure windows open both:
1. On the correct workspace (via workspace rule)
2. On the correct monitor (via workspace-to-monitor binding)

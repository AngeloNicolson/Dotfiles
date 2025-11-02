# AGS Configuration Documentation

Documentation for custom AGS (Aylur's GTK Shell) configuration.

## Features

### [Pomodoro Timer](./pomodoro.md)
Feature-rich pomodoro timer with music playback, theme support, and study block management.

- Single session and study block modes
- Background music with fade in/out
- Multiple music themes
- Volume control
- Pause/resume functionality
- Visual progress tracking

## Directory Structure

```
ags/
├── assets/          # Assets (music, images, etc.)
├── docs/            # Documentation
├── services/        # Custom services (Pomodoro, etc.)
├── shared/          # Shared utilities and variables
└── windows/         # Window components (bar, sidebar, etc.)
```

## Adding New Features

1. Create service in `services/` if needed
2. Add UI components in `windows/`
3. Document in `docs/`
4. Update this README with link

## Dependencies

See main dotfiles `packages.txt` for full dependency list.

Key dependencies for this config:
- `ags` - Aylur's GTK Shell
- `mpv` - Media player (for pomodoro audio)
- `socat` - Socket communication (for audio control)

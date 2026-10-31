# Theme System

Unified theme management for consistent colors across all applications.

## Usage

Apply a theme:
```bash
./apply-theme.sh mech
./apply-theme.sh halo
./apply-theme.sh halloween
```

The current theme is stored in `.current` and automatically applied to:
- **Foot** - Terminal emulator colors
- **GTK** - System theme, icons, cursor
- **Hyprland** - Window borders, gaps, rounding
- **Neovim** - Colorscheme (auto-synced on startup)

## Theme Files

Each theme is defined in a JSON file with:

```json
{
  "name": "theme-name",
  "displayName": "Theme Display Name",
  "colors": {
    "bg": "#background",
    "fg": "#foreground",
    // ... full color palette
  },
  "gtk": {
    "theme": "GTK-Theme-Name",
    "iconTheme": "Icon-Theme-Name",
    "cursorTheme": "Cursor-Theme-Name",
    "colorScheme": "prefer-dark|prefer-light"
  },
  "hyprland": {
    "borderRadius": 0,
    "gapsIn": 0,
    "gapsOut": 0,
    "borderSize": 1
  }
}
```

## Available Themes

- **Mech** — warm dark theme (gruvbox-inspired); general use, coding
- **Halo** — Halo / Xbox green; hand-made Neovim scheme; keyboard: translucent
  olive, visor lock animation
- **K.I.T** — monochrome (from 43PR); keyboard: Dr Pepper red, Knight Rider
  scanner lock animation
- **Indy** — Indiana Jones palette
- **Halloween** — orange / slime green / purple; keyboard: bruise violet with
  sickly green highlights, blood-on-black lock animation

Keyboard keys live under `look`: keyboardStyle (theme|drpepper|translucent),
keyboardColor, keyboardHighlight, keyboardBrightness, keyboardSleep,
keyboardSleepHighlight, keyboardSleepAnimation (kitt|blood|visor) — see
keyboard-lights.py and keyboard-kitt.py.

## Creating New Themes

1. Copy an existing theme JSON file
2. Modify colors and settings
3. Create matching Neovim colorscheme in `~/.config/nvim/colors/`
4. Update colorscheme map in `~/.config/nvim/lua/plugins/themesetup.lua`

## Neovim Integration

Neovim automatically detects the current theme by reading `.current` file.

After changing theme, reload in Neovim:
```vim
:ReloadSystemTheme
```

Or restart Neovim to apply changes.

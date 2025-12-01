# Theme System

Unified theme management for consistent colors across all applications.

## Usage

Apply a theme:
```bash
./apply-theme.sh mech
./apply-theme.sh famicom
./apply-theme.sh e-ink
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

### Mech (Dark)
- Gruvbox-inspired warm dark theme
- High contrast for readability
- Best for: General use, coding

### Famicom (Light)
- Retro gaming aesthetic
- Cream background with vibrant colors
- Best for: Daytime use, creative work

### E-Ink (Monochrome)
- Pure black and white
- Minimal visual distractions
- Best for: Focus work, battery saving, e-ink displays

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

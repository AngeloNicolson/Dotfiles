# AGS v3 Configuration

## Dependencies

```bash
# Required
sudo pacman -S bluez bluez-utils brightnessctl dunst gammastep

# Wallpaper system
sudo pacman -S swww mpvpaper ffmpeg socat

# Enable bluetooth
sudo systemctl enable --now bluetooth.service
```

### Optional: AI Video Upscaling
```bash
yay -S video2x-git    # Upscale video wallpapers to 4K using Real-ESRGAN
```

## Current Status

### Working
- **Bar toggle** - `Super+Q` opens/closes the sidebar
- **Bar visibility** - Slides in/out from the left edge
- **Click toggle** - Click the edge strip to toggle bar

### In Progress
- **Page cycling** - `Super+Tab` to cycle through pages (Gtk.Stack transitions not working reliably)

## Critical Setup Requirements

### 1. File Extension
- **Must use `.tsx`** for JSX support, not `.ts`
- AGS bundler won't parse JSX in `.ts` files

### 2. Window Visibility
- Windows are **NOT visible by default** in GTK
- Always add `visible` prop to `<window>`:
```tsx
<window visible ...>
```

### 3. Monitor Binding
- Use `monitor={0}` (number) not `gdkmonitor={gdkMonitor}` (object)
- Monitor 0 is the primary display

### 4. Request Handler
- `request` parameter is an array: `request: string[]`
- Access command with `request[0]`

## Minimal Working Example
```tsx
import app from "ags/gtk3/app"
import { Astal } from "ags/gtk3"

function Bar(monitor = 0) {
  const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor

  return (
    <window
      visible
      monitor={monitor}
      anchor={TOP | LEFT | BOTTOM}
      application={app}
    >
      <box css="background: #282828; padding: 20px;">
        <label css="color: white;" label="Hello AGS v3" />
      </box>
    </window>
  )
}

app.start({
  requestHandler(request: string[], response: (res: string) => void) {
    response(`unknown: ${request[0]}`)
  },
  main() {
    Bar(0)
  },
})
```

## Running
```bash
ags run ~/.config/ags/app.tsx
```

## Keybinds (in ~/.config/hypr/keybindings.conf)
- `Super+Q` - Toggle bar visibility
- `Super+Tab` - Cycle sidebar pages

## Known Issues
- Gtk.Stack `slide_left_right` transition not animating smoothly
- Need to investigate proper reactive state binding for stack children

## V2 Reference
Original config archived at: `dotfiles/archive/ags-v2/`

## Files
- `app.tsx` - Main entry point
- `tsconfig.json` - TypeScript config
- `package.json` - Dependencies
- `style.css` - Styles (currently using inline CSS)
- `components/WallpaperSelector.tsx` - Wallpaper selection with live/static tabs

## Wallpaper System

The wallpaper selector (WALL tab in sidebar) supports both static images and live video wallpapers.

### Static Wallpapers
- **Location**: `~/.config/ags/wallpapers/` or `~/.config/swww/`
- **Formats**: `.jpg`, `.jpeg`, `.png`, `.webp`
- **Backend**: swww with wipe transition

### Live Wallpapers
- **Location**: `~/Videos/`
- **Formats**: `.mp4`, `.webm`, `.mkv`, `.avi`, `.mov`
- **Backend**: mpvpaper
- **Features**:
  - Auto-generates thumbnails (cached in `~/.cache/ags/video-thumbs/`)
  - Fade-in transition on wallpaper change (not on loop/restart)
  - Fullscreen with `panscan=1.0` (crops to fill screen)
  - Seamless looping

### Transitions
- **Static → Live**: swww fades to black → mpvpaper starts with fade-in
- **Live → Static**: mpvpaper killed → swww-daemon starts → wallpaper applied
- **Live → Live**: Fade-in on new selection, no fade on same wallpaper

### AI Upscaling (Optional)
Upscale video wallpapers to 4K using video2x:
```bash
video2x -i input.mp4 -o output_4k.mp4 -p realesrgan -s 3 -c libx264
```
- `-s 2` = 2x scale (1080p → 4K needs `-s 2` or 720p → 4K needs `-s 3`)
- Uses Real-ESRGAN model for quality upscaling

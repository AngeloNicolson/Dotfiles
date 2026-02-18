# AGS v3 Configuration

## Dependencies

```bash
# Required
sudo pacman -S bluez bluez-utils brightnessctl dunst gammastep

# Wallpaper system
sudo pacman -S swww mpvpaper ffmpeg socat

# Audio EQ (PipeWire filter-chain)
sudo pacman -S pipewire wireplumber

# Display controls (color temperature, gamma, RGB shaders)
yay -S wl-gammarelay-rs hyprshade

# Enable bluetooth
sudo systemctl enable --now bluetooth.service

# Create PipeWire filter-chain config directory
mkdir -p ~/.config/pipewire/filter-chain.conf.d
```

### Hyprland exec-once (add to ~/.config/hypr/custom/execs.conf)
```
exec-once = wl-gammarelay-rs
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

## Destination Menu (Director)

A Destiny 2-inspired fullscreen app launcher with a space/sci-fi aesthetic.

### Keybinds
- `Super+D` - Toggle Destination Menu
- `Super+G` - Toggle Galaxy Overlay
- `Escape` - Close either overlay

### Features

#### Parallax Effect
- **Background nebula** moves slowly (distant layer)
- **Stars** move at varying depths based on z-value
- **Destinations** move at different rates (left sidebar moves as a group)
- **Corner decorations** shift subtly
- Movement is **inverted** (mouse right = elements shift left) for depth illusion

#### Layout (Destiny 2 Director Style)
```
     [APPS]          [BROWSER]        [CODE]
        ●               ●                ●

 ☰ ←sidebar     [TOWER]        ○ GALAXY
 ☰              ● center
 ☰                            [SYSTEM]
 ☰                                ●

     [FILES]      [TERMINAL]      [GAMES]
        ●             ●              ●
```

#### Destinations
| Position | Name | Function |
|----------|------|----------|
| Top-left (large) | APPS | App launcher submenu |
| Top-center | BROWSER | Firefox/Chromium submenu |
| Top-right (large) | CODE | VS Code/Neovim submenu |
| Center | TOWER | Toggle sidebar |
| Right of center | GALAXY | Switch to Galaxy overlay |
| Right | SYSTEM | System settings submenu |
| Bottom-left (large) | FILES | File manager submenu |
| Bottom-center (large) | TERMINAL | Opens foot terminal |
| Bottom-right | GAMES | Steam/Lutris submenu |
| Left sidebar | Quick icons | Music, Config, Network, Power |

#### Sub-menus
Click a destination with ▼ indicator to open its sub-menu:
- Apps in an arc layout
- Back button on left side
- Same visual style as main menu

#### Cursor Behavior
- **Normal cursor**: Dark ring with hollow center
- **Hover cursor**: Bright blue filled circle with white center dot
- Planets/destinations do NOT change appearance on hover

#### Auto-close Behavior
Director closes automatically when:
- Launching any app
- Changing workspaces
- Clicking outside / focus loss
- Pressing Escape

### Configuration

#### Background Image
Edit `components/DestinationMenu.tsx` line 8:
```tsx
const BG_IMAGE_PATH = `${GLib.get_user_config_dir()}/ags/assets/director/nebula2.jpg`
```
Available backgrounds in `~/.config/ags/assets/director/`:
- `nebula1.jpg`
- `nebula2.jpg`

#### Customizing Destinations
Edit the `DESTINATIONS` array in `components/DestinationMenu.tsx`:
```tsx
{
  id: "apps",           // Unique identifier
  label: "APPS",        // Display name
  icon: "",            // Nerd font icon
  x: 0.18,              // X position (0-1)
  y: 0.22,              // Y position (0-1)
  size: 2.2,            // Size multiplier
  ringStyle: "planet",  // "planet" | "icon" | "central"
  command: "...",       // Direct command (optional)
  subItems: [...]       // Sub-menu items (optional)
}
```

#### Parallax Intensity
In `components/DestinationMenu.tsx`:
- Background: `parallaxX * 8` (line ~324)
- Stars: `parallaxX * 30 * star.z` (line ~340)
- Destinations: `parallaxX * 40 * depthFactor` (line ~348)

### Files
```
components/
├── DestinationMenu.tsx   # Main director UI
├── DestinationWindow.tsx # Window wrapper with keybinds
├── GalaxyOverlay.tsx     # Orbiting planets overlay
└── GalaxyWindow.tsx      # Galaxy window wrapper

assets/
└── director/
    ├── nebula1.jpg       # Background option 1
    └── nebula2.jpg       # Background option 2
```

## Galaxy Overlay

An alternative overlay with orbiting planets animation.

### Features
- Planets orbit around a central node
- 3 orbit rings at different distances
- Custom circular cursor
- Same auto-close behavior as Director

### Keybind
- `Super+G` - Toggle Galaxy Overlay
- Can also be accessed from Director via GALAXY destination

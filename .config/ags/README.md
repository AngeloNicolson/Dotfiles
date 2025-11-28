# AGS v3 Configuration

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

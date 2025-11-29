# Hyprland Scripts

## lid-switch.sh

Handles laptop lid open/close events for dual monitor setup.

### What it does

**When closing the lid:**
1. Moves all workspaces (1-5) from the laptop screen (eDP-1) to the external monitor (HDMI-A-1)
2. Disables the laptop screen entirely
3. Repositions the external monitor to position 0x0 (making it the primary display)

**When opening the lid:**
1. Re-enables the laptop screen at its configured resolution and position
2. Repositions the external monitor back to its original position (2048x0, to the right of the laptop screen)
3. Turns on the laptop screen display
4. Moves workspaces 2-5 back to the laptop screen (workspace 1 stays on external monitor)

### Why this approach

The script uses `hyprctl keyword monitor "eDP-1, disable"` instead of just turning off the display with DPMS because:
- Disabling removes the monitor from the layout entirely, allowing the external monitor to use the full coordinate space
- This prevents overlap warnings when the laptop lid reopens
- Moving workspaces before disabling prevents windows from being orphaned

### Usage

Automatically triggered by Hyprland lid switch events via bindings in `hyprland.conf`:

```
bindl = , switch:on:Lid Switch, exec, ~/.config/hypr/scripts/lid-switch.sh close
bindl = , switch:off:Lid Switch, exec, ~/.config/hypr/scripts/lid-switch.sh open
```

### Monitor Configuration

Requires the following monitor setup in `hyprland.conf`:

```
monitor = eDP-1,2560x1600@240,0x0,1.25          # Laptop screen at top-left
monitor = HDMI-A-1,1920x1080@60,2048x0,1        # External monitor to the right
```

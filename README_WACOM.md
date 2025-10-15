# Wacom Tablet Setup (Intuos Pro)

This guide covers setting up a Wacom tablet (specifically Intuos Pro) on Arch Linux with Hyprland using OpenTabletDriver.

## Why OpenTabletDriver?

OpenTabletDriver (OTD) is recommended over the default kernel driver (`xf86-input-wacom`) because:

- Native Wayland support (works perfectly with Hyprland)
- Lower latency and better performance
- Rich GUI for configuration
- Advanced features: smoothing filters, area mapping, per-app profiles
- Active development and community support

## Installation

The package is already included in `packages.txt`:

```bash
sudo pacman -S --needed opentabletdriver
```

## Setup

### 1. Enable and Start the Service

```bash
# Enable the service to start on boot
systemctl --user enable opentabletdriver.service

# Start the service now
systemctl --user start opentabletdriver.service
```

### 2. Verify Detection

Check that your tablet is detected:

```bash
systemctl --user status opentabletdriver.service
```

The service should be active and running.

### 3. Configure the Tablet

Launch the GUI configuration tool:

```bash
otd-gui
```

In the GUI you can:
- Map tablet area to screen area
- Adjust pressure curve
- Configure express keys and touch ring
- Set up per-application profiles
- Apply smoothing filters

### 4. Optional: Prevent Kernel Driver Conflicts

If you experience conflicts (tablet not responding or double input), blacklist the kernel driver:

```bash
# Create blacklist file
sudo tee /etc/modprobe.d/blacklist-wacom.conf << EOF
blacklist wacom
blacklist hid_wacom
EOF

# Rebuild initramfs
sudo mkinitcpio -P

# Reboot for changes to take effect
sudo reboot
```

**Note:** This is usually not necessary. Try using OTD first without blacklisting.

## Hyprland Configuration

OpenTabletDriver works out of the box with Hyprland. For advanced tablet-specific settings, you can add to `~/.config/hypr/custom/general.conf`:

```conf
# Optional: Tablet-specific input settings
device {
    name = opentabletdriver-virtual-tablet
    # Add any Hyprland-specific tablet settings here if needed
}
```

## Troubleshooting

### Tablet Not Detected

```bash
# Check if tablet is connected
lsusb | grep -i wacom

# Restart the service
systemctl --user restart opentabletdriver.service

# Check service logs
journalctl --user -u opentabletdriver.service -f
```

### Conflicts with Kernel Driver

If the tablet behaves erratically:

1. Check if kernel driver is loaded:
   ```bash
   lsmod | grep wacom
   ```

2. If loaded, temporarily disable it:
   ```bash
   sudo rmmod wacom
   sudo rmmod hid_wacom
   ```

3. If that fixes it, blacklist permanently (see step 4 above)

### Pressure Not Working

1. Open `otd-gui`
2. Go to "Pen Settings"
3. Adjust the pressure curve
4. Test in an application like Krita or GIMP

### Reverting to Kernel Driver

If you need to revert to the kernel driver:

```bash
# Stop and disable OTD
systemctl --user stop opentabletdriver.service
systemctl --user disable opentabletdriver.service

# Remove blacklist (if you created it)
sudo rm /etc/modprobe.d/blacklist-wacom.conf
sudo mkinitcpio -P

# Reboot
sudo reboot
```

## Testing

Test your tablet in drawing applications:

- **Krita** - Full-featured digital painting
- **GIMP** - Image editing with tablet support
- **Inkscape** - Vector graphics with pressure sensitivity
- **Xournal++** - Note-taking and annotation

## Resources

- [OpenTabletDriver GitHub](https://github.com/OpenTabletDriver/OpenTabletDriver)
- [OpenTabletDriver Wiki](https://opentabletdriver.net/)
- [Hyprland Wiki - Tablets](https://wiki.hyprland.org/Configuring/Keywords/#per-device-input-configs)

# system/ — root-owned files to stage by hand

Nothing here is symlinked by `install.sh`; these live outside `$HOME` and need
root. Copy them in with `install` (keeps mode/owner sane), then activate.

## GPU profiling counters (Nsight Compute / Nsight Systems)

```sh
sudo install -m644 system/etc/modprobe.d/nvidia-profiling.conf /etc/modprobe.d/nvidia-profiling.conf
sudo mkinitcpio -P      # nvidia modules are in the initramfs, so the option must be baked in
# reboot (the module option is read at driver load; rmmod nvidia is not practical on a laptop)
```

Check after reboot: `cat /proc/driver/nvidia/params | grep RestrictProfilingToAdminUsers` -> `0`.

## perf / hotspot / async-profiler

```sh
sudo install -m644 system/etc/sysctl.d/99-perf.conf /etc/sysctl.d/99-perf.conf
sudo sysctl --system    # applies immediately, no reboot
```

Check: `sysctl kernel.perf_event_paranoid kernel.kptr_restrict` -> `-1` and `0`.

Both settings loosen security slightly (any local user can profile the GPU and
sample the kernel). Fine for a single-user dev laptop; don't stage on shared boxes.

## hyprlock without the 3-second wrong-password pause

`etc/pam.d/hyprlock` replaces the stock one-liner (`auth include login`) with the
same chain but `pam_unix.so nodelay`, so the lock screen reports a wrong
password immediately. faillock still applies (3 misses in 15 min = 10 min lock).

```sh
sudo install -m644 system/etc/pam.d/hyprlock /etc/pam.d/hyprlock
```

No reload needed; the next unlock uses it. Revert with `sudo pacman -S hyprlock`
(it owns the original file) or restore the one-liner by hand.

## Keyboard RGB (Omen Max 16, HP Gaming Keyboard II 0d62:54bf)

Handled by `./install.sh`'s `omen` module, which runs when the setup screen's
"Is this an HP Omen Max 16?" is answered yes (auto-detected from DMI board 8D41 /
USB 0d62:54bf; saved in install.conf as `omen-max-16=y`). Everything in it is
required on that machine. It clones arfelious/omen-rgb-linux to
`~/projects/personal/omen-rgb-linux-src`, installs it with `uv tool install`
(+ evdev), installs the udev rules (`70-omen-rgb.rules` below and
`50-hp-keyboard-nosuspend.rules`, which turns USB autosuspend off for the
keyboard — it drops keys, backspace especially, after long sessions otherwise),
stages the EC backlight switch (next section), and the services module enables
`keyboard-reactive.service`. By hand:

```sh
cd ~/projects/personal/omen-rgb-linux-src && uv tool install . \
  && uv pip install --python ~/.local/share/uv/tools/omen-rgb/bin/python evdev
sudo install -m644 system/etc/udev/rules.d/70-omen-rgb.rules system/etc/udev/rules.d/50-hp-keyboard-nosuspend.rules /etc/udev/rules.d/
sudo udevadm control --reload && sudo udevadm trigger --subsystem-match=usb --subsystem-match=hidraw --subsystem-match=input
systemctl --user enable --now keyboard-reactive.service
```

The rule grants the login session the USB device node (omen-rgb's bundled
hidapi is the libusb build), the hidraw nodes, and the keyboard's input event
nodes (the reactive daemon reads key presses over evdev).

What runs: every theme switch applies the theme's layout (`keyboard-lights.py`,
look.keyboardStyle/Color/Highlight/Brightness in the theme JSON; the keyboard
stores it in flash so it survives reboots); `keyboard-reactive.service` flashes
pressed keys, shows Super keybind hints and crossfades the layout in from the
theme's lock look after a wake (hypridle's after_sleep_cmd sends it SIGUSR2);
`kitt` runs the lock-screen animation — one per theme via look.keyboardSleepAnimation:
`kitt` K.I.T.T. scanner (kit), `blood` blood runs on a black board (halloween),
`visor` Master Chief's visor with a sweeping glint (halo); base/head from the theme's keyboard style, override
with look.keyboardSleep / look.keyboardSleepHighlight; while locked the
first typed key (hyprlock says "Press Space to start"; lock.sh holds Hyprland in
the `locked` submap so Space is swallowed, not typed; kitt resets it once entry
mode starts so later Spaces type, and re-enters it when the scanner resumes) stops the scanner and
lights the keypad digits for password entry (Escape or 30 s idle resumes the
scanner; $XDG_RUNTIME_DIR/kitt.entry flags entry mode for the hyprlock label)
and lock.sh runs it while locked. The bottom light bar needs the patched hp-wmi
driver from omen-fan-control plus acpi_call; not set up.

### The backlight power switch (dark after boot / lid open)

The LEDs' power switch is not in the RGB controller but in the embedded
controller (EC) — it is what Fn+F4 toggles — and it comes up OFF after a cold
boot and after s2idle suspend (lid close). The USB interface cannot flip it:
the controller acks every command and reports "lit" (`0x80` status byte `0xC8`)
while the board stays dark (verified 2026-10-31 with `0x09 01`+pages and `0x0C`).
Omen Gaming Hub turns it on through HP's WMI BIOS method
(`\_SB.WMID.WMAA`, command `0x20009`, query `0x05`, byte `0xE4`; the hp-wmi
keyboard-backlight patches use the same call but only register 1/4-zone
boards), so `system/usr/local/bin/omen-kbd-backlight on|off|status|wait-on`
makes that call through acpi_call. Installed by the `omen` module (`acpi_call`,
extra, prebuilt for the stock kernel, is in `packages/arch/omen-max-16.txt`); a
kernel upgrade in the same run means the module only loads after a reboot. By hand:

```sh
sudo pacman -S acpi_call && sudo modprobe acpi_call
sudo install -m755 system/usr/local/bin/omen-kbd-backlight /usr/local/bin/
sudo install -Dm755 system/etc/systemd/system-sleep/omen-kbd-backlight /etc/systemd/system-sleep/omen-kbd-backlight
sudo install -m644 system/etc/systemd/system/omen-kbd-backlight.service /etc/systemd/system/
sudo install -m644 system/etc/modules-load.d/acpi_call.conf /etc/modules-load.d/
sudo systemctl daemon-reload && sudo systemctl enable --now omen-kbd-backlight.service
```

`omen-kbd-backlight.service` switches it on at boot; the systemd-sleep hook
(`post`) switches it on as the machine wakes, before logind announces the wake,
so hypridle's after_sleep_cmd fade-in lands on a lit board. `sudo
omen-kbd-backlight status` reads the EC state. Fn+F4 still toggles by hand.

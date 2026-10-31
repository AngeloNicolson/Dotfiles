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

The per-key controller is a USB HID device, not an hp-wmi LED, so the tool is
arfelious/omen-rgb-linux (clone at `~/projects/personal/omen-rgb-linux-src`).
Its bundled hidapi is the libusb build, so the udev rule must open the USB
device node, not just hidraw.

```sh
cd ~/projects/personal/omen-rgb-linux-src && uv tool install .
sudo install -m644 system/etc/udev/rules.d/70-omen-rgb.rules /etc/udev/rules.d/
sudo udevadm control --reload && sudo udevadm trigger --subsystem-match=usb --subsystem-match=hidraw
omen-rgb static '#6FBE44'        # omen-rgb effect list for the MCU's own animations
```

Every theme switch then sets the keyboard to the theme accent (apply-theme.sh).
The bottom light bar needs the patched hp-wmi driver from omen-fan-control plus
acpi_call; not set up.


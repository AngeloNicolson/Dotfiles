# Dotfiles Portability & Responsive-Scaling Plan

**Status: IMPLEMENTED** (branch `portability`). This documents the design; all
phases below are done. Two deviations from the original plan: (1) the host-specific
Hyprland convention (`custom/*.conf` gitignored + `.example` templates) already
existed, so Phase 1 moved the hardcoded values *out of* the tracked `hyprland.conf`
into it rather than inventing a new `host.conf`; (2) Phase 3 scales the whole
stylesheet with a single regex pass (`scaleCss`) over the generated CSS instead of
hand-editing 846 literals.

**Goal:** run on any machine / any screen size and look the *same screen fraction* —
the bar, widgets, and overlays occupy the same proportion of the display regardless
of resolution or DPI.

**Reference baseline (this machine):** `eDP-1` 2560×1600 @ scale 1.25 → **logical
2048×1280**. All existing px values were authored against that logical space.
`min(logical) = 1280`. This becomes `BASELINE_MIN`.

---

## Architecture: one scale unit `u`

Everything responsive flows from a single number computed from the target monitor:

```
u = min(monitorLogicalWidth, monitorLogicalHeight) / BASELINE_MIN   // 1280
```

- On this machine `u = 1.0` → pixel-identical to today (zero visual regression).
- On a 1920×1080 @ scale 1 screen: `min = 1080`, `u ≈ 0.844` → everything shrinks
  proportionally and keeps the same screen fraction.
- On a 4K @ scale 1: `min = 2160`, `u ≈ 1.69` → scales up.

A monitor's *logical* size = pixel size ÷ its Hyprland/GTK scale. Read it from
`AstalHyprland` monitor (`get_width`/`get_height`/`get_scale`) or Gdk geometry.

**Multi-monitor caveat:** `app.apply_css()` is global (one sheet for all windows).
With mixed-size monitors a single `u` is a compromise. Decision: compute `u` from
the **focused** monitor and regenerate CSS on `notify::focused-monitor`
(cheap — it's a string rebuild). Document this; it's the only honest option without
per-window stylesheets.

---

## Phase 0 — Scale module (new file `ags/scale.ts`)

- `BASELINE_MIN = 1280` constant.
- `currentMonitor()` → focused/primary AstalHyprland monitor.
- `computeU(mon)` → the ratio above, clamped to e.g. `[0.6, 2.5]` for sanity.
- `export let U` + `recomputeU()` that updates it and is called from the
  monitor-change listeners already in `app.tsx`.
- Helpers: `px(n) => Math.round(n * U)` and `pxs(n) => \`${px(n)}px\`` for CSS.
- A `subscribe(cb)` so widgets that build their own inline CSS / cairo sizes can
  re-render when `U` changes.

This is the contract everything else consumes.

---

## Phase 1 — Hyprland portability (highest impact, lowest effort)

The single biggest blocker: monitors are hardcoded by name + resolution.

1. **Universal fallback first.** Add at the top of monitor config:
   `monitor = , preferred, auto, 1` so *any* unknown monitor on *any* machine
   lights up sensibly. Specific overrides below it still win.
2. **Split host-specific monitor config out.** Move the `eDP-1` / `HDMI-A-1` /
   `DP-1`/`DP-2` blocks (`hyprland.conf:5-10`, `custom/general.conf:7-14`) into
   `hypr/host.conf`, `source =`d at the end. Gitignore `hypr/host.conf`; commit a
   `hypr/host.conf.example`. New machine = copy example, edit once.
3. **De-hardcode workspace→monitor pins.** `workspace = 7, monitor:DP-1` etc.
   (`hyprland.conf:17-22`, `custom/rules.conf:29-33`, `rules.conf:14-15`) move into
   the same host file. Default workspaces should not name a monitor.
4. **GPU/backlight detection.** `hyprland.conf:66-70` (nvidia env) and `:44`
   (`brightnessctl -d intel_backlight set 20%`) are machine-specific. Move the
   nvidia env block into `host.conf`; replace the backlight line with a tiny
   `scripts/init-backlight.sh` that picks the first device from
   `brightnessctl -l` instead of assuming `intel_backlight`.
5. **Monitor scripts.** `lid-switch.sh`, `lid_handler.sh`, `lid_daemon.sh`,
   `rotate_external.sh`, `monitor_hotplug.sh` all hardcode `eDP-1`/`HDMI-A-1` +
   resolutions. Refactor to read `LAPTOP_MONITOR` / `EXTERNAL_MONITOR` env vars
   sourced from `host.conf` (or auto-detect: laptop panel = the `eDP*`/`LVDS*`
   match from `hyprctl monitors -j`). Resolutions → `preferred`.
6. `layout_manager_unified.py` hardcodes `1920.0` as a scaling reference
   (lines 322/494/529) — replace with the actual canvas/monitor width it already has.

Result after Phase 1: config boots and is usable on a fresh machine with one file edit.

---

## Phase 2 — AGS monitor correctness (medium effort)

1. **Overlays pinned to monitor 0.** `app.tsx:138-141` —
   `DestinationWindow(0)`, `GalaxyWindow(0)`, `PeriodicTableWindow(0)`,
   `BreakPopupWindow(0)`. Either (a) recreate them on the focused monitor and move
   on focus change, or (b) create one per monitor like the bars already are.
   Recommend (a) for the heavy overlays (Galaxy/Destination), (b) is overkill.
2. **GDK index-reversal math** `app.tsx:85`
   `gdkIndex = (numMonitors-1) - idx` is tuned to this box's GDK-vs-Hypr ordering.
   Replace with a real lookup: match the Gdk monitor whose geometry/connector
   equals the Hypr monitor, instead of assuming reversed order.
3. **`WallpaperSelector.tsx:368`** `let monitor = "eDP-1"` → use the focused
   monitor name (`hyprland.get_focused_monitor().get_name()`).

---

## Phase 3 — Responsive sizing via `u` (largest effort, the "same fraction" goal)

### 3a. `theme.ts:generateCSS()` — 846 px literals
This function is the live stylesheet. Thread `U` through it:
- Change signature to `generateCSS(c, U)` (or read `U` from `scale.ts`).
- Wrap every numeric px in `px()` / `pxs()`. Mechanical but large; do it in a
  branch and diff-render a screenshot at `U=1` to prove zero regression on this box.
- `app.apply_css(generateCSS(theme.colors, U), true)` in `initTheme()` /
  `applyTheme()` (`theme.ts:2715,2731`) — and re-call it from the monitor/focus
  listeners so `U` changes take effect live.
- **Delete `style.css`** (dead, 147 literals) so it stops misleading future edits.

### 3b. Hardcoded px inside `.tsx` widgets
These bypass CSS and must consume `scale.ts` directly:
- `Pomodoro.tsx:197,476` `RING_SIZE=270` + `set_size_request(270,270)` → `px(270)`.
- `Pomodoro.tsx:496,500` inline `font-size:56px/9px` → `pxs()`.
- `Planner.tsx:237-241` grid constants (`DEFAULT_ROW_H=72`, `MIN/MAX_ROW_H`),
  `:882-883`, `:1078-1079`, `:1185,1189-1190` margins/cols → scale via `px()`.
  (Note `START_H=4`/`END_H=22` are *hours*, not px — leave them.)
- `WallpaperSelector.tsx` thumbnails `280×175` (`:145,155,181,213,252`) → `px()`;
  keep aspect ratio.
- `DestinationMenu.tsx` cairo font sizes (`:504,585,634,641,741`), cursor
  `size=64` + radii (`:163-215`), tab `120×32` (`:473-507`) → `px()`.
  Its planet *positions* are already fractional (good) — only the px sizes need it.
- `PeriodicTableWindow.tsx:18-19` margins `100,100` → `px()` (and clamp so it can't
  push the window off a small screen).
- `AudioEQ.tsx:635` `max_content_height(300)`, `Planner.tsx:1990` `(-1,180)` → `px()`.

### 3c. Already-fractional (leave alone, verify only)
`DestinationMenu.tsx` planet coords, `GalaxyOverlay.tsx` `ORBIT_PERCENTAGES` /
`*_PERCENT` — these already key off `minDim`. Just confirm `minDim` reads the
correct (focused) monitor after Phase 2.

---

## Phase 4 — System theming consistency (low effort)

- `theme.conf:59-61` fonts hardwire `CaskaydiaCove Nerd Font Mono 9` — fine, but
  ensure the font is in `packages/` install list so it exists on a new machine
  (otherwise GTK falls back and everything shifts).
- `theme.conf:5-10` `XCURSOR_SIZE 20` — cursor doesn't auto-scale with DPI. Optional:
  derive from `u` in an exec, or leave (20 is reasonable at most scales).
- `hyprlock.conf` fixed px (time `64`, date `18`, profile `130`, input `250×40`,
  positions) — lockscreen. Hyprlock has no `u`; either accept fixed (centered, so
  it degrades gracefully) or template it from `host.conf`. Low priority.

---

## Suggested order & checkpoints

1. **Phase 1** (Hyprland) — independent, ship first; makes the box bootable elsewhere.
2. **Phase 0 + Phase 2** (scale module + AGS monitor correctness) — together.
3. **Phase 3** (responsive CSS) — the big one; do `theme.ts` and `.tsx` in one branch,
   verify `U=1` screenshot-identical here, then test by faking a smaller monitor
   (Hyprland `monitor=eDP-1,preferred,auto,2` to force a different logical size).
4. **Phase 4** — polish.

**Verification per phase:** restart AGS via the known sequence
(`ags quit; sleep 2; rm -f /run/user/1000/ags.js; ags run`) and compare against a
baseline screenshot. The `U=1` invariant on this machine is the regression guard.

# Pomodoro Timer with Audio

A feature-rich pomodoro timer with music playback, theme support, and study block management.

## Features

- **Single Session Mode**: Run individual 25-90 minute work sessions with 5-30 minute breaks
- **Study Block Mode**: Set up multi-hour study sessions with automatic work/break cycles
- **Audio Playback**: Background music during work/break sessions with smooth fade in/out
- **Theme Support**: Multiple music themes for different moods
- **Volume Control**: Adjustable volume for all music and notifications
- **Pause/Resume**: Pause and resume sessions without losing your place
- **Progress Tracking**: Visual progress bars for study blocks

## Audio Setup

### Directory Structure

```
~/.config/ags/assets/music-themes/
├── skyrim/
│   ├── work/
│   │   ├── ambient1.mp3
│   │   ├── ambient2.mp3
│   │   └── ...
│   ├── break/
│   │   ├── relaxing1.mp3
│   │   ├── relaxing2.mp3
│   │   └── ...
│   └── notifications/
│       ├── study_block_started.mp3
│       ├── session_end.mp3
│       └── break_end.mp3
├── lofi/
│   ├── work/
│   ├── break/
│   └── notifications/
└── ...
```

### Audio File Requirements

#### Work/Break Music
- **Location**: `work/` and `break/` folders within each theme
- **Format**: `.mp3` files
- **Naming**: Any filename (e.g., `ambient_forest.mp3`, `track1.mp3`)
- **Behavior**: One random track is selected per session and looped

#### Notification Sounds
- **Location**: `notifications/` folder within each theme
- **Format**: `.mp3` files
- **Required Names** (must be exact):
  - `study_block_started.mp3` - Plays when starting a study block
  - `session_end.mp3` - Plays 5 seconds before work session ends
  - `break_end.mp3` - Plays 5 seconds before break ends

### Audio Behavior

**Starting a Session:**
- Timer starts immediately
- Music fades in from 0% to target volume over 7 seconds
- Work music plays for work sessions, break music for breaks

**During Session:**
- Music loops continuously at set volume
- 5 seconds before end: music dims to 50%, notification plays

**Pausing:**
- Music fades out quickly (1 second)
- Music position is saved

**Resuming:**
- Music fades back in quickly (1 second)
- Resumes from saved position

**Stopping:**
- Music fades out quickly (1 second)
- Music playback terminates

## Usage

### Single Session

1. Click "Single Session" mode
2. Adjust work time (25-90 minutes)
3. Adjust break time (5-30 minutes)
4. Click "Start"
5. Use Pause/Resume as needed
6. Click Stop to end session

### Study Block

1. Click "Study Block" mode
2. Select work/break ratio (25/5, 50/10, or 45/15)
3. Set total hours (1-8)
4. Click "Start Block"
5. Timer automatically cycles through work/break sessions
6. Progress bar shows completion
7. Block ends automatically after all sessions complete

## Audio Controls

### Audio Toggle
Switch in the sidebar to enable/disable all audio playback

### Volume Slider
- Range: 0-100%
- Controls both music and notification volume
- Updates in real-time during playback
- Default: 60%

### Theme Selection
Currently auto-selects first available theme from `music-themes/` directory

## Dependencies

- `mpv` - Media player for audio playback
- `socat` - Socket communication for volume control

Install with:
```bash
sudo pacman -S mpv socat
```

## Technical Details

### Audio Timing
- Fade in duration: 7 seconds
- Fade out (pause/stop): 1 second
- Music dim at session end: 50% of current volume
- Notification plays 5 seconds before session ends

### File Discovery
- Themes auto-discovered from `music-themes/` directory
- Work/break music files discovered via `.mp3` glob
- Random track selection per session
- Notification files must match exact names

### IPC Control
- MPV controlled via IPC socket at `/tmp/ags-pomodoro-mpv-socket`
- Volume adjustments sent via `socat`
- Separate MPV instance for notifications (no IPC interference)

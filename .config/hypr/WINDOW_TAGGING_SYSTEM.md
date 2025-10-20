# Window Tagging System Documentation

## Overview

The window tagging system provides a comprehensive way to track, organize, and manage windows across workspaces in Hyprland. It enables automatic repositioning (magnetizing) of windows back to their original layout positions, even if they've been moved to different workspaces.

## Tag Formats

### 1. Standalone Layout Windows
**Format**: `lay_{layout_name}_ws_{workspace_id}_pos_{position_index}`

**Example**: `lay_Study-Code_ws_1_pos_0`

**Usage**: Windows created by applying a layout directly (not through an environment)

**Components**:
- `lay_` - Prefix identifying this as a layout-managed window
- `{layout_name}` - Name of the layout file (e.g., "Study-Code")
- `ws_{workspace_id}` - Workspace where this window belongs (e.g., "ws_1")
- `pos_{position_index}` - Position slot in the layout (0-indexed)

### 2. Environment Layout Windows
**Format**: `env_{environment_name}_lay_{layout_name}_ws_{workspace_id}_pos_{position_index}`

**Example**: `env_Main_lay_Study-Code_ws_1_pos_0`

**Usage**: Windows created by applying an environment configuration

**Components**:
- `env_{environment_name}` - Environment that created this window (e.g., "Main")
- `lay_{layout_name}` - Layout used for this window
- `ws_{workspace_id}` - Workspace where this window belongs
- `pos_{position_index}` - Position slot in the layout

### 3. Legacy Format (Backward Compatibility)
**Format**: `project_{name}_window_{index}`

**Example**: `project_Math_window_0`

**Note**: Supported for backward compatibility with older windows

## Architecture & Relationships

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Layout Manager GUI                        │
│              (layout_manager_unified.py)                     │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─────────────────┬─────────────────────────────┐
             │                 │                             │
             ▼                 ▼                             ▼
      ┌────────────┐    ┌────────────┐              ┌──────────────┐
      │  Layouts   │    │Environments│              │  Workspaces  │
      │    Tab     │    │    Tab     │              │     Tab      │
      └─────┬──────┘    └──────┬─────┘              └──────┬───────┘
            │                  │                            │
            │                  │                            │
            ▼                  ▼                            ▼
    ┌───────────────┐  ┌──────────────────┐      ┌─────────────────┐
    │ Apply Layout  │  │ Apply to Live    │      │ Live Workspace  │
    │   (Direct)    │  │  (Environment)   │      │   Management    │
    └───────┬───────┘  └────────┬─────────┘      └─────────────────┘
            │                   │
            └───────┬───────────┘
                    │
                    ▼
         ┌────────────────────┐
         │  apply_layout.py   │
         │                    │
         │ Creates windows    │
         │ with tags:         │
         │ • lay_*_ws_*_pos_* │
         │ • env_*_lay_*...   │
         └──────────┬─────────┘
                    │
                    │ Tags persist on windows
                    │
                    ▼
         ┌────────────────────┐
         │  Tagged Windows    │
         │  (In Hyprland)     │
         └──────────┬─────────┘
                    │
                    │ User presses Mod+R
                    │
                    ▼
         ┌────────────────────┐
         │ snap_to_layout.py  │
         │                    │
         │ 1. Scans all       │
         │    workspaces      │
         │ 2. Finds tagged    │
         │    windows         │
         │ 3. Groups by       │
         │    layout          │
         │ 4. Pulls windows   │
         │    back            │
         │ 5. Snaps to        │
         │    positions       │
         └────────────────────┘
```

## Workflow Examples

### Scenario 1: Applying a Standalone Layout

1. User opens Layout Manager (Mod+Shift+L)
2. Goes to "Layouts" tab
3. Selects "Study-Code" layout
4. Clicks "Apply Layout"
5. `apply_layout.py` is called without environment parameter
6. Windows are created with tags: `lay_Study-Code_ws_1_pos_0`, `lay_Study-Code_ws_1_pos_1`, etc.
7. Windows can now be snapped back with Mod+R

### Scenario 2: Applying an Environment

1. User opens Layout Manager (Mod+Shift+L)
2. Goes to "Workspaces" tab
3. Selects "Main" environment
4. Clicks "Apply to Live"
5. `layout_manager_unified.py` reads the environment config
6. For each workspace with a layout assigned:
   - Calls `apply_layout.py` with `--environment Main`
   - Windows are created with tags: `env_Main_lay_Study-Code_ws_1_pos_0`, etc.
7. All windows in the environment can be snapped with Mod+R

### Scenario 3: Magnetizing Windows Back

1. User has windows from "Study-Code" layout on workspace 1
2. User moves a window to workspace 3 (accidentally or intentionally)
3. User switches back to workspace 1
4. User presses Mod+R
5. `snap_to_layout.py`:
   - Scans all workspaces for windows tagged with `ws_1`
   - Finds the window on workspace 3 that's tagged for workspace 1
   - Pulls it back to workspace 1
   - Repositions all windows to their original layout positions

## Component Relationships

### apply_layout.py
**Role**: Creates and tags windows

**Inputs**:
- Layout JSON file path
- Workspace ID (optional)
- `--environment <name>` flag (optional)
- `--reposition-only` flag (optional)

**Outputs**:
- Spawned windows with appropriate tags
- Tags format depends on whether environment flag is provided

**Key Functions**:
- `tag_window()` - Applies tags to windows using hyprctl, returns tag string
- `verify_tag()` - Verifies tag was applied, retries up to 3 times if needed
- `get_windows_by_layout_tag()` - Finds existing tagged windows
- `apply_node()` - Recursively processes layout BSP tree, verifies each tag before continuing

**Tag Verification**:
- After spawning each window, tag is applied
- Script queries Hyprland to verify tag exists on window
- Retries up to 3 times with 0.1s delays if tag missing
- Only proceeds to next window after successful verification
- Prevents tag confusion with multiple instances of same app

### snap_to_layout.py
**Role**: Repositions tagged windows back to their layout positions

**Keybind**: Mod+R

**Process**:
1. Gets current workspace ID
2. Calls `get_all_layout_windows()` to scan all windows
3. Parses tags to extract: layout name, workspace ID, position
4. Groups windows by layout name
5. Finds the layout with most windows on current workspace
6. Loads the layout JSON file
7. Calculates positions based on BSP tree and monitor geometry
8. For each window:
   - Moves to tagged workspace (if on different workspace)
   - Resizes to exact dimensions
   - Moves to exact position

**Key Functions**:
- `get_all_layout_windows()` - Scans and parses all window tags
- `calculate_positions()` - Computes pixel positions from BSP tree
- `snap_to_layout()` - Main orchestration function

### layout_manager_unified.py
**Role**: GUI for managing layouts and environments

**Key Methods**:
- `on_apply_layout()` - Applies standalone layout (calls apply_layout.py)
- `load_workspace_config_from_file()` - Applies environment (calls apply_layout.py with --environment)

## Tag Detection Logic

### In snap_to_layout.py

```python
# Priority order for tag detection:

1. env_{env}_lay_{layout}_ws_{ws}_pos_{pos}
   - Environment-created windows
   - Extracts: layout_name, workspace_id, position_index

2. lay_{layout}_ws_{ws}_pos_{pos}
   - Standalone layout windows
   - Extracts: layout_name, workspace_id, position_index

3. project_{name}_window_{index}
   - Legacy format
   - Extracts: layout_name, position_index
   - Uses current workspace as workspace_id
```

### Tag Storage Structure

```python
# Internal representation after parsing:
layouts = {
    'Study-Code': {
        (1, 0): '0x59a31c1863b0',  # (workspace_id, position) -> window_address
        (1, 1): '0x59a31c2e85a0',
        (1, 2): '0x59a31c39dd70'
    },
    'Math': {
        (3, 0): '0x59a31c302da0'
    }
}
```

## Configuration Files

### Layout Files
**Location**: `~/.config/hypr/layouts/*.json`

**Structure**: BSP tree with containers and window nodes
```json
{
  "type": "container",
  "split": "horizontal",
  "ratio": 0.5,
  "children": [
    {
      "type": "window",
      "app": "foot",
      "working_dir": "~/projects"
    },
    {
      "type": "window",
      "app": "firefox"
    }
  ]
}
```

### Environment Configs
**Location**: `~/.config/hypr/layouts/environment_configs/*.json`

**Structure**: Workspace to layout mappings
```json
{
  "name": "Main",
  "workspaces": [
    {
      "id": 1,
      "monitor": "HDMI-A-1",
      "layout": "/home/user/.config/hypr/layouts/Study-Code.json"
    },
    {
      "id": 2,
      "monitor": "eDP-1",
      "layout": "/home/user/.config/hypr/layouts/WebBrowsing.json"
    }
  ]
}
```

## Window Rules

### In custom/rules.conf

```conf
# All layout-managed windows should float (format: "layoutname - Window N - app")
# This applies to both standalone layouts and environment-created windows
# Tags used: lay_{layout}_ws_{ws}_pos_{pos} or env_{env}_lay_{layout}_ws_{ws}_pos_{pos}
windowrulev2 = float, initialTitle:^.+ - Window \d+ - .+$
```

**How it works**:
- Windows are launched with titles like: "Study-Code - Window 1 - foot"
- The `initialTitle` persists even if the terminal changes its title
- This rule makes them float automatically

## Benefits of This System

1. **Traceability**: Know exactly where each window came from
   - Standalone layout vs environment
   - Which layout created it
   - Which workspace it belongs to
   - Its position in the layout

2. **Flexibility**:
   - Use layouts standalone OR as part of environments
   - Move windows freely, then snap them back
   - Works across workspaces

3. **Persistence**:
   - Tags persist through title changes (terminals, browsers)
   - Tags survive window moves across workspaces
   - Layout information always available

4. **Automation**:
   - One keypress (Mod+R) to restore order
   - Pulls windows from any workspace
   - Respects monitor geometry and gaps

## Keybindings

- **Mod+Shift+L** - Open Layout Manager
- **Mod+R** - Snap/magnetize windows back to layout positions

## Future Enhancements

Possible improvements to consider:

1. **Per-workspace snapping**: Option to only snap windows on current workspace without pulling from others
2. **Environment switching**: Command to switch between entire environment configurations
3. **Layout templates**: Pre-defined common layouts for quick application
4. **Window exclusions**: Ability to exclude certain windows from snapping
5. **Dynamic layouts**: Layouts that adapt to monitor resolution changes

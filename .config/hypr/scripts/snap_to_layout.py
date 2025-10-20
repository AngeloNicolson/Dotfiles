#!/usr/bin/env python3
"""
Snap To Layout - Reposition windows to match their layout positions
Keybind: Mod+R

HOW IT WORKS:
1. Get current workspace ID
2. Find all windows with new or legacy tags
3. Group windows by layout name and workspace
4. Determine active layout (the one with most windows on current workspace)
5. Load layout file: ~/.config/hypr/layouts/saved/{layout}.json
6. Calculate positions from BSP tree (based on monitor size and gaps)
7. For each tagged window on current workspace:
   a. Resize window to exact dimensions
   b. Move window to exact position

FEATURES:
- Workspace-aware: Only snaps windows on current workspace
- Handles missing windows gracefully (empty slots remain)
- Uses tags (not titles) so works after terminal title changes
- Works for all app types (terminals, Firefox, etc.)
- Backward compatible with legacy project_{name}_window_{index} tags

WINDOW IDENTIFICATION:
- Uses tags created by apply_layout.py
- New format: lay_{layout}_ws_{ws}_pos_{pos} or env_{env}_lay_{layout}_ws_{ws}_pos_{pos}
- Legacy format: project_{project_name}_window_{index}
- Each window keeps its original slot index even if others are closed

See LAYOUT_SYSTEM.txt for full architecture documentation.
"""

import os
import sys
import json
import subprocess
from pathlib import Path
import re


def run_hyprctl(command):
    """Run a hyprctl command"""
    try:
        result = subprocess.run(
            ['hyprctl', '-j'] + command.split(),
            capture_output=True,
            text=True
        )
        if result.stdout:
            return json.loads(result.stdout)
        return None
    except Exception:
        return None


def get_active_workspace():
    """Get the currently active workspace"""
    workspace = run_hyprctl('activeworkspace')
    if workspace:
        return workspace.get('id')
    return None


def get_all_layout_windows():
    """Get all windows across all workspaces grouped by layout
    Recognizes both new and legacy tag formats:
    - New: lay_{layout}_ws_{ws}_pos_{pos} or env_{env}_lay_{layout}_ws_{ws}_pos_{pos}
    - Legacy: project_{name}_window_{index}
    Returns: {layout_name: {(workspace_id, position_index): address, ...}, ...}
    """
    result = subprocess.run(['hyprctl', '-j', 'clients'],
                           capture_output=True, text=True, check=False)
    if not result.stdout:
        return {}

    clients = json.loads(result.stdout)
    layouts = {}

    for client in clients:
        tags = client.get('tags', [])

        for tag in tags:
            layout_name = None
            position_index = None
            tagged_workspace_id = None

            # New format: env_{env}_lay_{layout}_ws_{ws}_pos_{pos}
            if tag.startswith('env_') and '_lay_' in tag and '_ws_' in tag and '_pos_' in tag:
                try:
                    parts = tag.split('_lay_')[1]  # Get everything after _lay_
                    layout_and_rest = parts.split('_ws_')
                    layout_name = layout_and_rest[0]
                    ws_and_pos = layout_and_rest[1].split('_pos_')
                    tagged_workspace_id = int(ws_and_pos[0])
                    position_index = int(ws_and_pos[1])
                except:
                    pass

            # New format: lay_{layout}_ws_{ws}_pos_{pos}
            elif tag.startswith('lay_') and '_ws_' in tag and '_pos_' in tag:
                try:
                    parts = tag.replace('lay_', '', 1).split('_ws_')
                    layout_name = parts[0]
                    ws_and_pos = parts[1].split('_pos_')
                    tagged_workspace_id = int(ws_and_pos[0])
                    position_index = int(ws_and_pos[1])
                except:
                    pass

            # Legacy format: project_{name}_window_{index}
            elif tag.startswith('project_') and '_window_' in tag:
                try:
                    parts = tag.split('_window_')
                    layout_name = parts[0].replace('project_', '')
                    position_index = int(parts[1])
                    # Legacy tags don't have workspace in them, use current workspace
                    tagged_workspace_id = client.get('workspace', {}).get('id')
                except:
                    pass

            if layout_name and position_index is not None and tagged_workspace_id is not None:
                if layout_name not in layouts:
                    layouts[layout_name] = {}
                # Use (tagged_workspace_id, position_index) as key
                layouts[layout_name][(tagged_workspace_id, position_index)] = client['address']
                break

    return layouts


def calculate_positions(layout_node, x, y, width, height, gaps_in, positions, index):
    """Recursively calculate positions for each window slot"""
    if layout_node['type'] == 'window':
        positions[index[0]] = {
            'x': int(x),
            'y': int(y),
            'width': int(width),
            'height': int(height)
        }
        index[0] += 1
    elif layout_node['type'] == 'container':
        split = layout_node['split']
        ratio = layout_node.get('ratio', 0.5)
        children = layout_node.get('children', [])

        if len(children) >= 2:
            if split == 'horizontal':
                split_w1 = (width - gaps_in) * ratio
                split_w2 = (width - gaps_in) * (1 - ratio)
                split_x = x + split_w1 + gaps_in
                calculate_positions(children[0], x, y, split_w1, height, gaps_in, positions, index)
                calculate_positions(children[1], split_x, y, split_w2, height, gaps_in, positions, index)
            else:  # vertical
                split_h1 = (height - gaps_in) * ratio
                split_h2 = (height - gaps_in) * (1 - ratio)
                split_y = y + split_h1 + gaps_in
                calculate_positions(children[0], x, y, width, split_h1, gaps_in, positions, index)
                calculate_positions(children[1], x, split_y, width, split_h2, gaps_in, positions, index)


def snap_to_layout():
    """Reposition windows to match their layout slots"""
    # Get current workspace
    workspace_id = get_active_workspace()
    if not workspace_id:
        print("Error: Could not get active workspace", file=sys.stderr)
        return False

    # Get all windows grouped by layout (across all workspaces)
    layouts = get_all_layout_windows()

    if not layouts:
        print(f"No layout windows found", file=sys.stderr)
        return False

    # Find the layout with the most windows tagged for current workspace
    # (windows can be anywhere, but their tags indicate they belong to this workspace)
    active_layout = None
    max_windows_for_workspace = 0
    for layout_name, windows in layouts.items():
        # Count windows that are tagged for current workspace (regardless of where they currently are)
        ws_window_count = sum(1 for (ws, pos) in windows.keys() if ws == workspace_id)
        if ws_window_count > max_windows_for_workspace:
            max_windows_for_workspace = ws_window_count
            active_layout = layout_name

    if not active_layout:
        print(f"No layout windows found for workspace {workspace_id}", file=sys.stderr)
        return False

    # Get ALL windows for this layout that are tagged for current workspace
    # (they might be on different workspaces now, but we'll pull them back)
    all_windows = layouts[active_layout]
    workspace_windows = {pos: addr for (ws, pos), addr in all_windows.items() if ws == workspace_id}

    print(f"Snapping {len(workspace_windows)} windows for layout '{active_layout}' to workspace {workspace_id}")

    # Load layout file
    layouts_dir = Path.home() / '.config' / 'hypr' / 'layouts'
    layout_file = layouts_dir / f'{active_layout}.json'

    if not layout_file.exists():
        print(f"Layout file not found: {layout_file}", file=sys.stderr)
        return False

    with open(layout_file, 'r') as f:
        layout = json.load(f)

    # Get monitor info
    monitors = run_hyprctl('monitors')
    if not monitors:
        print("Error: Could not get monitor information", file=sys.stderr)
        return False

    # Find the monitor that contains the active workspace
    monitor = None
    for mon in monitors:
        if mon.get('activeWorkspace', {}).get('id') == workspace_id:
            monitor = mon
            break

    # Fallback to focused monitor if workspace not found
    if not monitor:
        for mon in monitors:
            if mon.get('focused', False):
                monitor = mon
                break

    # Final fallback to first monitor
    if not monitor:
        monitor = monitors[0]

    # Calculate usable area
    mon_x = monitor['x']
    mon_y = monitor['y']
    mon_width = monitor['width']
    mon_height = monitor['height']
    reserved = monitor.get('reserved', [0, 0, 0, 0])
    gaps_out = 8
    gaps_in = 4

    usable_x = mon_x + reserved[0] + gaps_out
    usable_y = mon_y + reserved[2] + gaps_out
    usable_width = mon_width - reserved[0] - reserved[1] - (gaps_out * 2)
    usable_height = mon_height - reserved[2] - reserved[3] - (gaps_out * 2)

    # Calculate positions for all window slots
    positions = {}
    calculate_positions(layout, usable_x, usable_y, usable_width, usable_height, gaps_in, positions, [0])

    # Move windows to current workspace and reposition
    repositioned = 0
    for window_index, address in workspace_windows.items():
        if window_index in positions:
            pos = positions[window_index]
            # Move to current workspace silently, then resize and reposition
            batch_cmd = (
                f'hyprctl dispatch movetoworkspacesilent {workspace_id},address:{address} && '
                f'hyprctl dispatch resizewindowpixel exact {pos["width"]} {pos["height"]},address:{address} && '
                f'hyprctl dispatch movewindowpixel exact {pos["x"]} {pos["y"]},address:{address}'
            )
            subprocess.run(batch_cmd, shell=True, capture_output=True, check=False)
            repositioned += 1

    print(f"Repositioned {repositioned} windows to layout '{active_layout}'")
    return True


if __name__ == '__main__':
    success = snap_to_layout()
    sys.exit(0 if success else 1)

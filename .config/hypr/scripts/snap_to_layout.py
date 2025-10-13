#!/usr/bin/env python3
"""
Snap To Layout - Reposition windows to match their layout positions
Keybind: Mod+R

HOW IT WORKS:
1. Get current workspace ID
2. Find all windows with tags: project_{name}_window_{index}
3. Group windows by project name
4. Determine active project (the one with most windows)
5. Load layout file: ~/.config/hypr/layouts/saved/{project}.json
6. Calculate positions from BSP tree (based on monitor size and gaps)
7. For each tagged window:
   a. Move window to current workspace (if on different workspace)
   b. Resize window to exact dimensions
   c. Move window to exact position

FEATURES:
- Works across workspaces (gathers windows from anywhere)
- Handles missing windows gracefully (empty slots remain)
- Uses tags (not titles) so works after terminal title changes
- Works for all app types (terminals, Firefox, etc.)

WINDOW IDENTIFICATION:
- Uses tags created by apply_layout.py
- Format: project_{project_name}_window_{index}
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


def get_all_project_windows():
    """Get all windows across all workspaces grouped by project
    Uses tags in format: project_{name}_window_{index}
    Returns: {project_name: {window_index: address, ...}, ...}
    """
    result = subprocess.run(['hyprctl', '-j', 'clients'],
                           capture_output=True, text=True, check=False)
    if not result.stdout:
        return {}

    clients = json.loads(result.stdout)
    projects = {}

    for client in clients:
        tags = client.get('tags', [])
        # Look for tags in format: project_{name}_window_{index}
        for tag in tags:
            if tag.startswith('project_') and '_window_' in tag:
                try:
                    parts = tag.split('_window_')
                    project_name = parts[0].replace('project_', '')
                    window_index = int(parts[1])

                    if project_name not in projects:
                        projects[project_name] = {}
                    projects[project_name][window_index] = client['address']
                except:
                    pass

    return projects


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

    # Get all windows grouped by project (across all workspaces)
    projects = get_all_project_windows()

    if not projects:
        print(f"No layout windows found", file=sys.stderr)
        return False

    # Find the project with the most windows (assume that's the active project)
    active_project = max(projects.keys(), key=lambda p: len(projects[p]))
    windows = projects[active_project]

    print(f"Snapping {len(windows)} windows for project '{active_project}' to workspace {workspace_id}")

    # Load layout file
    layouts_dir = Path.home() / '.config' / 'hypr' / 'layouts' / 'saved'
    layout_file = layouts_dir / f'{active_project}.json'

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

    # Find focused monitor
    monitor = None
    for mon in monitors:
        if mon.get('focused', False):
            monitor = mon
            break
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
    for window_index, address in windows.items():
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

    print(f"Repositioned {repositioned} windows to layout '{active_project}'")
    return True


if __name__ == '__main__':
    success = snap_to_layout()
    sys.exit(0 if success else 1)

#!/usr/bin/env python3
"""
Apply Layout Script for Hyprland
Applies a saved window layout by launching applications and arranging them
"""

import json
import subprocess
import time
import sys
import os


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
    except Exception as e:
        print(f"Error running hyprctl: {e}", file=sys.stderr)
        return None


def get_active_window():
    """Get the currently active window"""
    return run_hyprctl('activewindow')


def get_workspace_windows(workspace_id):
    """Get all windows in a specific workspace"""
    result = subprocess.run(['hyprctl', '-j', 'clients'],
                           capture_output=True, text=True, check=False)
    if not result.stdout:
        return []

    clients = json.loads(result.stdout)
    workspace_windows = []
    for client in clients:
        if client.get('workspace', {}).get('id') == workspace_id:
            workspace_windows.append(client['address'])
    return workspace_windows


def move_cursor_to(x, y):
    """Move cursor to specific position"""
    subprocess.run(['hyprctl', 'dispatch', 'movecursor', f'{int(x)} {int(y)}'],
                  capture_output=True, check=False)
    time.sleep(0.05)


def position_floating_window(address, x, y, width, height):
    """Position and resize a floating window with exact coordinates"""
    try:
        # Check if window is already floating
        result = subprocess.run(['hyprctl', '-j', 'clients'],
                               capture_output=True, text=True, check=False)
        if result.stdout:
            clients = json.loads(result.stdout)
            is_floating = False
            for client in clients:
                if client.get('address') == address:
                    is_floating = client.get('floating', False)
                    break

            # Only toggle if not already floating
            if not is_floating:
                subprocess.run(['hyprctl', 'dispatch', 'togglefloating', f'address:{address}'],
                              capture_output=True, check=False)
                time.sleep(0.1)

        # Resize window with exact dimensions
        subprocess.run(['hyprctl', 'dispatch', 'resizewindowpixel',
                       f'exact {int(width)} {int(height)},address:{address}'],
                      capture_output=True, check=False)
        time.sleep(0.1)

        # Move window to exact position
        subprocess.run(['hyprctl', 'dispatch', 'movewindowpixel',
                       f'exact {int(x)} {int(y)},address:{address}'],
                      capture_output=True, check=False)
        time.sleep(0.1)

    except Exception as e:
        pass


def launch_app(app_command):
    """Launch an application"""
    try:
        subprocess.Popen(
            app_command,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(0.5)  # Wait for window to appear
    except Exception as e:
        print(f"Error launching app {app_command}: {e}", file=sys.stderr)


def apply_node(node, x, y, width, height, monitor_info, gaps_in=4, windows_list=None, existing_windows=None, window_counter=None):
    """Recursively apply a layout node"""
    if node['type'] == 'window':
        # Launch the application
        app = node.get('app')
        if app and windows_list is not None:
            current_index = window_counter[0] if window_counter else 0
            window_counter[0] += 1

            # Check if we have an existing window at this index
            existing_address = None
            if existing_windows and current_index < len(existing_windows):
                existing_address = existing_windows[current_index]

            # If window doesn't exist, launch it
            if not existing_address:
                launch_app(app)
                time.sleep(0.5)
                window = get_active_window()
                if window and 'address' in window:
                    existing_address = window['address']

            # Collect window info for positioning
            if existing_address:
                windows_list.append({
                    'address': existing_address,
                    'x': int(x),
                    'y': int(y),
                    'width': int(width),
                    'height': int(height)
                })
    elif node['type'] == 'container':
        split = node['split']
        ratio = node.get('ratio', 0.5)
        children = node.get('children', [])

        if len(children) >= 2:
            if split == 'horizontal':
                # Account for gap between windows
                split_w1 = (width - gaps_in) * ratio
                split_w2 = (width - gaps_in) * (1 - ratio)
                split_x = x + split_w1 + gaps_in

                apply_node(children[0], x, y, split_w1, height, monitor_info, gaps_in, windows_list, existing_windows, window_counter)
                apply_node(children[1], split_x, y, split_w2, height, monitor_info, gaps_in, windows_list, existing_windows, window_counter)
            else:  # vertical
                # Account for gap between windows
                split_h1 = (height - gaps_in) * ratio
                split_h2 = (height - gaps_in) * (1 - ratio)
                split_y = y + split_h1 + gaps_in

                apply_node(children[0], x, y, width, split_h1, monitor_info, gaps_in, windows_list, existing_windows, window_counter)
                apply_node(children[1], x, split_y, width, split_h2, monitor_info, gaps_in, windows_list, existing_windows, window_counter)


def apply_layout(layout_file, workspace=None):
    """Apply a layout file to the current or specified workspace"""
    try:
        # Load layout
        with open(layout_file, 'r') as f:
            layout = json.load(f)

        # Get monitor info
        monitors = run_hyprctl('monitors')
        if not monitors:
            print("Error: Could not get monitor information", file=sys.stderr)
            return False

        # Find the focused/active monitor
        monitor = None
        for mon in monitors:
            if mon.get('focused', False):
                monitor = mon
                break

        # Fallback to first monitor if none focused
        if not monitor:
            monitor = monitors[0]
        mon_x = monitor['x']
        mon_y = monitor['y']
        mon_width = monitor['width']
        mon_height = monitor['height']

        # Account for reserved space (sidebars, bars, etc.)
        # Format from hyprctl: [left, right, top, bottom]
        reserved = monitor.get('reserved', [0, 0, 0, 0])
        reserved_left = reserved[0] if len(reserved) > 0 else 0
        reserved_right = reserved[1] if len(reserved) > 1 else 0
        reserved_top = reserved[2] if len(reserved) > 2 else 0
        reserved_bottom = reserved[3] if len(reserved) > 3 else 0

        # Account for Hyprland gaps (from config: gaps_out=8, gaps_in=4)
        gaps_out = 8
        gaps_in = 4

        # Adjust for reserved space and outer gaps
        usable_x = mon_x + reserved_left + gaps_out
        usable_y = mon_y + reserved_top + gaps_out
        usable_width = mon_width - reserved_left - reserved_right - (gaps_out * 2)
        usable_height = mon_height - reserved_top - reserved_bottom - (gaps_out * 2)

        # Get current workspace
        active_workspace = run_hyprctl('activeworkspace')
        if not active_workspace:
            print("Error: Could not get active workspace", file=sys.stderr)
            return False
        workspace_id = active_workspace.get('id')

        # Switch to workspace if specified
        if workspace:
            subprocess.run(['hyprctl', 'dispatch', 'workspace', str(workspace)])
            time.sleep(0.2)
            workspace_id = workspace

        # Get existing windows in the workspace
        existing_windows = get_workspace_windows(workspace_id)

        # Pass 1: Spawn windows that don't exist, collect all windows
        windows_list = []
        window_counter = [0]  # Use list for mutability in recursion
        apply_node(layout, usable_x, usable_y, usable_width, usable_height, monitor, gaps_in, windows_list, existing_windows, window_counter)

        # Wait for any new windows to settle
        time.sleep(0.5)

        # Pass 2: Position and resize all windows as floating with exact coordinates
        for window_info in windows_list:
            position_floating_window(
                window_info['address'],
                window_info['x'],
                window_info['y'],
                window_info['width'],
                window_info['height']
            )

        print(f"Layout from {layout_file} applied successfully")
        return True

    except FileNotFoundError:
        print(f"Error: Layout file '{layout_file}' not found", file=sys.stderr)
        return False
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in layout file '{layout_file}'", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error applying layout: {e}", file=sys.stderr)
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: apply_layout.py <layout_file> [workspace]", file=sys.stderr)
        sys.exit(1)

    layout_file = sys.argv[1]
    workspace = sys.argv[2] if len(sys.argv) > 2 else None

    success = apply_layout(layout_file, workspace)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

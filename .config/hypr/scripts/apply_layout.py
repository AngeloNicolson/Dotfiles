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


def move_window_to_position(address, x, y, width, height):
    """Move and resize a window"""
    try:
        subprocess.run([
            'hyprctl',
            'dispatch',
            'movewindowpixel',
            f'exact {x} {y}',
            f'address:{address}'
        ])
        subprocess.run([
            'hyprctl',
            'dispatch',
            'resizewindowpixel',
            f'exact {width} {height}',
            f'address:{address}'
        ])
    except Exception as e:
        print(f"Error moving window: {e}", file=sys.stderr)


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


def apply_node(node, x, y, width, height, monitor_info):
    """Recursively apply a layout node"""
    if node['type'] == 'window':
        # Launch the application
        app = node.get('app')
        if app:
            print(f"Launching {app} at ({x}, {y}) with size ({width}x{height})")
            launch_app(app)

            # Get the new window
            time.sleep(0.3)
            window = get_active_window()

            if window and 'address' in window:
                # Move and resize the window
                move_window_to_position(
                    window['address'],
                    int(x), int(y),
                    int(width), int(height)
                )
    elif node['type'] == 'container':
        split = node['split']
        ratio = node.get('ratio', 0.5)
        children = node.get('children', [])

        if len(children) >= 2:
            if split == 'horizontal':
                split_x = x + width * ratio
                apply_node(children[0], x, y, width * ratio, height, monitor_info)
                apply_node(children[1], split_x, y, width * (1 - ratio), height, monitor_info)
            else:  # vertical
                split_y = y + height * ratio
                apply_node(children[0], x, y, width, height * ratio, monitor_info)
                apply_node(children[1], x, split_y, width, height * (1 - ratio), monitor_info)


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

        # Use first monitor for now
        monitor = monitors[0]
        mon_x = monitor['x']
        mon_y = monitor['y']
        mon_width = monitor['width']
        mon_height = monitor['height']

        # Switch to workspace if specified
        if workspace:
            subprocess.run(['hyprctl', 'dispatch', 'workspace', str(workspace)])
            time.sleep(0.2)

        # Apply the layout
        apply_node(layout, mon_x, mon_y, mon_width, mon_height, monitor)

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

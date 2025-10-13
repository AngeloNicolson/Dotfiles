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
    """Move and resize a window to exact position (floating mode)"""
    try:
        # Make window floating
        subprocess.run(['hyprctl', 'dispatch', 'togglefloating', f'address:{address}'],
                      capture_output=True, check=False)
        time.sleep(0.1)

        # Move to exact position
        subprocess.run(['hyprctl', 'dispatch', 'movewindowpixel',
                       f'exact {int(x)} {int(y)},address:{address}'],
                      capture_output=True, check=False)

        # Resize to exact size
        subprocess.run(['hyprctl', 'dispatch', 'resizewindowpixel',
                       f'exact {int(width)} {int(height)},address:{address}'],
                      capture_output=True, check=False)

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


def apply_node(node, x, y, width, height, monitor_info, gaps_in=4):
    """Recursively apply a layout node with gap awareness"""
    if node['type'] == 'window':
        # Launch the application
        app = node.get('app')
        if app:
            launch_app(app)

            # Get the new window
            time.sleep(0.5)
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
                # Account for gap between windows
                split_w1 = (width - gaps_in) * ratio
                split_w2 = (width - gaps_in) * (1 - ratio)
                split_x = x + split_w1 + gaps_in

                apply_node(children[0], x, y, split_w1, height, monitor_info, gaps_in)
                apply_node(children[1], split_x, y, split_w2, height, monitor_info, gaps_in)
            else:  # vertical
                # Account for gap between windows
                split_h1 = (height - gaps_in) * ratio
                split_h2 = (height - gaps_in) * (1 - ratio)
                split_y = y + split_h1 + gaps_in

                apply_node(children[0], x, y, width, split_h1, monitor_info, gaps_in)
                apply_node(children[1], x, split_y, width, split_h2, monitor_info, gaps_in)


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

        # Switch to workspace if specified
        if workspace:
            subprocess.run(['hyprctl', 'dispatch', 'workspace', str(workspace)])
            time.sleep(0.2)

        # Apply the layout (floating mode with exact positioning)
        apply_node(layout, usable_x, usable_y, usable_width, usable_height, monitor, gaps_in)

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

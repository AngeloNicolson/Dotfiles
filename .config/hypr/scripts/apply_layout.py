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


def find_window_by_title(window_title):
    """Find a window by its initial title (which Hyprland preserves even after title changes)"""
    try:
        result = subprocess.run(['hyprctl', '-j', 'clients'],
                               capture_output=True, text=True, check=False)
        if not result.stdout:
            return None

        clients = json.loads(result.stdout)
        for client in clients:
            # Check initialTitle which persists even after the window changes its title
            if client.get('initialTitle') == window_title:
                return client
        return None
    except Exception:
        return None


def get_windows_by_project_tag(project_id, workspace_id=None):
    """Get all windows tagged with a specific project ID, optionally filtered by workspace"""
    result = subprocess.run(['hyprctl', '-j', 'clients'],
                           capture_output=True, text=True, check=False)
    if not result.stdout:
        return {}

    clients = json.loads(result.stdout)
    project_windows = {}

    for client in clients:
        # Filter by workspace if specified
        if workspace_id is not None:
            client_workspace = client.get('workspace', {}).get('id')
            if client_workspace != workspace_id:
                continue

        tags = client.get('tags', [])
        # Look for tags in format: project_<name>_window_<index>
        for tag in tags:
            if tag.startswith(f'project_{project_id}_window_'):
                try:
                    window_index = int(tag.split('_window_')[1])
                    project_windows[window_index] = {
                        'address': client['address'],
                        'app': client.get('class', '')
                    }
                except:
                    pass

    return project_windows


def move_cursor_to(x, y):
    """Move cursor to specific position"""
    subprocess.run(['hyprctl', 'dispatch', 'movecursor', f'{int(x)} {int(y)}'],
                  capture_output=True, check=False)
    time.sleep(0.05)


def create_window_rule(window_title, x, y, width, height):
    """Create dynamic window rules for pre-positioning before window spawns"""
    try:
        # Create rules to float, size, and position the window based on title
        rules = [
            f'float,title:^{window_title}$',
            f'size {int(width)} {int(height)},title:^{window_title}$',
            f'move {int(x)} {int(y)},title:^{window_title}$'
        ]

        for rule in rules:
            subprocess.run(
                ['hyprctl', 'keyword', 'windowrulev2', rule],
                capture_output=True,
                check=False
            )
    except Exception:
        pass


def launch_app(app_command, terminal_command=None, working_dir=None, window_title=None):
    """Launch an application, with optional terminal command, working directory, and window title"""
    try:
        # Determine if this is a terminal app
        terminal_apps = ['foot', 'kitty', 'alacritty', 'wezterm', 'terminator', 'gnome-terminal', 'konsole']
        is_terminal = any(term in app_command.lower() for term in terminal_apps)

        if is_terminal:
            # Build terminal command as a list (don't use shell=True)
            cmd_parts = [app_command]

            # Add window title if specified (for pre-positioning via window rules)
            if window_title:
                if 'foot' in app_command or 'kitty' in app_command or 'alacritty' in app_command:
                    cmd_parts.extend(['--title', window_title])
                elif 'wezterm' in app_command:
                    cmd_parts.extend(['--class', window_title])

            # Add working directory if specified
            if working_dir:
                expanded_dir = os.path.expanduser(working_dir)
                if 'foot' in app_command or 'kitty' in app_command or 'alacritty' in app_command:
                    cmd_parts.extend(['--working-directory', expanded_dir])
                elif 'wezterm' in app_command:
                    cmd_parts.extend(['start', '--cwd', expanded_dir])

            # Add terminal command if specified - wrap in shell for proper execution
            if terminal_command:
                # Use shell to handle the command properly
                if 'foot' in app_command or 'kitty' in app_command or 'alacritty' in app_command:
                    # These terminals accept commands directly as trailing arguments
                    cmd_parts.extend(['sh', '-c', terminal_command])
                elif 'wezterm' in app_command:
                    cmd_parts.extend(['--', 'sh', '-c', terminal_command])
                else:
                    # Fallback for other terminals
                    cmd_parts.extend(['-e', 'sh', '-c', terminal_command])

            # Use list directly without shell
            subprocess.Popen(
                cmd_parts,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        else:
            # For non-terminal apps, use shell
            subprocess.Popen(
                app_command,
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

        time.sleep(0.3)  # Shorter wait since window will be pre-positioned
    except Exception as e:
        print(f"Error launching app {app_command}: {e}", file=sys.stderr)


def apply_node(node, x, y, width, height, monitor_info, gaps_in=4, windows_list=None, existing_windows=None, window_counter=None, project_id=None, reposition_only=False, workspace_id=None):
    """Recursively apply a layout node"""
    if node['type'] == 'window':
        # Launch the application
        app = node.get('app')
        if app and windows_list is not None:
            current_index = window_counter[0] if window_counter else 0
            window_counter[0] += 1

            # Check if we have an existing window at this index
            existing_address = None
            if existing_windows and current_index in existing_windows:
                existing_address = existing_windows[current_index]['address']
                # Re-position the existing window (don't toggle float - already floating)
                batch_cmd = (
                    f'hyprctl dispatch resizewindowpixel exact {int(width)} {int(height)},address:{existing_address} && '
                    f'hyprctl dispatch movewindowpixel exact {int(x)} {int(y)},address:{existing_address}'
                )
                subprocess.run(batch_cmd, shell=True, capture_output=True, check=False)

            # If window doesn't exist, launch it with pre-positioning (unless reposition_only mode)
            if not existing_address and not reposition_only:
                # Generate descriptive window title: "project - Window 1 - app"
                window_title = f'{project_id} - Window {current_index + 1} - {app}'

                # Create window rules to pre-position before window fully renders
                # Also add rule to spawn on specific workspace
                create_window_rule(window_title, x, y, width, height)
                if workspace_id:
                    subprocess.run(
                        ['hyprctl', 'keyword', 'windowrulev2', f'workspace {workspace_id},title:^{window_title}$'],
                        capture_output=True, check=False
                    )

                # Launch with descriptive title
                terminal_command = node.get('terminal_command')
                working_dir = node.get('working_dir')
                launch_app(app, terminal_command, working_dir, window_title)

                # Wait for window to spawn and get the active window (simpler and more reliable)
                time.sleep(0.5)  # Give window time to fully spawn and stabilize
                window = get_active_window()
                if window and 'address' in window:
                    existing_address = window['address']
                    # Brief pause before spawning next window
                    time.sleep(0.2)

            # Collect for mapping
            if existing_address:
                windows_list.append({
                    'address': existing_address,
                    'index': current_index,
                    'app': app
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

                apply_node(children[0], x, y, split_w1, height, monitor_info, gaps_in, windows_list, existing_windows, window_counter, project_id, reposition_only, workspace_id)
                apply_node(children[1], split_x, y, split_w2, height, monitor_info, gaps_in, windows_list, existing_windows, window_counter, project_id, reposition_only, workspace_id)
            else:  # vertical
                # Account for gap between windows
                split_h1 = (height - gaps_in) * ratio
                split_h2 = (height - gaps_in) * (1 - ratio)
                split_y = y + split_h1 + gaps_in

                apply_node(children[0], x, y, width, split_h1, monitor_info, gaps_in, windows_list, existing_windows, window_counter, project_id, reposition_only, workspace_id)
                apply_node(children[1], x, split_y, width, split_h2, monitor_info, gaps_in, windows_list, existing_windows, window_counter, project_id, reposition_only, workspace_id)


def apply_layout(layout_file, workspace=None, reposition_only=False):
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

        # Generate project ID from layout filename
        project_id = os.path.splitext(os.path.basename(layout_file))[0]

        # Get existing windows tagged with this project on this workspace
        existing_windows = get_windows_by_project_tag(project_id, workspace_id)

        # Spawn and position windows immediately (no two-pass system)
        windows_list = []
        window_counter = [0]  # Use list for mutability in recursion
        apply_node(layout, usable_x, usable_y, usable_width, usable_height, monitor, gaps_in, windows_list, existing_windows, window_counter, project_id, reposition_only, workspace_id)

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
        print("Usage: apply_layout.py <layout_file> [workspace] [--reposition-only]", file=sys.stderr)
        sys.exit(1)

    # Parse arguments
    layout_file = sys.argv[1]
    workspace = None
    reposition_only = False

    # Check for optional arguments
    for arg in sys.argv[2:]:
        if arg == '--reposition-only':
            reposition_only = True
        elif not workspace:
            workspace = arg

    success = apply_layout(layout_file, workspace, reposition_only)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

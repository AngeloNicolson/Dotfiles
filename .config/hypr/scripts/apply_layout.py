#!/usr/bin/env python3
"""
Apply Layout Script for Hyprland
Applies a saved window layout by launching applications and arranging them

HOW IT WORKS:
1. Load layout JSON file (BSP tree structure)
2. Calculate positions for each window based on monitor size and gaps
3. For each window in the layout:
   a. Create window rules for pre-positioning (float, size, move)
      - Terminals: Use title-based rules (they respect --title flag)
      - GUI apps: Use class+workspace rules for positioning
   b. Create workspace assignment rules
      - Terminals: workspace rule by title
      - GUI apps: workspace rule by class
   c. Get snapshot of current windows before launching
   d. Launch app with custom title (terminals) or default (GUI apps)
   e. Poll for NEW window (compare before/after window lists)
   f. Tag window with appropriate tag format
   g. Window appears at correct position and workspace due to pre-positioning rules

WINDOW TAGGING:
- Tags persist across title changes
- Format for standalone layouts: lay_{layout_name}_ws_{workspace_id}_pos_{position_index}
- Format for environment layouts: env_{environment_name}_lay_{layout_name}_ws_{workspace_id}_pos_{position_index}
- Used by snap_to_layout.py to find and reposition windows

USAGE:
  apply_layout.py <layout_file.json> [workspace] [--reposition-only] [--environment <env_name>]

See LAYOUT_SYSTEM.txt for full architecture documentation.
"""

import json
import subprocess
import time
import sys
import os
import shlex


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


def get_all_window_addresses():
    """Get addresses of all current windows"""
    try:
        result = subprocess.run(['hyprctl', '-j', 'clients'],
                               capture_output=True, text=True, check=False)
        if not result.stdout:
            return set()
        clients = json.loads(result.stdout)
        return {client['address'] for client in clients}
    except Exception:
        return set()


def wait_for_new_window(previous_addresses, timeout=2.0, poll_interval=0.05, expected_workspace=None):
    """Wait for a new window to appear and return its address

    Args:
        previous_addresses: Set of window addresses before launching
        timeout: Maximum time to wait
        poll_interval: Time between checks
        expected_workspace: If specified, only return window on this workspace
    """
    start_time = time.time()
    checked_addresses = set()  # Track addresses we've already checked and rejected

    # Transient/dialog windows to ignore (these are temporary UI elements, not the actual app)
    ignored_classes = ['zenity', 'yad', 'rofi', 'wofi', 'xdg-desktop-portal', 'portal']

    while time.time() - start_time < timeout:
        # Get all current window addresses
        result = subprocess.run(['hyprctl', '-j', 'clients'],
                              capture_output=True, text=True, check=False)
        if not result.stdout:
            time.sleep(poll_interval)
            continue

        clients = json.loads(result.stdout)
        current_count = len(clients)

        # Look for new windows
        new_found = 0
        for client in clients:
            addr = client['address']

            # Skip if we've seen this window before or already checked it
            if addr in previous_addresses or addr in checked_addresses:
                continue

            # Skip transient/dialog windows (zenity, etc.)
            window_class = client.get('class', '').lower()
            if any(ignored in window_class for ignored in ignored_classes):
                print(f"  Ignoring dialog window: {window_class}", file=sys.stderr)
                checked_addresses.add(addr)
                continue

            print(f"  Found new window: {window_class} on workspace {client.get('workspace', {}).get('id')}", file=sys.stderr)

            new_found += 1
            # Found a new window
            if expected_workspace is not None:
                # Check if it's on the correct workspace
                workspace_id = client.get('workspace', {}).get('id')
                # Compare as integers
                if int(workspace_id) == int(expected_workspace):
                    return addr
                else:
                    # Wrong workspace, mark as checked and keep looking
                    checked_addresses.add(addr)
            else:
                # No workspace filtering, return it
                return addr

        time.sleep(poll_interval)
    return None


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


def get_windows_by_layout_tag(layout_name, workspace_id, environment_name=None):
    """Get all windows tagged with a specific layout on a workspace

    Args:
        layout_name: Name of the layout
        workspace_id: Workspace ID to filter by
        environment_name: Optional environment name

    Returns:
        Dict mapping position_index to {address, app}
    """
    result = subprocess.run(['hyprctl', '-j', 'clients'],
                           capture_output=True, text=True, check=False)
    if not result.stdout:
        return {}

    clients = json.loads(result.stdout)
    layout_windows = {}

    for client in clients:
        # Filter by workspace
        client_workspace = client.get('workspace', {}).get('id')
        if client_workspace != workspace_id:
            continue

        tags = client.get('tags', [])

        # Look for tags in new format or legacy format
        for tag in tags:
            position_index = None

            # New format: env_{env}_lay_{layout}_ws_{ws}_pos_{pos} or lay_{layout}_ws_{ws}_pos_{pos}
            if environment_name and tag.startswith(f'env_{environment_name}_lay_{layout_name}_ws_{workspace_id}_pos_'):
                try:
                    position_index = int(tag.split('_pos_')[1])
                except:
                    pass
            elif not environment_name and tag.startswith(f'lay_{layout_name}_ws_{workspace_id}_pos_'):
                try:
                    position_index = int(tag.split('_pos_')[1])
                except:
                    pass
            # Legacy format: project_{name}_window_{index}
            elif tag.startswith(f'project_{layout_name}_window_'):
                try:
                    position_index = int(tag.split('_window_')[1])
                except:
                    pass

            if position_index is not None:
                layout_windows[position_index] = {
                    'address': client['address'],
                    'app': client.get('class', '')
                }
                break

    return layout_windows


def move_cursor_to(x, y):
    """Move cursor to specific position"""
    subprocess.run(['hyprctl', 'dispatch', 'movecursor', f'{int(x)} {int(y)}'],
                  capture_output=True, check=False)
    time.sleep(0.05)


def create_window_rule(window_title, x, y, width, height, app_class=None, workspace_id=None, is_terminal=False):
    """Create dynamic window rules for pre-positioning before window spawns"""
    try:
        rules = []

        if is_terminal:
            # For terminals: use title-based rules (they respect --title flag)
            rules = [
                f'float on, match:title ^{window_title}$',
                f'size {int(width)} {int(height)}, match:title ^{window_title}$',
                f'move {int(x)} {int(y)}, match:title ^{window_title}$'
            ]
        else:
            # For GUI apps: use class-based rules (they don't respect --title)
            if app_class:
                if workspace_id:
                    # With workspace: scope rules to specific workspace
                    rules = [
                        f'float on, match:class ^{app_class}$, match:workspace {workspace_id}',
                        f'size {int(width)} {int(height)}, match:class ^{app_class}$, match:workspace {workspace_id}',
                        f'move {int(x)} {int(y)}, match:class ^{app_class}$, match:workspace {workspace_id}'
                    ]
                else:
                    # Without workspace: use class-only rules
                    rules = [
                        f'float on, match:class ^{app_class}$',
                        f'size {int(width)} {int(height)}, match:class ^{app_class}$',
                        f'move {int(x)} {int(y)}, match:class ^{app_class}$'
                    ]

        for rule in rules:
            subprocess.run(
                ['hyprctl', 'keyword', 'windowrule', rule],
                capture_output=True,
                check=False
            )
    except Exception:
        pass


def tag_window(address, layout_name, workspace_id, position_index, environment_name=None):
    """Tag a window for future snapping

    Args:
        address: Window address
        layout_name: Name of the layout
        workspace_id: Workspace ID where window is placed
        position_index: Position index in the layout
        environment_name: Optional environment name (if created from environment)

    Returns:
        str: The tag that was applied, or None if failed
    """
    try:
        if environment_name:
            # Environment-created window: env_{env}_lay_{layout}_ws_{ws}_pos_{pos}
            tag = f'env_{environment_name}_lay_{layout_name}_ws_{workspace_id}_pos_{position_index}'
        else:
            # Standalone layout window: lay_{layout}_ws_{ws}_pos_{pos}
            tag = f'lay_{layout_name}_ws_{workspace_id}_pos_{position_index}'

        subprocess.run(
            ['hyprctl', 'dispatch', 'tagwindow', f'+{tag}', f'address:{address}'],
            capture_output=True,
            check=False
        )
        return tag
    except Exception:
        return None


def verify_tag(address, expected_tag, max_retries=3):
    """Verify that a tag was successfully applied to a window

    Args:
        address: Window address
        expected_tag: The tag that should be on the window
        max_retries: Number of times to retry if tag not found

    Returns:
        bool: True if tag verified, False otherwise
    """
    for attempt in range(max_retries):
        try:
            result = subprocess.run(
                ['hyprctl', '-j', 'clients'],
                capture_output=True,
                text=True,
                check=False
            )
            if result.stdout:
                clients = json.loads(result.stdout)
                for client in clients:
                    if client.get('address') == address:
                        tags = client.get('tags', [])
                        if expected_tag in tags:
                            return True
                        # Tag not found, retry after short delay
                        time.sleep(0.1)
                        # Re-apply tag
                        subprocess.run(
                            ['hyprctl', 'dispatch', 'tagwindow', f'+{expected_tag}', f'address:{address}'],
                            capture_output=True,
                            check=False
                        )
        except Exception:
            pass
    return False


def launch_app(app_command, terminal_command=None, working_dir=None, window_title=None, workspace_id=None, x=None, y=None, width=None, height=None, force_float=False):
    """Launch an application, with optional terminal command, working directory, window title, workspace, and position

    Args:
        force_float: If True, add 'float' tag to exec spec to ensure window floats
    """
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
            # For non-terminal apps, use hyprctl dispatch with workspace spec if workspace is specified
            if workspace_id or force_float:
                # Build exec spec with workspace, float, size, and position
                spec_parts = []
                if workspace_id:
                    spec_parts.append(f'workspace {workspace_id} silent')
                if force_float:
                    spec_parts.append('float')
                if width is not None and height is not None:
                    spec_parts.append(f'size {int(width)} {int(height)}')
                if x is not None and y is not None:
                    spec_parts.append(f'move {int(x)} {int(y)}')
                exec_spec = ';'.join(spec_parts)

                # Use shlex.quote to properly escape the entire command for hyprctl
                full_command = f"[{exec_spec}] {app_command}"

                # Don't redirect stdout/stderr for commands with dialogs - they need interaction
                has_dialog = any(dialog in app_command.lower() for dialog in ['zenity', 'yad', 'rofi', 'wofi'])

                subprocess.Popen(
                    ['hyprctl', 'dispatch', 'exec', full_command],
                    stdout=None if has_dialog else subprocess.DEVNULL,
                    stderr=None if has_dialog else subprocess.DEVNULL
                )
            else:
                # Launch directly without workspace spec
                # Don't redirect stdout/stderr for commands with dialogs - they need interaction
                has_dialog = any(dialog in app_command.lower() for dialog in ['zenity', 'yad', 'rofi', 'wofi'])

                subprocess.Popen(
                    app_command,
                    shell=True,
                    stdout=None if has_dialog else subprocess.DEVNULL,
                    stderr=None if has_dialog else subprocess.DEVNULL
                )

        time.sleep(0.1)  # Shorter wait since window will be pre-positioned
    except Exception as e:
        print(f"Error launching app {app_command}: {e}", file=sys.stderr)


def apply_node(node, x, y, width, height, monitor_info, gaps_in=4, windows_list=None, existing_windows=None, window_counter=None, layout_name=None, reposition_only=False, workspace_id=None, environment_name=None, failed_tags=None):
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
                # Re-tag and re-position the existing window (don't toggle float - already floating)
                applied_tag = tag_window(existing_address, layout_name, workspace_id, current_index, environment_name)
                if applied_tag:
                    tag_verified = verify_tag(existing_address, applied_tag)
                    if not tag_verified:
                        # Defer this window for retry at the end
                        if failed_tags is not None:
                            failed_tags.append({
                                'address': existing_address,
                                'tag': applied_tag,
                                'app': app,
                                'position': current_index
                            })
                batch_cmd = (
                    f'hyprctl dispatch resizewindowpixel exact {int(width)} {int(height)},address:{existing_address} && '
                    f'hyprctl dispatch movewindowpixel exact {int(x)} {int(y)},address:{existing_address}'
                )
                subprocess.run(batch_cmd, shell=True, capture_output=True, check=False)

            # If window doesn't exist, launch it with pre-positioning (unless reposition_only mode)
            if not existing_address and not reposition_only:
                # Generate descriptive window title: "layout - Window 1 - app"
                window_title = f'{layout_name} - Window {current_index + 1} - {app}'

                # Detect if this is a terminal app
                terminal_apps = ['foot', 'kitty', 'alacritty', 'wezterm', 'terminator', 'gnome-terminal', 'konsole']
                is_terminal = any(term in app.lower() for term in terminal_apps)

                # Extract executable name for GUI apps (for class-based rules)
                app_executable = app.split()[0] if app else app

                # Create window rules only for terminals (GUI apps use exec spec instead)
                if is_terminal:
                    create_window_rule(window_title, x, y, width, height, app_executable, workspace_id, is_terminal)
                    if workspace_id:
                        subprocess.run(
                            ['hyprctl', 'keyword', 'windowrule', f'workspace {workspace_id}, match:title ^{window_title}$'],
                            capture_output=True, check=False
                        )
                # Note: GUI apps use exec spec [workspace X;float;size W H;move X Y] instead of
                # window rules to avoid conflicts with multiple instances of the same class

                # Get current windows before launching
                previous_addresses = get_all_window_addresses()

                # Launch with descriptive title and float tag
                terminal_command = node.get('terminal_command')
                working_dir = node.get('working_dir')
                launch_app(app, terminal_command, working_dir, window_title, workspace_id, x, y, width, height, force_float=True)

                # Wait for NEW window to appear (shorter timeouts since we're on correct workspace)
                # Increase timeout for commands with user interaction dialogs
                if any(dialog in app.lower() for dialog in ['zenity', 'yad', 'rofi', 'wofi']):
                    timeout = 120.0  # Give user time to select file/option AND for app to launch
                elif is_terminal:
                    timeout = 1.0
                else:
                    timeout = 3.0

                print(f"Waiting for new window (timeout={timeout}s)...", file=sys.stderr)
                new_address = wait_for_new_window(previous_addresses, timeout=timeout, expected_workspace=workspace_id)

                if new_address:
                    print(f"Detected new window: {new_address}", file=sys.stderr)
                else:
                    print(f"No new window detected within timeout", file=sys.stderr)
                if new_address:
                    existing_address = new_address

                    # Ensure window is floating and positioned correctly
                    result = subprocess.run(['hyprctl', '-j', 'clients'], capture_output=True, text=True, check=False)
                    if result.stdout:
                        clients = json.loads(result.stdout)
                        for client in clients:
                            if client['address'] == existing_address:
                                if not client.get('floating', False):
                                    # Window is tiled, make it float
                                    subprocess.run(
                                        ['hyprctl', 'dispatch', 'togglefloating', f'address:{existing_address}'],
                                        capture_output=True,
                                        check=False
                                    )

                                # Brief delay for window to be ready for resize/move
                                time.sleep(0.1)

                                # Apply size and position using batch command (more reliable)
                                batch_cmd = []
                                if width is not None and height is not None:
                                    batch_cmd.append(f'hyprctl dispatch resizewindowpixel exact {int(width)} {int(height)},address:{existing_address}')
                                if x is not None and y is not None:
                                    batch_cmd.append(f'hyprctl dispatch movewindowpixel exact {int(x)} {int(y)},address:{existing_address}')

                                if batch_cmd:
                                    subprocess.run(' && '.join(batch_cmd), shell=True, capture_output=True, check=False)
                                break

                    # Tag the window for snap functionality
                    applied_tag = tag_window(existing_address, layout_name, workspace_id, current_index, environment_name)

                    # Verify tag was applied before continuing
                    if applied_tag:
                        tag_verified = verify_tag(existing_address, applied_tag)
                        if not tag_verified:
                            # Defer this window for retry at the end
                            if failed_tags is not None:
                                failed_tags.append({
                                    'address': existing_address,
                                    'tag': applied_tag,
                                    'app': app,
                                    'position': current_index
                                })
                            print(f"Warning: Failed to verify tag '{applied_tag}' on window {app} at position {current_index}, will retry later", file=sys.stderr)

                    # Brief pause before spawning next window
                    time.sleep(0.1)
                else:
                    print(f"Warning: Failed to detect new window for {app} at position {current_index}", file=sys.stderr)

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

                apply_node(children[0], x, y, split_w1, height, monitor_info, gaps_in, windows_list, existing_windows, window_counter, layout_name, reposition_only, workspace_id, environment_name, failed_tags)
                apply_node(children[1], split_x, y, split_w2, height, monitor_info, gaps_in, windows_list, existing_windows, window_counter, layout_name, reposition_only, workspace_id, environment_name, failed_tags)
            else:  # vertical
                # Account for gap between windows
                split_h1 = (height - gaps_in) * ratio
                split_h2 = (height - gaps_in) * (1 - ratio)
                split_y = y + split_h1 + gaps_in

                apply_node(children[0], x, y, width, split_h1, monitor_info, gaps_in, windows_list, existing_windows, window_counter, layout_name, reposition_only, workspace_id, environment_name, failed_tags)
                apply_node(children[1], x, split_y, width, split_h2, monitor_info, gaps_in, windows_list, existing_windows, window_counter, layout_name, reposition_only, workspace_id, environment_name, failed_tags)


def apply_layout(layout_file, workspace=None, reposition_only=False, environment_name=None):
    """Apply a layout file to the current or specified workspace

    Args:
        layout_file: Path to the layout JSON file
        workspace: Optional workspace ID to apply to
        reposition_only: If True, only reposition existing windows
        environment_name: Optional environment name (for environment-created windows)
    """
    try:
        # Load layout
        with open(layout_file, 'r') as f:
            layout = json.load(f)

        # Switch to workspace if specified (ensures it's on correct monitor and ready for spawning)
        if workspace:
            subprocess.run(['hyprctl', 'dispatch', 'workspace', str(workspace)], check=False)
            time.sleep(0.1)  # Let workspace switch complete
            workspace_id = workspace
        else:
            workspace_id = None

        # Get monitor info
        monitors = run_hyprctl('monitors')
        if not monitors:
            print("Error: Could not get monitor information", file=sys.stderr)
            return False

        # If no workspace specified, use current workspace
        if workspace_id is None:
            active_workspace = run_hyprctl('activeworkspace')
            if active_workspace:
                workspace_id = active_workspace.get('id')

        # Find the monitor for this workspace
        # First, check if workspace is currently on a monitor
        monitor = None
        if workspace_id:
            for mon in monitors:
                # Check if this monitor has our workspace active
                if mon.get('activeWorkspace', {}).get('id') == workspace_id:
                    monitor = mon
                    break
                # Check if workspace is in this monitor's workspace list
                for ws in mon.get('workspaces', []):
                    if ws == workspace_id:
                        monitor = mon
                        break
                if monitor:
                    break

        # Fallback to focused monitor
        if not monitor:
            for mon in monitors:
                if mon.get('focused', False):
                    monitor = mon
                    break

        # Final fallback to first monitor
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

        # Generate layout name from layout filename
        layout_name = os.path.splitext(os.path.basename(layout_file))[0]

        # Get existing windows tagged with this layout on this workspace
        existing_windows = get_windows_by_layout_tag(layout_name, workspace_id, environment_name)

        # Spawn and position windows immediately (no two-pass system)
        windows_list = []
        window_counter = [0]  # Use list for mutability in recursion
        failed_tags = []  # Track windows that failed tag verification
        apply_node(layout, usable_x, usable_y, usable_width, usable_height, monitor, gaps_in, windows_list, existing_windows, window_counter, layout_name, reposition_only, workspace_id, environment_name, failed_tags)

        # Retry failed tags (apps may need more time to be ready)
        if failed_tags:
            print(f"Retrying {len(failed_tags)} failed tag(s)...", file=sys.stderr)
            time.sleep(0.5)  # Give apps more time to initialize

            for attempt in range(3):  # Up to 3 retry attempts
                if not failed_tags:
                    break

                still_failed = []
                for item in failed_tags:
                    # Re-apply tag
                    subprocess.run(
                        ['hyprctl', 'dispatch', 'tagwindow', f'+{item["tag"]}', f'address:{item["address"]}'],
                        capture_output=True,
                        check=False
                    )

                    # Verify again
                    if verify_tag(item['address'], item['tag'], max_retries=1):
                        print(f"Successfully tagged {item['app']} at position {item['position']} on retry {attempt + 1}", file=sys.stderr)
                    else:
                        still_failed.append(item)

                failed_tags = still_failed
                if failed_tags and attempt < 2:  # Don't sleep after last attempt
                    time.sleep(0.5)

            # Report any remaining failures
            if failed_tags:
                print(f"Warning: {len(failed_tags)} window(s) still failed tagging after retries:", file=sys.stderr)
                for item in failed_tags:
                    print(f"  - {item['app']} at position {item['position']}", file=sys.stderr)

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
        print("Usage: apply_layout.py <layout_file> [workspace] [--reposition-only] [--environment <env_name>]", file=sys.stderr)
        sys.exit(1)

    # Parse arguments
    layout_file = sys.argv[1]
    workspace = None
    reposition_only = False
    environment_name = None

    # Check for optional arguments
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--reposition-only':
            reposition_only = True
            i += 1
        elif arg == '--environment':
            if i + 1 < len(sys.argv):
                environment_name = sys.argv[i + 1]
                i += 2
            else:
                print("Error: --environment requires a value", file=sys.stderr)
                sys.exit(1)
        elif not workspace:
            workspace = arg
            i += 1
        else:
            i += 1

    success = apply_layout(layout_file, workspace, reposition_only, environment_name)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

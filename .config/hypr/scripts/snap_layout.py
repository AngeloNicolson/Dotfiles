#!/usr/bin/env python3
"""
Snap Layout Script for Hyprland
Re-applies the last used layout for the current workspace
"""

import os
import sys
import json
import subprocess


def get_active_workspace():
    """Get the currently active workspace"""
    try:
        result = subprocess.run(['hyprctl', '-j', 'activeworkspace'],
                               capture_output=True, text=True, check=False)
        if result.stdout:
            return json.loads(result.stdout).get('id')
    except Exception:
        pass
    return None


def get_last_layout(workspace_id):
    """Get the last applied layout for a workspace"""
    state_file = f'/tmp/hypr_layout_{workspace_id}'
    if os.path.exists(state_file):
        with open(state_file, 'r') as f:
            return f.read().strip()
    return None


def snap_layout():
    """Re-apply the last layout for current workspace"""
    workspace_id = get_active_workspace()
    if not workspace_id:
        print("Error: Could not get active workspace", file=sys.stderr)
        return False

    layout_file = get_last_layout(workspace_id)
    if not layout_file:
        print(f"No layout registered for workspace {workspace_id}", file=sys.stderr)
        return False

    if not os.path.exists(layout_file):
        print(f"Layout file not found: {layout_file}", file=sys.stderr)
        return False

    # Run apply_layout.py
    script_dir = os.path.dirname(os.path.abspath(__file__))
    apply_script = os.path.join(script_dir, 'apply_layout.py')

    result = subprocess.run([apply_script, layout_file],
                           capture_output=True, text=True)

    if result.returncode == 0:
        print(f"Snapped windows back to layout")
        return True
    else:
        print(f"Error applying layout: {result.stderr}", file=sys.stderr)
        return False


if __name__ == '__main__':
    success = snap_layout()
    sys.exit(0 if success else 1)

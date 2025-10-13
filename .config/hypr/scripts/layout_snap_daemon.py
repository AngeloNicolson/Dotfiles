#!/usr/bin/env python3
"""
Layout Snap Daemon for Hyprland
Monitors window movements and automatically snaps them back to saved layout positions
"""

import os
import sys
import json
import socket
import subprocess
import time
from pathlib import Path


class LayoutSnapDaemon:
    def __init__(self):
        self.enabled = True
        self.workspace_layouts = {}  # Maps workspace_id -> layout_file_path
        self.hypr_instance = os.environ.get('HYPRLAND_INSTANCE_SIGNATURE')
        self.runtime_dir = os.environ.get('XDG_RUNTIME_DIR', '/run/user/1000')
        self.state_file = Path('/tmp/hypr_layout_snap_state.json')
        self.load_state()

    def load_state(self):
        """Load saved layout state"""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    self.workspace_layouts = data.get('workspace_layouts', {})
                    self.enabled = data.get('enabled', True)
        except Exception as e:
            print(f"Error loading state: {e}", file=sys.stderr)

    def save_state(self):
        """Save layout state"""
        try:
            with open(self.state_file, 'w') as f:
                json.dump({
                    'workspace_layouts': self.workspace_layouts,
                    'enabled': self.enabled
                }, f)
        except Exception as e:
            print(f"Error saving state: {e}", file=sys.stderr)

    def toggle_enabled(self):
        """Toggle daemon on/off"""
        self.enabled = not self.enabled
        self.save_state()
        status = "enabled" if self.enabled else "disabled"
        subprocess.run(['notify-send', f'Layout Snap Daemon {status}'],
                      capture_output=True, check=False)
        print(f"Layout snap daemon {status}")

    def register_layout(self, workspace_id, layout_file):
        """Register a layout for a workspace"""
        self.workspace_layouts[str(workspace_id)] = layout_file
        self.save_state()

    def get_active_workspace(self):
        """Get the currently active workspace"""
        try:
            result = subprocess.run(['hyprctl', '-j', 'activeworkspace'],
                                   capture_output=True, text=True, check=False)
            if result.stdout:
                return json.loads(result.stdout).get('id')
        except Exception:
            pass
        return None

    def reapply_layout(self, workspace_id):
        """Reapply the layout for a workspace"""
        if not self.enabled:
            return

        layout_file = self.workspace_layouts.get(str(workspace_id))
        if not layout_file or not os.path.exists(layout_file):
            return

        # Run apply_layout.py
        script_dir = os.path.dirname(os.path.abspath(__file__))
        apply_script = os.path.join(script_dir, 'apply_layout.py')
        subprocess.Popen([apply_script, layout_file],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)

    def listen_to_events(self):
        """Listen to Hyprland IPC events"""
        socket_path = f"{self.runtime_dir}/hypr/{self.hypr_instance}/.socket2.sock"

        if not os.path.exists(socket_path):
            print(f"Error: Hyprland socket not found at {socket_path}", file=sys.stderr)
            return

        print(f"Listening to Hyprland events on {socket_path}")

        while True:
            try:
                sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                sock.connect(socket_path)

                buffer = ""
                while True:
                    data = sock.recv(4096)
                    if not data:
                        break

                    buffer += data.decode('utf-8')

                    # Process complete lines
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        self.handle_event(line)

                sock.close()

            except Exception as e:
                print(f"Error in event loop: {e}", file=sys.stderr)
                time.sleep(1)

    def handle_event(self, event_line):
        """Handle a single event from Hyprland"""
        if not event_line:
            return

        try:
            # Events are in format: EVENT>>DATA
            if '>>' not in event_line:
                return

            event_type, event_data = event_line.split('>>', 1)

            # Trigger on movewindow events
            if event_type == 'movewindow':
                workspace_id = self.get_active_workspace()
                if workspace_id and str(workspace_id) in self.workspace_layouts:
                    # Debounce: wait a bit to avoid rapid reapplications
                    time.sleep(0.3)
                    self.reapply_layout(workspace_id)

        except Exception as e:
            print(f"Error handling event: {e}", file=sys.stderr)


def main():
    daemon = LayoutSnapDaemon()

    # Check for commands
    if len(sys.argv) > 1:
        cmd = sys.argv[1]

        if cmd == 'toggle':
            daemon.toggle_enabled()
            sys.exit(0)
        elif cmd == 'register' and len(sys.argv) >= 4:
            workspace_id = sys.argv[2]
            layout_file = sys.argv[3]
            daemon.register_layout(workspace_id, layout_file)
            print(f"Registered layout {layout_file} for workspace {workspace_id}")
            sys.exit(0)
        elif cmd == 'status':
            print(f"Enabled: {daemon.enabled}")
            print(f"Registered layouts: {daemon.workspace_layouts}")
            sys.exit(0)

    # Run daemon
    daemon.listen_to_events()


if __name__ == '__main__':
    main()

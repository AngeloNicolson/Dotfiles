#!/bin/bash
# Simple shell wrapper for the layout manager

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Launch the unified layout manager
python3 "$SCRIPT_DIR/layout_manager_unified.py" "$@"

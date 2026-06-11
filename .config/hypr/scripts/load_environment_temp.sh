#!/usr/bin/env bash
# Temporary script to load specific environment
export CONFIG_FILE="$HOME/.config/hypr/layouts/environment_configs/Test.json"
exec "$HOME/.config/hypr/scripts/load_default_environment.sh"

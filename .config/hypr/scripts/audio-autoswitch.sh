#!/usr/bin/env bash

# Auto-switch to highest priority audio sink

set_highest_priority_sink() {
    # Get highest priority sink ID
    highest_id=$(pw-dump | jq -r '
        [.[] |
         select(.type == "PipeWire:Interface:Node") |
         select(.info.props."media.class" == "Audio/Sink") |
         {id: .id, priority: (.info.props."priority.session" // 0 | tonumber)}
        ] |
        sort_by(.priority) |
        reverse |
        .[0].id
    ')

    if [ -n "$highest_id" ]; then
        wpctl set-default "$highest_id"
    fi
}

# Set on startup
set_highest_priority_sink

# Monitor for changes and re-evaluate
pw-mon --color=never | grep --line-buffered "added\|removed" | while read -r line; do
    sleep 0.5  # Small delay to let PipeWire settle
    set_highest_priority_sink
done

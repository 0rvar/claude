#!/bin/bash
set -euo pipefail

# Usage: show-claude-changelog.sh [prev_version]
# If no prev_version provided, uses currently installed version

if [ $# -eq 0 ]; then
    prev_version=$(npm list @anthropic-ai/claude-code --depth=0 --json 2>/dev/null | jq -r '.dependencies["@anthropic-ai/claude-code"].version // "unknown"')
    if [ "$prev_version" = "unknown" ]; then
        echo "Could not determine current Claude version"
        exit 1
    fi
else
    prev_version="$1"
fi

echo "Fetching changelog since version $prev_version..."
echo

# Get all changelog entries until we hit the prev_version
curl -s https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md | sed "/^## $prev_version$/q" | head -n -1 || echo "Could not fetch changelog"
echo
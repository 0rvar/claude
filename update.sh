#!/bin/bash
set -euxo pipefail

# Update all packages that have autoupdate: true in packages.json
echo "Updating all packages with autoupdate: true in packages.json..."
packages=$(jq -r '.[] | select(.autoupdate == true) | .name' packages.json)
if [ -z "$packages" ]; then
    echo "No packages found with autoupdate: true"
    exit 0
fi
for package in $packages; do
    echo "Updating $package..."
    bun update "$package"
done

echo "Updating ai-tools dep"
nix flake lock --update-input ai-tools

echo "Updating uv-mcp packages..."
(cd uv-mcp && uv lock --upgrade)

echo "Regenerating uv-mcp/versions.nix..."
cat > uv-mcp/versions.nix << 'NIXEOF'
# Auto-generated from uv.lock - do not edit manually
# Run update.sh to regenerate
{
NIXEOF
grep -A 2 'name = "awslabs-cloudwatch-mcp-server"' uv-mcp/uv.lock | head -3 | grep 'version' | sed 's/.*"\(.*\)".*/  cloudwatch-mcp-server = "\1";/' >> uv-mcp/versions.nix
echo "}" >> uv-mcp/versions.nix

# Check bun.lock, flake.lock, and uv-mcp for changes
BUN_LOCK_DIRTY=$(git diff --quiet -- bun.lock; echo $?)
FLAKE_LOCK_DIRTY=$(git diff --quiet -- flake.lock; echo $?)
UV_MCP_DIRTY=$(git diff --quiet -- uv-mcp/; echo $?)

if [ $BUN_LOCK_DIRTY -eq 0 ] && [ $FLAKE_LOCK_DIRTY -eq 0 ] && [ $UV_MCP_DIRTY -eq 0 ]; then
    echo -e "\033[1;32mPackages already up to date\033[0m"
    exit 1
fi

echo "Regenerating bun.nix..."
bun2nix -o bun.nix

echo "Incrementing patch version in flake.nix..."
current_version=$(grep 'version = ' flake.nix | head -1 | sed 's/.*version = "\([^"]*\)".*/\1/')
IFS='.' read -ra VERSION_PARTS <<<"$current_version"
major=${VERSION_PARTS[0]}
minor=${VERSION_PARTS[1]}
patch=${VERSION_PARTS[2]}
new_patch=$((patch + 1))
new_version="$major.$minor.$new_patch"

sed -i "s/version = \"$current_version\"/version = \"$new_version\"/" flake.nix

echo "Running nix build..."
nix build .

echo "Update complete!"
echo "Version updated from $current_version to $new_version"

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

# Check both bun.lock and flake.lock for changes
BUN_LOCK_DIRTY=$(git diff --quiet -- bun.lock; echo $?)
FLAKE_LOCK_DIRTY=$(git diff --quiet -- flake.lock; echo $?)

if [ $BUN_LOCK_DIRTY -eq 0 ] && [ $FLAKE_LOCK_DIRTY -eq 0 ]; then
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

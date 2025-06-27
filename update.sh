#!/bin/bash
set -euo pipefail

echo "Updating @anthropic-ai/claude-code to latest..."
npm update @anthropic-ai/claude-code

echo "Running npm install..."
npm install

echo "Checking if package-lock.json was modified..."
if ! git diff --quiet package-lock.json; then
    echo -e "\033[1;32mPackage updated successfully\033[0m"
else
    echo
    echo -e "\033[1;32mPackage is already up to date\033[0m"
    echo
    exit 1
fi

echo "Incrementing patch version in flake.nix..."
current_version=$(grep 'version = ' flake.nix | head -1 | sed 's/.*version = "\([^"]*\)".*/\1/')
IFS='.' read -ra VERSION_PARTS <<<"$current_version"
major=${VERSION_PARTS[0]}
minor=${VERSION_PARTS[1]}
patch=${VERSION_PARTS[2]}
new_patch=$((patch + 1))
new_version="$major.$minor.$new_patch"

sed -i "s/version = \"$current_version\"/version = \"$new_version\"/" flake.nix

echo "Emptying npmDepsHash in flake.nix..."
sed -i 's/npmDepsHash = ".*"/npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="/' flake.nix

echo "Running nix build to get expected hash..."
output=$(nix build . 2>&1) || true

echo "Extracting hash from output..."
expected_hash=$(echo "$output" | grep -o 'got:    sha256-[A-Za-z0-9+/=]*' | sed 's/got:    //')

if [ -z "$expected_hash" ]; then
    echo "Error: Could not extract hash from nix build output"
    echo "Output was:"
    echo "$output"
    exit 1
fi

echo "Setting npmDepsHash to: $expected_hash"
sed -i "s|npmDepsHash = \"sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\"|npmDepsHash = \"$expected_hash\"|" flake.nix

echo "Running nix build again..."
nix build .

echo "Update complete!"
echo "Version updated from $current_version to $new_version"
echo "Hash set to: $expected_hash"

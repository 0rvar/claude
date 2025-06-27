default:
  npm install
  nix build .

validate:
  nix run .#claude -- --version
  nix run .#slite-mcp-server -- --version
  nix run .#playwright-mcp -- --version
  nix run .#smithery -- --version

install:
  nix profile remove claude && nix profile install .

update:
  ./update.sh
  just validate
  git add . && git commit -m "Update Claude version"
  just install
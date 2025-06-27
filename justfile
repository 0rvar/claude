default:
  npm install
  nix build .

validate:
  bun run validate.ts

install-mcps:
  bun run install-mcps.ts

install:
  nix profile remove claude && nix profile install .

update:
  ./update.sh
  just validate
  git add . && git commit -m "Update Claude version"
  just install
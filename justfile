default:
  npm install
  nix build .

validate:
  bun run validate.ts

install:
  nix profile remove llm-tools && nix profile install .

update:
  ./update.sh
  just validate
  git add . && git commit -m "Update versions"
  just install
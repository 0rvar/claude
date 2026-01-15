# Nix package for LLM tools

Uses bun and bun2nix for package management.

- To add a new package:
  1. Add it to `package.json`.
  2. Run `bun install`.
  3. Run `bun2nix -o bun.nix` to regenerate the nix deps.
  4. Explore the package in node_modules to figure out the CLI entrypoint.
  5. Add the package with entrypoint to `packages.json` and bump the version in `flake.nix`.
  6. Run `just validate` until it passes.
  7. Add the new package to `update.sh`.
- Never run `just install` or `just update` unless asked to.

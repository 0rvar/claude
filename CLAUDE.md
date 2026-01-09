# Nix package for LLM tools

- To add a new npm package:
  1. Add it to `package.json`.
  2. Run `npm install`.
  3. Explore the package in node_modules to figure out the CLI entrypoint
  4. Add the package with entrypoint to `flake.nix` and bump the patch version.
  5. Change npmDepsHash to be empty in `flake.nix`.
  6. Update the `justfile` to include the new command.
  7. Run `just` to get the new npm deps hash
  8. Add the new deps hash to `flake.nix`.
  9. Run `just validate` until it passes.
  10. Add the new package to `update.sh`
- Never run `just install` or `just update` unless asked to.

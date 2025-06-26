{
  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    let
      # Package configuration
      version = "0.2.15";
      npmDepsHash = "sha256-UCX4UYIZ4sxQ5vHpSzKVcT7vBUPEXsBIYWnNc4jicwI=";
      # Define executables and their paths in node_modules
      executables = {
        claude = "@anthropic-ai/claude-code/cli.js";
        mcp-remote = "mcp-remote/dist/proxy.js";
        mcp-remote-client = "mcp-remote/dist/client.js";
        slite-mcp-server = "slite-mcp-server/build/index.js";
        playwright-mcp = "@playwright/mcp/cli.js";
      };
    in
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
          ];
        };
        packages = {
          default = self.packages.${system}.claude-plus-mcp;

          claude-plus-mcp = pkgs.buildNpmPackage {
            pname = "claude-plus-mcp";
            version = version;
            src = ./.;
            npmDepsHash = npmDepsHash;

            installPhase = ''
              runHook preInstall

              mkdir -p $out/bin $out/share
              cp -r node_modules $out/share/

              # Create symlinks for all executables
              ${pkgs.lib.concatStringsSep "\n" (
                pkgs.lib.mapAttrsToList (
                  name: path: "ln -s $out/share/node_modules/${path} $out/bin/${name}"
                ) executables
              )}

              runHook postInstall
            '';
          };
        };

        apps =
          {
            default = self.apps.${system}.claude;
          }
          // (pkgs.lib.mapAttrs (
            name: _:
            flake-utils.lib.mkApp {
              drv = self.packages.${system}.claude-plus-mcp;
              name = name;
            }
          ) executables);
      }
    );

  description = "Claude code + mcp wrappers";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
}

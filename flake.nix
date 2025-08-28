{
  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ai-tools,
    }:
    let
      # Package configuration
      version = "0.3.1";
      npmDepsHash = "sha256-kRuCE6kGetCHtDbVcVH3dalY55g5nHfiPRx1mZtlKTM=";
      aiToolNames = [
        "claude-code"
        "gemini-cli" 
        "codex"
        "crush"
      ];


      # Read package configuration from packages.json
      packagesConfig = builtins.fromJSON (builtins.readFile ./packages.json);
      # Convert packages list to executables attrset
      executables = builtins.listToAttrs (
        map (pkg: {
          name = pkg.executable;
          value = pkg.path;
        }) packagesConfig
      );
    in
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        aiTools = map (name: ai-tools.packages.${system}.${name}) aiToolNames;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            bun
          ];
        };
        packages = {
          default = pkgs.symlinkJoin {
            name = "claude-plus-mcp-with-tools";
            paths = [
              self.packages.${system}.claude-plus-mcp
            ] ++ aiTools;
          };

          claude-plus-mcp = pkgs.buildNpmPackage {
            pname = "claude-plus-mcp";
            version = version;
            src = ./.;
            npmDepsHash = npmDepsHash;
            buildInputs = with pkgs; [
              bun
              uv
            ];

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
    ai-tools.url = "github:numtide/nix-ai-tools";
  };
}

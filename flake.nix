{
  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ai-tools,
      bun2nix,
    }:
    let
      # Package configuration
      version = "0.3.37";
      aiToolNames = [
        # "claude-code"
        "gemini-cli"
        "codex"
        "opencode"
        # "crush"
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
        bun2nixPkg = bun2nix.packages.${system}.default;
        bunDeps = bun2nixPkg.fetchBunDeps {
          bunNix = ./bun.nix;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_24
            bun
            bun2nix.packages.${system}.default
          ];
        };
        packages = {
          default = pkgs.symlinkJoin {
            name = "llm-tools";
            paths = [
              self.packages.${system}.llm-tools
            ]
            ++ aiTools;
          };

          llm-tools = pkgs.stdenv.mkDerivation {
            pname = "llm-tools";
            version = version;
            src = ./.;

            nativeBuildInputs = [
              pkgs.bun
              bun2nixPkg.hook
            ];

            inherit bunDeps;

            dontBuild = true;

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

        apps = {
          default = self.apps.${system}.llm-tools;
        }
        // (pkgs.lib.mapAttrs (
          name: _:
          flake-utils.lib.mkApp {
            drv = self.packages.${system}.llm-tools;
            name = name;
          }
        ) executables);
      }
    );

  description = "LLM tools packaged with Nix";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    ai-tools.url = "github:numtide/nix-ai-tools";
    bun2nix.url = "github:nix-community/bun2nix";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";
  };
}

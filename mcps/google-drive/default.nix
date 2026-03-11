{ pkgs, bun2nix }:

let
  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };
in
pkgs.stdenv.mkDerivation {
  pname = "google-drive-mcp";
  version = "0.1.0";
  src = ./.;

  nativeBuildInputs = [
    pkgs.bun
    bun2nix.hook
  ];

  inherit bunDeps;

  buildPhase = ''
    runHook preBuild
    export HOME=$TMPDIR
    bun build src/index.ts --target=bun --outfile=dist/google-drive-mcp.js
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin $out/share/google-drive-mcp
    cp dist/google-drive-mcp.js $out/share/google-drive-mcp/
    cat > $out/bin/google-drive-mcp <<EOF
    #!${pkgs.bash}/bin/bash
    exec ${pkgs.bun}/bin/bun $out/share/google-drive-mcp/google-drive-mcp.js "\$@"
    EOF
    chmod +x $out/bin/google-drive-mcp
    runHook postInstall
  '';
}

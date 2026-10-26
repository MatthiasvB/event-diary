{
  description = "Event diary: a self-hosted diary of objects and what happens to them";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (pkgs: {
        default = pkgs.callPackage ./nix/package.nix { };
      });

      nixosModules.default = import ./nix/module.nix self;

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.vips
            pkgs.sqlite
          ];
          # No login in development; PAM is covered by the VM test (`nix build .#checks.<system>.vm`).
          AUTH_BACKEND = "none";
          DATA_DIR = "./data";
        };
      });

      checks = forAllSystems (pkgs: {
        package = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        vm = pkgs.testers.runNixOSTest (import ./nix/test.nix self);
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt);
    };
}

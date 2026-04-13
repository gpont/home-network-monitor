{
  description = "Home Network Monitor — network diagnostics dashboard";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      # Linux targets are first-class; macOS builds work but several checkers
      # return null there (no /proc/net/dev, different ping/traceroute flags).
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      # ── Packages ─────────────────────────────────────────────────────────────
      packages = forAllSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.callPackage ./nix/package.nix {};
        }
      );

      # ── NixOS module ─────────────────────────────────────────────────────────
      # Usage in your NixOS configuration:
      #
      #   inputs.home-network-monitor.url = "github:gpont/home-network-monitor";
      #
      #   { inputs, ... }: {
      #     imports = [ inputs.home-network-monitor.nixosModules.default ];
      #     services.home-network-monitor = {
      #       enable      = true;
      #       openFirewall = true;
      #     };
      #   }
      nixosModules = {
        default               = import ./nix/module.nix self;
        home-network-monitor  = import ./nix/module.nix self;
      };

      # ── Dev shell ─────────────────────────────────────────────────────────────
      devShells = forAllSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [ bun nodejs_22 ];
            shellHook = ''
              echo "bun $(bun --version)  node $(node --version)"
              echo "Run 'bun install' to set up node_modules."
              echo "After adding packages: npm install --package-lock-only"
              echo "  (keeps package-lock.json in sync with bun.lock for Nix builds)"
            '';
          };
        }
      );
    };
}

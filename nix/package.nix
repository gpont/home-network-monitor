# Home Network Monitor — Nix package
#
# Build pipeline:
#   1. importNpmLock reads package-lock.json to fetch each npm package as an
#      individual fixed-output derivation (no single hash to maintain).
#   2. npmConfigHook wires those pre-fetched tarballs into an offline npm registry
#      and runs `npm ci` to populate node_modules.
#   3. `npm run build` invokes Vite which compiles the Svelte frontend and
#      writes static assets to backend/public/.
#   4. installPhase assembles the runtime tree under $out/share/ and creates
#      a makeWrapper launcher that pins the working directory.
#
# Keeping lockfiles in sync:
#   This package uses package-lock.json (npm) for reproducible Nix builds.
#   If you add/remove packages with `bun add`/`bun remove`, also run:
#
#     npm install --package-lock-only
#
#   to regenerate package-lock.json from the updated bun.lock.

{ lib
, stdenv
, nodejs_22
, bun
, makeWrapper
, importNpmLock
}:

let
  # Exclude generated/local-only directories from the store source path.
  # node_modules: created by npmConfigHook, must not come from source.
  # backend/public: Vite build output, created during buildPhase.
  # backend/data: local SQLite DB, must not be baked into the store.
  src = lib.cleanSourceWith {
    name   = "home-network-monitor-src";
    src    = ./..;
    filter = path: type:
      let rel = lib.removePrefix (toString ./.. + "/") (toString path);
      in !(lib.hasPrefix "node_modules"   rel)
      && !(lib.hasPrefix "backend/public" rel)
      && !(lib.hasPrefix "backend/data"   rel)
      && !(lib.hasPrefix ".git"           rel);
  };

  # Fetch every package listed in package-lock.json as its own FOD.
  # Hashes come from the integrity field in package-lock.json — no extra
  # outputHash to maintain.  package-lock.json must be lockfileVersion 3
  # (npm 7+) and must include all platform-specific optional packages.
  #
  # Linux rollup binaries (@rollup/rollup-linux-x64-gnu etc.) are present in
  # this project's lockfile because npm v7 records every optional package for
  # all platforms, even when the lockfile was generated on macOS.
  npmDeps = importNpmLock { npmRoot = ./.. ; };

in stdenv.mkDerivation {
  pname   = "home-network-monitor";
  version = "0.1.0";

  inherit src;

  nativeBuildInputs = [
    nodejs_22                       # npm + node runtime required by Vite/Rollup
    importNpmLock.npmConfigHook     # runs `npm ci` from pre-fetched tarballs
    makeWrapper
  ];

  # npmConfigHook reads this attribute to locate the pre-fetched tarballs.
  inherit npmDeps;

  # Step 1: build Svelte → backend/public/ via Vite.
  # (npmConfigHook already ran `npm ci` in the configure phase.)
  buildPhase = ''
    runHook preBuild
    npm run build
    runHook postBuild
  '';

  # Assemble the runtime tree and create the launcher wrapper.
  installPhase = ''
    runHook preInstall

    local share="$out/share/home-network-monitor"
    mkdir -p "$share" "$out/bin"

    # Backend TypeScript source — Bun interprets .ts natively at runtime,
    # no separate transpile step needed.
    cp -r backend/src            "$share/"
    cp    backend/tsconfig.json  "$share/"

    # Package manifest — required by Bun's module resolver.
    cp    package.json           "$share/"

    # node_modules — includes devDeps, but they are never imported at runtime
    # (Bun resolves only what backend/src/index.ts transitively imports).
    cp -r node_modules           "$share/"

    # Pre-built frontend assets — served by hono/serveStatic({ root: "./public" }).
    cp -r backend/public         "$share/"

    # Launcher: `--chdir` ensures `./public` resolves to $share/public,
    # matching the serveStatic({ root: "./public" }) call in index.ts.
    makeWrapper ${bun}/bin/bun "$out/bin/home-network-monitor" \
      --chdir     "$share" \
      --add-flags "run $share/backend/src/index.ts"

    runHook postInstall
  '';

  passthru = { inherit npmDeps; };

  meta = with lib; {
    description = "Home network monitoring dashboard — diagnostics web UI";
    homepage    = "https://github.com/gpont/home-network-monitor";
    license     = licenses.mit;
    mainProgram = "home-network-monitor";
    # All platforms compile, but the NixOS module targets Linux only.
    # On macOS, checkers that read /proc or use Linux-specific CLI flags
    # return null/unknown (handled gracefully in the code).
    platforms   = platforms.linux ++ platforms.darwin;
  };
}

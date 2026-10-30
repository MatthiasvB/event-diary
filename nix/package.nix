{
  lib,
  rustPlatform,
  buildNpmPackage,
  importNpmLock,
  nodejs,
  vips,
  pam,
  makeWrapper,
}:
let
  root = ./..;

  pamHelper = rustPlatform.buildRustPackage {
    pname = "event-diary-pam-auth";
    version = "0.1.0";
    src = lib.fileset.toSource {
      root = root + "/pam-helper";
      fileset = lib.fileset.unions [
        (root + "/pam-helper/Cargo.toml")
        (root + "/pam-helper/Cargo.lock")
        (root + "/pam-helper/src")
      ];
    };
    cargoLock.lockFile = root + "/pam-helper/Cargo.lock";
    nativeBuildInputs = [ rustPlatform.bindgenHook ];
    buildInputs = [ pam ];
  };

  src = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions [
      (root + "/package.json")
      (root + "/package-lock.json")
      (root + "/.npmrc")
      (root + "/tsconfig.json")
      (root + "/vite.config.ts")
      (root + "/vite.migrate.config.ts")
      (root + "/src")
      (root + "/static")
    ];
  };
in
buildNpmPackage {
  pname = "event-diary";
  inherit ((lib.importJSON (root + "/package.json"))) version;
  inherit src nodejs;

  npmDeps = importNpmLock { npmRoot = src; };
  npmConfigHook = importNpmLock.npmConfigHook;

  nativeBuildInputs = [ makeWrapper ];

  doCheck = true;
  # The tests measure images with vipsheader.
  nativeCheckInputs = [ vips ];
  checkPhase = ''
    runHook preCheck
    npm run check
    npm test
    runHook postCheck
  '';

  # The bundles in build/ need no node_modules. The backup command runs its TypeScript source
  # directly with Node's type stripping.
  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/event-diary $out/bin
    cp -r build package.json $out/lib/event-diary/
    mkdir -p $out/lib/event-diary/src/lib
    cp -r src/lib/server $out/lib/event-diary/src/lib/

    makeWrapper ${nodejs}/bin/node $out/bin/event-diary \
      --add-flags $out/lib/event-diary/build \
      --set NODE_ENV production \
      --set-default VIPSTHUMBNAIL ${vips}/bin/vipsthumbnail \
      --set-default PAM_HELPER ${pamHelper}/bin/event-diary-pam-auth

    makeWrapper ${nodejs}/bin/node $out/bin/event-diary-backup \
      --add-flags $out/lib/event-diary/src/lib/server/backup.ts

    makeWrapper ${nodejs}/bin/node $out/bin/event-diary-migrate \
      --add-flags $out/lib/event-diary/build/migrate/migrate.js \
      --set-default VIPSTHUMBNAIL ${vips}/bin/vipsthumbnail
    runHook postInstall
  '';

  passthru = { inherit pamHelper; };

  meta = {
    description = "Self-hosted event diary";
    mainProgram = "event-diary";
    platforms = lib.platforms.linux;
  };
}

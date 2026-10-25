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
    pname = "plant-diary-pam-auth";
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
      (root + "/src")
      (root + "/static")
    ];
  };
in
buildNpmPackage {
  pname = "plant-diary";
  inherit ((lib.importJSON (root + "/package.json"))) version;
  inherit src nodejs;

  npmDeps = importNpmLock { npmRoot = src; };
  npmConfigHook = importNpmLock.npmConfigHook;

  nativeBuildInputs = [ makeWrapper ];

  doCheck = true;
  checkPhase = ''
    runHook preCheck
    npm run check
    npm test
    runHook postCheck
  '';

  # Everything is bundled into build/; no node_modules are needed at runtime.
  # The backup command runs its TypeScript source directly (Node type stripping).
  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/plant-diary $out/bin
    cp -r build package.json $out/lib/plant-diary/
    mkdir -p $out/lib/plant-diary/src/lib
    cp -r src/lib/server $out/lib/plant-diary/src/lib/

    makeWrapper ${nodejs}/bin/node $out/bin/plant-diary \
      --add-flags $out/lib/plant-diary/build \
      --set NODE_ENV production \
      --set-default VIPSTHUMBNAIL ${vips}/bin/vipsthumbnail \
      --set-default PAM_HELPER ${pamHelper}/bin/plant-diary-pam-auth

    makeWrapper ${nodejs}/bin/node $out/bin/plant-diary-backup \
      --add-flags $out/lib/plant-diary/src/lib/server/backup.ts
    runHook postInstall
  '';

  passthru = { inherit pamHelper; };

  meta = {
    description = "Self-hosted plant diary";
    mainProgram = "plant-diary";
    platforms = lib.platforms.linux;
  };
}

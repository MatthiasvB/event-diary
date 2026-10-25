self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.plant-diary;
  inherit (lib)
    mkEnableOption
    mkIf
    mkOption
    optional
    optionalAttrs
    types
    ;

  usePam = cfg.auth.backend == "pam";
  listen =
    if lib.hasInfix ":" cfg.address then
      "[${cfg.address}]:${toString cfg.port}"
    else
      "${cfg.address}:${toString cfg.port}";

  environment = {
    DATA_DIR = cfg.dataDir;
    CACHE_DIR = "/var/cache/plant-diary";
    APP_NAME = cfg.appName;
    PLANT_ID_PREFIX = cfg.plantIdPrefix;
    BODY_SIZE_LIMIT = cfg.maxUploadSize;
    AUTH_BACKEND = cfg.auth.backend;
    PAM_SERVICE = cfg.auth.pam.service;
    AUTH_ALLOWED_USERS = lib.concatStringsSep "," cfg.auth.allowedUsers;
  }
  // optionalAttrs (cfg.idleTimeout != null) { IDLE_TIMEOUT = toString cfg.idleTimeout; }
  // cfg.environment;

  hardening = {
    User = "plant-diary";
    Group = "plant-diary";
    UMask = "0027";
    ReadWritePaths = [ cfg.dataDir ];
    NoNewPrivileges = true;
    ProtectSystem = "strict";
    ProtectHome = true;
    PrivateTmp = true;
    PrivateDevices = true;
    ProtectKernelTunables = true;
    ProtectKernelModules = true;
    ProtectKernelLogs = true;
    ProtectControlGroups = true;
    ProtectClock = true;
    ProtectHostname = true;
    ProtectProc = "invisible";
    ProcSubset = "pid";
    RestrictAddressFamilies = [
      "AF_UNIX"
      "AF_INET"
      "AF_INET6"
    ];
    RestrictNamespaces = true;
    RestrictRealtime = true;
    RestrictSUIDSGID = true;
    LockPersonality = true;
    SystemCallArchitectures = "native";
    SystemCallFilter = [ "@system-service" ];
    CapabilityBoundingSet = "";
  };
in
{
  options.services.plant-diary = {
    enable = mkEnableOption "the plant diary web app";

    package = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "plant-diary.packages.\${system}.default";
      description = "The plant diary package.";
    };

    address = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Address to listen on. Keep it local and put a reverse proxy with HTTPS in front.";
    };

    port = mkOption {
      type = types.port;
      default = 8240;
      description = "Port to listen on.";
    };

    dataDir = mkOption {
      type = types.str;
      default = "/var/lib/plant-diary";
      description = "Directory for all persistent data (database, photos, snapshot).";
    };

    snapshotDir = mkOption {
      type = types.str;
      readOnly = true;
      default = "${cfg.dataDir}/snapshot";
      defaultText = lib.literalExpression ''"''${dataDir}/snapshot"'';
      description = ''
        Where `plant-diary-backup.service` writes a consistent database snapshot.
        Back up this directory together with {option}`services.plant-diary.photosDir`.
      '';
    };

    photosDir = mkOption {
      type = types.str;
      readOnly = true;
      default = "${cfg.dataDir}/photos";
      defaultText = lib.literalExpression ''"''${dataDir}/photos"'';
      description = "Photo originals. Files are written once and never changed.";
    };

    appName = mkOption {
      type = types.str;
      default = "Pflanzentagebuch";
      example = "Orchideen-Tagebuch";
      description = "Name shown in the app and on the home screen.";
    };

    plantIdPrefix = mkOption {
      type = types.str;
      default = "P-";
      example = "ORC-";
      description = "Prefix of new plant IDs (P-001, P-002, …).";
    };

    maxUploadSize = mkOption {
      type = types.str;
      default = "100M";
      description = ''
        Largest accepted request (all photos of one event together). The reverse proxy
        needs at least the same limit, e.g. nginx `client_max_body_size 100M;`.
      '';
    };

    idleTimeout = mkOption {
      type = types.nullOr types.ints.positive;
      default = 600;
      description = ''
        The service is started on the first request (socket activation) and stops after
        this many idle seconds, so it uses no memory while nobody uses it.
        `null` keeps it running once started.
      '';
    };

    auth = {
      backend = mkOption {
        type = types.enum [
          "pam"
          "none"
        ];
        default = "pam";
        description = ''
          How users log in. `pam`: with their system account password.
          `none`: no login (only if the reverse proxy restricts access).
        '';
      };

      pam.service = mkOption {
        type = types.str;
        default = "plant-diary";
        description = ''
          PAM service to authenticate against. A default `security.pam.services`
          entry is created for it. The app runs in the `shadow` group so that pam_unix
          can verify passwords.
        '';
      };

      allowedUsers = mkOption {
        type = types.listOf types.str;
        default = [ ];
        example = [ "alice" ];
        description = "Users that may log in. Empty: every user PAM accepts.";
      };
    };

    environment = mkOption {
      type = types.attrsOf types.str;
      default = { };
      description = "Extra environment variables for the app, e.g. `SESSION_DAYS`.";
    };
  };

  config = mkIf cfg.enable {
    users.users.plant-diary = {
      isSystemUser = true;
      group = "plant-diary";
    };
    users.groups.plant-diary = { };

    security.pam.services = mkIf usePam { ${cfg.auth.pam.service} = { }; };

    systemd.tmpfiles.settings."10-plant-diary" =
      lib.genAttrs
        [
          cfg.dataDir
          "${cfg.dataDir}/db"
          cfg.photosDir
          cfg.snapshotDir
        ]
        (_: {
          d = {
            user = "plant-diary";
            group = "plant-diary";
            mode = "0750";
          };
        });

    systemd.sockets.plant-diary = {
      description = "Plant diary socket";
      wantedBy = [ "sockets.target" ];
      listenStreams = [ listen ];
    };

    systemd.services.plant-diary = {
      description = "Plant diary";
      requires = [ "plant-diary.socket" ];
      after = [ "plant-diary.socket" ];
      unitConfig.RequiresMountsFor = [ cfg.dataDir ];
      inherit environment;
      serviceConfig = hardening // {
        ExecStart = lib.getExe cfg.package;
        # Not "always": the app exits on purpose when idle and the socket restarts it.
        Restart = "on-failure";
        RestartSec = 2;
        CacheDirectory = "plant-diary";
        SupplementaryGroups = optional usePam "shadow";
      };
    };

    systemd.services.plant-diary-backup = {
      description = "Plant diary: consistent database snapshot for backups";
      unitConfig.RequiresMountsFor = [ cfg.dataDir ];
      environment = { inherit (environment) DATA_DIR; };
      serviceConfig = hardening // {
        Type = "oneshot";
        ExecStart = "${cfg.package}/bin/plant-diary-backup";
      };
    };
  };
}

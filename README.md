# Plant diary

A small self-hosted web app for keeping a diary of your plants: care, growth, flowering,
problems and treatments. It answers questions like "when did I last fertilize this plant?",
"when does it usually start flowering?" or "how did that root rot develop?".

It is mobile first, installable as a PWA on the phone's home screen, and has a German UI.
Nothing is specific to one kind of plant.

## Using it

- **Plants** (start page): cards with cover photo, name, ID and "last …" columns
  (e.g. "Gedüngt: vor 12 Tagen"). Search, filter by active state or by any attribute.
  The columns are chosen under _Mehr → Einstellungen_.
- **Erfassen (+)**: the main flow. Choose plant(s), type or choose the event type, add
  fields, a note and photos, then save. Choosing a type fills in its usual fields and shows
  its hint. Several plants at once create a _batch_ that can later be corrected in one go.
- **Foto** (camera in the navigation): photo first, then the plant, then save. The photo's
  capture date is offered as the event date.
- **Plant page**: current attributes with their history, a timeline with photos, and
  _Wiederholen_ (repeat) on every event.
- **Ereignisse**: all events, filtered by plant, type, category and date range.
- **Mehr → Daten pflegen**: rename or merge values (categories, event types, field names,
  values). Similar spellings are listed automatically ("Catleya" → "Cattleya").

### Free values with suggestions

Event types, categories, field names and values are all just text you type. Every such
field suggests existing values, ranked by match quality, frequency, recency and context
(e.g. products used with this event type). Matching ignores case and umlauts and tolerates
small typos. A value that doesn't exist yet is marked "+ Neu: …", and close existing
values are offered to avoid near-duplicates.

Events and plants have a small fixed core. Everything else is a key/value field:

- **Event fields** (e.g. _Produkt_, _Wert_, _Einheit_) belong to the event.
- **Plant fields** ("ändert Pflanze", e.g. _Standort_, _Substrat_, _Topfgröße_) set a plant
  attribute from the event's date on. The plant page shows the current value and its
  history. Deleting the event restores the previous value.

Event types learn which fields they are used with. On the event type page you can edit
them and set default values; without a default, the value from the last use is suggested.

## Development

```sh
nix develop          # Node, vips, sqlite; AUTH_BACKEND=none, DATA_DIR=./data
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (suggestions, merging, backup)
npm run check        # svelte-check / TypeScript
nix flake check      # package build incl. tests, NixOS VM test
```

Stack: SvelteKit 3 with `adapter-node`, Svelte 5, SQLite through Node's built-in
`node:sqlite`, and `vipsthumbnail` for thumbnails (handles HEIC and EXIF orientation).
There are no native Node modules. The PAM check is a small Rust helper in
[pam-helper/](pam-helper/).

UI strings live in [src/lib/i18n.ts](src/lib/i18n.ts).

### Environment variables

| Variable             | Default            | Meaning                                       |
| -------------------- | ------------------ | --------------------------------------------- |
| `DATA_DIR`           | `./data`           | Persistent data (see layout below)            |
| `CACHE_DIR`          | `$DATA_DIR/cache`  | Thumbnails; regenerable, don't back up        |
| `APP_NAME`           | `Pflanzentagebuch` | Name in the app and on the home screen        |
| `PLANT_ID_PREFIX`    | `P-`               | New plant IDs: `P-001`, `P-002`, …            |
| `AUTH_BACKEND`       | `pam`              | `pam` or `none`                               |
| `PAM_SERVICE`        | `plant-diary`      | PAM service name                              |
| `AUTH_ALLOWED_USERS` | (all)              | Comma-separated users allowed to log in       |
| `SESSION_DAYS`       | `90`               | Login lifetime                                |
| `BODY_SIZE_LIMIT`    | `512K`             | Max. upload size (adapter-node), e.g. `100M`  |
| `IDLE_TIMEOUT`       | (none)             | Exit after N idle seconds (socket activation) |

## NixOS

```nix
{
  inputs.plant-diary.url = "git+file:///path/to/this/repo"; # or your git remote

  outputs = { nixpkgs, plant-diary, ... }: {
    nixosConfigurations.server = nixpkgs.lib.nixosSystem {
      modules = [ plant-diary.nixosModules.default ./configuration.nix ];
    };
  };
}
```

```nix
{ config, ... }:
let
  diary = config.services.plant-diary;
in
{
  services.plant-diary = {
    enable = true;
    port = 8240;                              # default
    dataDir = "/mnt/data/plant-diary";        # default: /var/lib/plant-diary
    appName = "Orchideen-Tagebuch";
    plantIdPrefix = "ORC-";
    # auth.allowedUsers = [ "matthias" ];     # default: every user PAM accepts
  };

  custom.roleRelated.homeCloud.systemBackup = {
    paths = [ diary.snapshotDir diary.photosDir ];
    prepareServices = [ config.systemd.services.plant-diary-backup.name ];
  };

  services.nginx.virtualHosts."plants.example.org" = {
    forceSSL = true;
    locations."/" = {
      proxyPass = "http://127.0.0.1:${toString diary.port}";
      recommendedProxySettings = true; # passes the Host header, needed for form submissions
      extraConfig = "client_max_body_size ${diary.maxUploadSize};";
    };
  };
}
```

What the module sets up:

- `plant-diary.socket` listens on `address:port` (default `127.0.0.1:8240`). The first
  request starts `plant-diary.service`, which exits again after `idleTimeout` seconds
  without requests (default 600). So the app uses no memory while nobody uses it, about
  100 MB while it does, and the first request after a pause takes about half a second.
  Set `idleTimeout = null` to keep it running once started.
- Its own system user, systemd hardening, the cache in `CacheDirectory`
  (`/var/cache/plant-diary`), and `Restart=on-failure` (not `always`, which would undo
  the idle exit).
- `plant-diary-backup.service` (`Type=oneshot`) writes a consistent database snapshot.
- Read-only options `snapshotDir` and `photosDir` for the backup paths.
- With `auth.backend = "pam"` (default): a `security.pam.services.plant-diary` entry, and
  the service runs with the supplementary group `shadow`, which pam_unix needs to verify
  passwords of other users. `auth.backend = "none"` turns login off; only use that if the
  proxy restricts access.

### Authentication

Users log in with their system account (PAM) and get a session cookie for 90 days.
Backends live in [src/lib/server/auth/](src/lib/server/auth/): a backend implements
`checkPassword(username, password)`; sessions, login page and throttling are shared.
To add one (e.g. trusting a proxy header), implement `AuthBackend` and register it in
`backends` in `auth/index.ts`.

## Data directory

```
<dataDir>/
├── db/diary.sqlite        live database (+ -wal/-shm); don't back up directly
├── photos/<uuid>.<ext>    photo originals, written once, never changed   ← back up
└── snapshot/diary.sqlite  consistent snapshot from the backup command   ← back up
/var/cache/plant-diary/thumbs/   resized JPEGs, regenerated on demand
```

## Backup and restore

`plant-diary-backup` (the oneshot service on NixOS) runs SQLite's `VACUUM INTO` while the
app keeps running, then atomically replaces `snapshot/diary.sqlite`. Back up `snapshot/` and
`photos/` after it. Copying the live database file is not safe.

Restore (tested by the VM test in [nix/test.nix](nix/test.nix)):

```sh
systemctl stop plant-diary.socket plant-diary.service
rm -rf /mnt/data/plant-diary && systemd-tmpfiles --create   # or restore into an empty dir
install -o plant-diary -g plant-diary -m 0640 \
  <backup>/snapshot/diary.sqlite /mnt/data/plant-diary/db/diary.sqlite
cp -a <backup>/photos/. /mnt/data/plant-diary/photos/
chown -R plant-diary:plant-diary /mnt/data/plant-diary/photos
systemctl start plant-diary.socket
```

Thumbnails are regenerated on demand. Photos uploaded after the last snapshot are just
unreferenced files after a restore.

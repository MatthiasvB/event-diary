# Plant diary

A small self-hosted web app for keeping a diary of your plants: care, growth, flowering,
problems and treatments. It answers questions like "when did I last fertilize this plant?",
"when does it usually start flowering?" or "how did that root rot develop?".

It is mobile first, installable as a PWA on the phone's home screen, and has a German UI.
Nothing is specific to one kind of plant.

## Using it

- **Diaries**: after logging in you see your diaries (with only one, it opens directly).
  Each diary has its own plants, events, event types, suggestions and settings, and its
  own URL: `/<diary>/…`. New diaries are created on that list; _Mehr → Tagebuch wechseln_
  leads back to it.
- **Plants** (start page of a diary): cards with cover photo, name, ID and "last …" columns
  (e.g. "Gedüngt: vor 12 Tagen"). Search, filter by active state or by any attribute.
  The columns are chosen under _Mehr → Einstellungen_.
- **Erfassen (+)**: the main flow. Choose plant(s), type or choose the event type, add
  fields, a note and photos, then save. Choosing a type fills in its usual fields and shows
  its hint. Several plants at once create a _batch_ that can later be corrected in one go.
- **Foto** (camera in the navigation): photo first, then the plant, then save. The photo's
  capture date is offered as the event date.
- **Sharing photos into the app** (Android): installed via Chrome (or another
  Chromium-based browser), the app appears in the system share sheet for images. Shared
  photos open the event form in photo mode. Firefox for Android and iOS don't support
  this for web apps. A minimal service worker receives the shared images; it doesn't
  cache the app or provide offline use.
- **Drag and drop** (desktop): drop photos onto a plant's card or page, or onto the photo
  area of a form.
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

### Users and diaries

Users log in with their system account (PAM) and get a session cookie for 90 days.
Each user sees only the diaries they are a member of. A diary is its own database
(`db/diaries/<id>.sqlite`); a central database (`db/registry.sqlite`) records the diaries
(name, type), the memberships (user, diary, role) and the sessions. Every access to a
diary's data checks the membership, so another user's diary, its pages and its photos
are simply "not found".

This is built to grow without restructuring:

- **Other kinds of diaries**: a diary has a type; for now there is only `plants`, whose
  views are the pages under `src/routes/[diary]/`. Another type gets its own views.
- **Shared diaries**: sharing means adding a membership (with a role such as `member` or
  `viewer` next to today's `owner`); the data model is ready, the UI doesn't exist yet.

Without login (`auth.backend = "none"`) there is one implicit user, `local`.

### Authentication backends

Backends live in [src/lib/server/auth/](src/lib/server/auth/): a backend implements
`checkPassword(username, password)`; sessions, login page and throttling are shared.
To add one (e.g. trusting a proxy header), implement `AuthBackend` and register it in
`backends` in `auth/index.ts`.

## Data directory

```
<dataDir>/
├── db/                        live databases (+ -wal/-shm); don't back up directly
│   ├── registry.sqlite        diaries, memberships, sessions
│   └── diaries/<id>.sqlite    one per diary
├── photos/<uuid>.<ext>        photo originals of all diaries, written once   ← back up
└── snapshot/                  consistent copies of db/ from the backup command  ← back up
/var/cache/plant-diary/thumbs/ resized JPEGs, regenerated on demand
```

Photo files are shared by all diaries, but a photo is only served through the diary that
references it.

## Backup and restore

`plant-diary-backup` (the oneshot service on NixOS) runs SQLite's `VACUUM INTO` for every
database in `db/` while the app keeps running, and atomically replaces its copy in
`snapshot/` (same relative path; copies of databases that no longer exist are removed).
Back up `snapshot/` and `photos/` after it. Copying the live database files is not safe.

Restore (tested by the VM test in [nix/test.nix](nix/test.nix)):

```sh
systemctl stop plant-diary.socket plant-diary.service
rm -rf /mnt/data/plant-diary && systemd-tmpfiles --create   # or restore into an empty dir
cp -a <backup>/snapshot/. /mnt/data/plant-diary/db/
cp -a <backup>/photos/. /mnt/data/plant-diary/photos/
chown -R plant-diary:plant-diary /mnt/data/plant-diary/db /mnt/data/plant-diary/photos
systemctl start plant-diary.socket
```

Thumbnails are regenerated on demand. Photos uploaded after the last snapshot are just
unreferenced files after a restore.

# Event diary

A small self-hosted web app for keeping a diary of objects ("Objekte") and what happens
to them: plants and their care, a house being built, a car and its repairs. It answers
questions like "when did I last fertilize this plant?" or "what was done on the cellar
ceiling, and when?".

It is mobile first, installable as a PWA on the phone's home screen, and has a German UI.

## Using it

- **Diaries**: after logging in you see your diaries (with only one, it opens directly).
  Each diary has its own objects, events, event types, suggestions and settings, and its
  own URL: `/<diary>/…`. New diaries are created on that list. _Mehr → Alle Tagebücher_
  leads back to it.
- **Objekte** (start page of a diary): cards with cover photo, name and "last …" columns
  (e.g. "Gedüngt: vor 12 Tagen"). Search, filter by active state or by any property.
  The columns are chosen under _Mehr → Einstellungen_.
- **Erfassen (+)**: the main flow. Choose object(s), type or choose the event type, add
  fields, a note, photos, videos and other files, then save. Choosing a type fills in its
  usual fields and shows its hint. Several objects at once create one event for all of them
  (_Sammelbuchung_). Editing it from one object's timeline changes it for that object only,
  which then gets an event of its own, unless _Für alle … übernehmen_ is checked. Deleting it
  there removes only that object, and deleting an object keeps the events it shares.
- **Attachments**: photos (thumbnails, viewer, cover image), videos (played in the
  browser's own player, with seeking) and any other files such as PDFs, which are listed by
  name and can be downloaded. PDFs and plain text can also be opened in the browser. Files
  are kept exactly as uploaded. When saving, they are uploaded one by one, so the size
  limit (`maxUploadSize`) applies per file. Videos play if the browser supports their
  format (e.g. iPhone HEVC `.mov` not everywhere). They can always be downloaded.
  Image sizes are recorded on upload, so pages keep the space of an image while it loads.
  The viewer shows the small preview scaled up at once and the full image when it has
  arrived, so you can flip through quickly even on a slow connection.
- **Foto** (camera in the navigation): photo first, then the object, then save. The photo's
  capture date is offered as the event date.
- **Sharing photos into the app** (Android): installed via Chrome (or another
  Chromium-based browser), the app appears in the system share sheet for photos and
  videos. Shared files open the event form in photo mode. Firefox for Android and iOS don't support
  this for web apps. A minimal service worker receives the shared images. It doesn't
  cache the app or provide offline use.
- **Drag and drop** (desktop): drop photos or videos onto an object's card or page, or any
  files onto the file area of a form.
- **Object page**: current properties with their history, a timeline with photos, and
  _Wiederholen_ (repeat) on every event.
  The order of the properties is set once for the whole diary under _Mehr →
  Einstellungen_. Names not placed there follow alphabetically.
- **Ereignisse**: all events, filtered by object, type, category and date range.
- **Mehr → Daten pflegen**: rename or merge values (categories, event types, field names,
  values). Similar spellings are listed automatically ("Catleya" → "Cattleya").
- **Kinds of values**: properties and event details are plain text by default. A new name
  can get its kind right where it is first entered, or later under _Daten pflegen → Namen
  von Angaben/Eigenschaften_. A name can be a date (entered as
  `YYYY-MM-DD`, with a calendar) or a number with an optional unit ("12,5 cm"). Values
  stay text in the database (dates as `YYYY-MM-DD`, numbers with a dot), so changing the
  kind never loses data. A value that doesn't fit is shown as typed. "Speichern & weitere"
  carries date properties (e.g. _Erworben am_) over to the next object.

### Free values with suggestions

Event types, categories, field names and values are all just text you type. Every such
field suggests existing values, ranked by match quality, frequency, recency and context
(e.g. products used with this event type). Matching ignores case and umlauts and tolerates
small typos. A value that doesn't exist yet is marked "+ Neu: …", and close existing
values are offered to avoid near-duplicates.

Events and objects have a small fixed core. Everything else is a key/value field:

- **Event details** (e.g. _Produkt_, _Menge_) belong to the event.
- **Property changes** (e.g. _Standort_, _Substrat_, _Topfgröße_) set a property of the
  object from the event's date on. The object page shows the current value and its
  history, and the event shows what it changed ("Substrat: Moos → Rinde"). Deleting the
  event restores the previous value.

A name is either a property or an event detail. Entering a property's name in an event
always records a change (marked "ändert Eigenschaft"). Suggestions mark both kinds. A new
name, or an event detail's name, becomes a property when chosen so in the event form or on
an event type, or added on an object. The earlier event details of that name then become
changes of their objects' property. A property stays one, even when no object has a value
for it any more. Only the first recorded change of a property can set the value before
it (or mark it as not recorded). For later ones, the value before is the previous change's.

Event types learn which fields they are used with. On the event type page you can edit
them and set default values. Without a default, the value from the last use is suggested.

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
| `APP_NAME`           | `Ereignistagebuch` | Name in the app and on the home screen        |
| `AUTH_BACKEND`       | `pam`              | `pam` or `none`                               |
| `PAM_SERVICE`        | `event-diary`      | PAM service name                              |
| `AUTH_ALLOWED_USERS` | (all)              | Comma-separated users allowed to log in       |
| `SESSION_DAYS`       | `90`               | Login lifetime                                |
| `BODY_SIZE_LIMIT`    | `512K`             | Max. size per uploaded file, e.g. `100M`      |
| `IDLE_TIMEOUT`       | (none)             | Exit after N idle seconds (socket activation) |

## NixOS

```nix
{
  inputs.event-diary.url = "git+file:///path/to/this/repo"; # or your git remote

  outputs = { nixpkgs, event-diary, ... }: {
    nixosConfigurations.server = nixpkgs.lib.nixosSystem {
      modules = [ event-diary.nixosModules.default ./configuration.nix ];
    };
  };
}
```

```nix
{ config, ... }:
let
  diary = config.services.event-diary;
in
{
  services.event-diary = {
    enable = true;
    port = 8240;                              # default
    dataDir = "/mnt/data/event-diary";        # default: /var/lib/event-diary
    appName = "Orchideen-Tagebuch";
    # auth.allowedUsers = [ "matthias" ];     # default: every user PAM accepts
  };

  custom.roleRelated.homeCloud.systemBackup = {
    paths = [ diary.snapshotDir diary.photosDir ];
    prepareServices = [ config.systemd.services.event-diary-backup.name ];
  };

  services.nginx.virtualHosts."diary.example.org" = {
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

- `event-diary.socket` listens on `address:port` (default `127.0.0.1:8240`). The first
  request starts `event-diary.service`, which exits again after `idleTimeout` seconds
  without requests (default 600). So the app uses no memory while nobody uses it, about
  100 MB while it does, and the first request after a pause takes about half a second.
  Set `idleTimeout = null` to keep it running once started.
- Its own system user, systemd hardening, the cache in `CacheDirectory`
  (`/var/cache/event-diary`), and `Restart=on-failure` (not `always`, which would undo
  the idle exit).
- `event-diary-migrate.service` (`Type=oneshot`) migrates all databases at boot and on
  every `nixos-rebuild switch` that updates the app. `event-diary.service` starts only
  after it.
- `event-diary-backup.service` (`Type=oneshot`) writes a consistent database snapshot.
- Read-only options `snapshotDir` and `photosDir` for the backup paths.
- With `auth.backend = "pam"` (default): a `security.pam.services.event-diary` entry, and
  the service runs with the supplementary group `shadow`, which pam_unix needs to verify
  passwords of other users. `auth.backend = "none"` turns login off. Only use that if the
  proxy restricts access.

### Users and diaries

Users log in with their system account (PAM) and get a session cookie for 90 days.
Each user sees only the diaries they are a member of. A diary is its own database
(`db/diaries/<id>.sqlite`). A central database (`db/registry.sqlite`) records the diaries
(name, type), the memberships (user, diary, role) and the sessions. Every access to a
diary's data checks the membership, so another user's diary, its pages and its files
are simply "not found".

A user can have several diaries ("Mehr → Alle Tagebücher"). The owner renames or
deletes one under "Mehr → Tagebuch & Teilen". Deleting removes its database and files.

**Sharing** works with one-time invite links, so nobody ever picks from (or learns) the
list of accounts on the server:

1. The owner creates a link under "Tagebuch & Teilen", choosing _Kann bearbeiten_
   (editor) or _Nur ansehen_ (viewer), and sends it, e.g. by messenger.
2. The recipient opens it, logs in with their own account and taps "Annehmen".

A link works once and for 7 days, and can be revoked. Only a hash of it is stored.
Opening it doesn't use it up (link previews would), only the button does. Login rules
still apply (`auth.allowedUsers`). The owner sees the members, changes their role or
removes them, which takes effect immediately. Members can leave. Viewers can't change
anything: every change is a POST inside the diary, and those are refused for viewers.

Diaries have a type. For now there is only `objects`, whose views are the pages under
`src/routes/[diary]/`. Another type would get its own views.

Without login (`auth.backend = "none"`) there is one implicit user, `local`.

### Authentication backends

Backends live in [src/lib/server/auth/](src/lib/server/auth/): a backend implements
`checkPassword(username, password)`. Sessions, login page and throttling are shared.
To add one (e.g. trusting a proxy header), implement `AuthBackend` and register it in
`backends` in `auth/index.ts`.

## Data directory

```
<dataDir>/
├── db/                        live databases (+ -wal/-shm); don't back up directly
│   ├── registry.sqlite        diaries, memberships, sessions
│   └── diaries/<id>.sqlite    one per diary
├── photos/<uuid>.<ext>        attachments of all diaries (photos, videos, documents),
│                              written once                                   ← back up
├── snapshot/                  consistent copies of db/ from the backup command  ← back up
└── pre-migration/             copies of databases from before an update changed them
/var/cache/event-diary/thumbs/ resized JPEGs, regenerated on demand
```

Attachment files are shared by all diaries, but a file is only served through the diary
that references it. Types a browser could run as code (HTML, SVG, …) are only ever served
as downloads, so a shared diary can't be used to inject scripts.

## Backup and restore

`event-diary-backup` (the oneshot service on NixOS) runs SQLite's `VACUUM INTO` for every
database in `db/` while the app keeps running, and atomically replaces its copy in
`snapshot/` (same relative path). Copies of databases that no longer exist are removed.
Back up `snapshot/` and `photos/` after it. Copying the live database files is not safe.

Restore (tested by the VM test in [nix/test.nix](nix/test.nix)):

```sh
systemctl stop event-diary.socket event-diary.service
rm -rf /mnt/data/event-diary && systemd-tmpfiles --create   # or restore into an empty dir
cp -a <backup>/snapshot/. /mnt/data/event-diary/db/
cp -a <backup>/photos/. /mnt/data/event-diary/photos/
chown -R event-diary:event-diary /mnt/data/event-diary/db /mnt/data/event-diary/photos
systemctl start event-diary.socket
```

Thumbnails are regenerated on demand. Files uploaded after the last snapshot are just
unreferenced files after a restore. A snapshot from an older version is migrated when the
app starts.

## Updates

`event-diary-migrate` brings every database to the installed version. On NixOS it runs at
boot and with every deploy that updates the app, whether anyone uses the app or not. The
app itself also migrates when it starts, which covers `npm run dev` and installs without
the module. Each database that changes is first copied to
`pre-migration/<path in db/>.v<old version>.sqlite`. A step that fails is rolled back.
The unit then fails, so `nixos-rebuild switch` reports it, and the app doesn't start. The
error is in the log (`journalctl -u event-diary-migrate`). The copies are not needed once
the new version runs and can be deleted.

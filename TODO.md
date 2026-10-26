# Eventually

Things to change at some point, but not urgently.

## Naming left over from plants and photos

- **Attachments are still called photos internally:**
  - Data folder `photos/` → `files/`. This affects the module option `photosDir` and the backup paths on the server.
  - Database tables `photos` and `event_photos` → `files`/`event_files`. Needs a migration.
  - Route `/[diary]/photos/[id]` → `/[diary]/files/[id]`. Old links would break.
- **Objects are still called plants internally:**
  - Routes `/[diary]/plants/…`. URLs would change.
  - Diary type `plants`, stored in the registry.
  - Tables `plants`/`plant_attrs`.
  - Code identifiers (`PlantForm`, `plantIds`, `t.plants`, …).
  - The `P-` prefix of internal object IDs.
- **Plant-specific icons:** 🌱 placeholder, leaf in the navigation, app icon.
- **Plant-specific names outside the code:** the README still describes plant use in places. The GitHub repository is `plant-diary` and the local folder `orchid_diary`.

## Features

- **Video previews:** tiles load the video's first frame in the browser. Real poster thumbnails would need ffmpeg on the server.
- **Upload progress:** shown per file; a percentage for large videos would need byte-level progress.
- **Sharing:**
  - A diary has exactly one owner.
  - No second owner, no ownership transfer.
  - The owner can't leave.
- **Overview columns:** without saved settings there are none (the plant-specific defaults were removed). A neutral default might help new diaries.

## Workarounds

- **Requests rejected before their body is read:** `src/hooks.server.ts` closes them one second after answering. Otherwise Node never finishes them and adapter-node never exits when idle (`IDLE_TIMEOUT`). This can go once SvelteKit/adapter-node handle it; consider reporting it upstream.

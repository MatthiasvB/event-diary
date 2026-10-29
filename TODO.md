# Eventually

Things to change at some point, but not urgently.

## Naming left over from plants and photos

These need changes on the server, so they wait:

- **Data folder `photos/` → `files/`:** affects the module option `photosDir` and the
  backup paths on the server.
- **Repository and folder names:** the GitHub repository is `plant-diary` and the local
  folder `orchid_diary`; the flake input on the server points at the repository.

## Features

- **Video previews:** tiles load the video's first frame in the browser. Real poster thumbnails would need ffmpeg on the server.
- **Upload progress:** shown per file; a percentage for large videos would need byte-level progress.
- **Sharing:**
  - A diary has exactly one owner.
  - No second owner, no ownership transfer.
  - The owner can't leave.
- **Overview columns:** without saved settings there are none (the plant-specific defaults were removed). A neutral default might help new diaries.

## Cleanup

- **Database migrations:** once the server has run them, the steps to diary versions 6 and
  7 and registry version 3 in `src/lib/server/db.ts` and `registry.ts` can go (keep
  `create`).

## Workarounds

- **Requests rejected before their body is read:** `src/hooks.server.ts` closes them one second after answering. Otherwise Node never finishes them and adapter-node never exits when idle (`IDLE_TIMEOUT`). This can go once SvelteKit/adapter-node handle it; consider reporting it upstream.

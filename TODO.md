# Eventually

Things to change at some point, but not urgently.

## Naming left over from plants and photos

These need changes on the server, so they wait:

- **Data folder `photos/` → `files/`:** affects the module option `photosDir` and the
  backup paths on the server.
- **Repository and folder names:** the GitHub repository is `plant-diary` and the local
  folder `orchid_diary`. The flake input on the server points at the repository.

## Features

- **Video previews:** tiles load the video's first frame in the browser. Real poster thumbnails would need ffmpeg on the server.
- **Upload progress:** shown per file. A percentage for large videos would need byte-level progress.
- **Sharing:**
  - A diary has exactly one owner.
  - No second owner, no ownership transfer.
  - The owner can't leave.
- **Overview columns:** without saved settings there are none (the plant-specific defaults were removed). A neutral default might help new diaries.
- Not all properties benefit from suggestions. A field "price" for which I enter "8 €" doesn't benefit from a hint that "9 €" already exists. There should be an opt-out from suggestions on given properties.

## Cleanup

- **Database migrations:** every database is migrated on deploy. Once the server has been
  deployed with this version, the steps to diary versions 6 to 12 and registry version 3 in
  `src/lib/server/diarySchema.ts` and `registry.ts` can go (keep `create`), together with
  the fixtures of those versions in `src/lib/server/testing/`.

## Workarounds

- **Requests rejected before their body is read:** `src/hooks.server.ts` closes them one second after answering. Otherwise Node never finishes them and adapter-node never exits when idle (`IDLE_TIMEOUT`). This can go once SvelteKit/adapter-node handle it. Consider reporting it upstream.

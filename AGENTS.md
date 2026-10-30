# Agent Instructions

## Code Style

- **Comments: bare minimum.** Default to none. Only comment non-obvious logic — a subtle
  invariant, a non-local consequence, a "why" the code truly cannot express. One test before
  keeping any comment: **if the reader can see it in the code, delete it.** A rationale that
  will rot is worse than no comment.
  - Banned even when phrased as a "why": mechanism-narration the code already shows
    (a "later rows win" note next to an ordered loop), restating a name, a format or an
    obvious default (a "unix ms" or "YYYY-MM-DD" column note — rename to `expires_at_ms`
    instead), `// ---- Section ----` banners, history or provenance (a "was plant_attrs"
    note), and doc-paragraphs on self-evident functions, props, fields or columns.
  - Prefer a rename over a comment. Real rationale belongs in `docs/adr/`, not inline.
  - This holds everywhere — TypeScript, Svelte markup comments, SQL in schemas and
    migrations, tests, Nix, Rust, docs, snippets.
- **Write prose in sentences, not semicolon splices.** In comments and docs, two independent
  clauses are two sentences, never `clause; clause`. Write the two sentences a person would
  write. That splice reads as machine-written, and it is the single most reliable tell.
  - Before calling any work done, grep your own diff for `;` in comments, docs, SQL comments
    and commit messages, and rewrite every hit that joins two independent clauses. One search
    covers the whole class, and nothing else catches it.
  - This is about prose. Semicolons in code, and in genuine lists whose items carry their own
    commas, are fine.
- **Imports at the top of the file.** No inline `import('…').Type` annotations or dynamic
  `import()` at call sites unless there's a special reason (e.g. code splitting a heavy
  client-only module). Routes import library code through `#lib/…`.
- **Model types so they can express only valid state.** If a combination of fields, variants or
  arguments cannot occur, the type should make it unrepresentable rather than a comment make it
  discouraged. One test, run on **every** type a change introduces or touches, before the type
  is written down: **name a combination of its fields or variants that is meaningless — if you
  can name one, the type is wrong.** Two booleans that cannot both be true are one union. A
  field that is a function of its neighbours is a function or a `$derived`.
  - Tells that the pass has not been run: an invariant written out in prose ("only set when…",
    "must match"); optional members that are meaningful in one context only (split the type
    or use a discriminated union); an `undefined | null | value` tri-state; the same value
    stored twice, once raw and once derived; a sentinel standing in for absence (`''`, `0`,
    `-1`) instead of `null` or a union; a parser or action whose first job is rejecting input
    the type let in.
  - This holds for the database too. A table is a type: encode its rules with `NOT NULL`,
    `CHECK`, `UNIQUE` (partial indexes where needed) and foreign keys. IDs inside JSON are
    references without a foreign key — use a table.
  - A departure needs a very good reason, and the reason is recorded where the type lives: an
    ADR for a schema decision, a doc comment for an internal type. An unrecorded departure is a
    bug.
- **No line may be correct only because of another line.** Such a line keeps an agreement by
  hand, and it breaks when either side moves. Merge the two, or let a type, a constraint or an
  API carry the rule. One test, run on every line a change writes: **if this line is right only
  because some other line is, merge them or encode the rule.**
  - Tells: a check followed by a `!` non-null assertion or an index that relies on it, where
    `find`, `at` or a narrowing return does both; an `as Row` cast trusting that a query
    selects those columns; a `SELECT` whose answer an `INSERT` relies on, where `ON CONFLICT`,
    `RETURNING` or a constraint does both; a value copied into a second column or setting and
    patched on every change; a rename that has to visit every place a name is stored; magic
    strings kept apart by convention instead of a union type; a placeholder written now and
    patched later.

## Code Structure

- **Keep decisions apart from mechanics where the decisions are worth testing.** Code that makes
  real decisions (what a property's value was before a change, which rows a merge keeps, whether
  an edit is a correction or a new value) and also performs effects (files, vips/exifr
  subprocesses, the clock, `getRequestEvent`, redirects) is split into three levels:
  1. **Wiring** — load functions, form actions and `+server.ts` handlers — gathers the request,
     the diary's `db()` and configuration, calls the playbook, and turns its result into a
     response. It decides nothing.
  2. **The playbook** holds the decisions and reads top to bottom as named steps. It performs no
     effect itself. It either returns what should happen, or receives each effect from outside.
     Use a closure for one or two seams and an object of functions for a group of related
     effects.
  3. **Mechanics** carry out one effect each and decide nothing beyond their own errors.
  - One test: **can the decisions be tested without the file system, vips, a clock or a request
    context?** If they are worth testing and cannot be, split. An in-memory SQLite database
    (`openDb(':memory:')`) counts as a fake, so decisions that belong in SQL may stay there.
  - Decisions both the server and a component need live once, as pure functions in
    `src/lib/domain/`, never reimplemented in a `.svelte` file. A component's own decisions
    that are worth a test move into a `.ts` module next to it.
  - Tells: a function that decides, then writes a file or reads the clock, then decides again;
    the same rule implemented in SQL on the server and again in a component; a branch that can
    only be tested by running the app.
  - Not for glue, Svelte markup, single-statement store functions, or logic without branches
    worth a test. A seam needs a second implementation, and a test that uses it counts as one.

## Documentation

- [README.md](README.md) is the user and operator documentation: features, environment
  variables, the NixOS module, the data directory, users and sharing, backup and restore.
  Keep it current when any of these change.
- Rationale for architectural and schema decisions goes in `docs/adr/NNNN-title.md`. Create
  the directory with the first ADR.
- [TODO.md](TODO.md) lists deferred work. Remove an entry when it is done.

## Build Setup

The repo is a Nix flake with direnv (`.envrc`: `use flake`). Run tools through the dev shell:
`direnv exec . <command>`. The dev shell runs without login (`AUTH_BACKEND=none`) and keeps
data in `./data`.

Before calling work done:

- `direnv exec . npm run check` — svelte-check and the service worker's tsc
- `direnv exec . npm run lint` — Prettier and ESLint (`npm run format` fixes formatting)
- `direnv exec . npm test` — Vitest
- For changes to `nix/`, `pam-helper/`, auth or backup: `nix build .#checks.x86_64-linux.vm`
  (NixOS VM test with PAM login, backup and restore)

## Key Conventions

- SvelteKit 3 with Svelte 5 runes, TypeScript 6, Vite 8, adapter-node. Use the latest major
  versions and read their current docs rather than relying on older APIs.
- No native Node modules. SQLite is Node's built-in `node:sqlite`. Native helpers are written
  in Rust (`pam-helper/`), never C.
- Low RAM on the home server: the service is socket-activated and exits when idle
  (`IDLE_TIMEOUT`). Nothing may keep the process alive between requests (no intervals, no
  background workers, no unfinished requests).
- One SQLite database per diary (`db/diaries/<id>.sqlite`) plus `db/registry.sqlite` for
  diaries, members, invites and sessions. Diary data is reached only through `db()` in
  `src/lib/server/diary.ts`, which checks membership.
- Schemas live in `DIARY_SCHEMA` (`src/lib/server/diarySchema.ts`) and `REGISTRY_SCHEMA`
  (`src/lib/server/registry.ts`). A schema change updates `create` to the full current schema,
  adds `migrations[version]` and bumps `version`. A migration is SQL, or a function for data
  SQL alone can't fix. Add a test in `db.spec.ts` that migrates an old database, then freeze
  the new version with `WRITE_FIXTURE=1 npm test`. `golden.spec.ts` migrates every frozen
  version and compares it with a new diary.
- Migrations run in `event-diary-migrate` (`src/lib/server/migrate.ts`, bundled by
  `vite.migrate.config.ts`), which the NixOS module runs at boot and on every deploy. The
  app's `init` hook runs the same `migrateAll` before its first request. `openDb` only
  creates new databases and refuses any other version.
- Every change to a diary is a POST under `/[diary]/`. `hooks.server.ts` rejects those for
  viewers. Never add a mutating GET or a mutating route outside `/[diary]/`.
- Attachments are written once to `photos/` and never modified. Only types that `servesInline`
  allows are shown in the browser. Everything else is a download.
- The UI is German and mobile first. Every UI string lives in `src/lib/i18n.ts`. Code,
  comments, docs and commit messages are English.
- Internal IDs never appear in the UI: not on cards, pages, forms, pickers or messages. They
  stay in URLs and the database.
- Formatting is Prettier's: tabs, single quotes, no trailing commas, width 100.

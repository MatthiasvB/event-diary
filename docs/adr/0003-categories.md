# 3. Categories are rows, and an unused one disappears

## Context

Up to schema version 10, a category was a string on each event type, and `''` meant "no
category". Renaming a category rewrote every type in it. The photo type was remembered as
an ID in the `settings` table, and the overview columns as JSON with type IDs. Merging two
types had to patch both by hand, because no foreign key covered them.

## Decision

- `categories` holds one row per name. `event_types.category_id` is NULL for a type
  without a category. A unique index on `(name, ifnull(category_id, 0))` keeps names
  unique within a category, including "none".
- A category exists only while a type uses it. Two triggers on `event_types` delete a
  category once its last type is deleted or moved away. Everything that lists categories
  can therefore read the table directly.
- `event_types.photo_default` marks the photo type. A partial unique index allows at most
  one.
- `overview_columns` and `overview_column_types` hold the overview columns. Deleting a
  type removes it from its columns by `ON DELETE CASCADE`.
- With nothing left in it, the `settings` table is dropped.

## Consequences

- Renaming a category is one `UPDATE`. Merging moves its types, and the trigger removes
  the emptied category.
- The read models use `null` for "no category". Form inputs keep an empty string, and the
  parsers turn it into `null`.

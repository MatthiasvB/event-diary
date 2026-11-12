# 8. A stock's units can be unassigned, and need no association

## Context

ADR 7 spread a stock's units along one association chosen on the object form ("Verteilt
über"), and every unit had to be at some object. Creating a stock didn't take its count.
The count came from a separate "move" of new units to a place. In use, the association
choice was confusing, and "I have 16" couldn't be said without inventing a place.

## Decision

`objects.stock` is a plain flag (0 or 1). `stock_field_id` and its generated columns are
gone. `UNIQUE (id, stock)` stays, so the foreign keys of ADR 7 that keep stock and items
apart are unchanged.

`unit_moves.kind` says what a row does, and a NULL place means units not assigned to any
object:

- `add`: new units, so `from_id` is NULL. `to_id` is an object or unassigned.
- `remove`: units used up, so `to_id` is NULL. `from_id` is an object or unassigned.
- `move`: from one place to another, `from_id IS NOT to_id`.

One `CHECK` on `kind` encodes this. Before, a NULL end meant "new" or "used up", which left
no way to say "unassigned". The migration gives existing rows the kind their NULLs meant.

A new stock's count is an undated `add` to unassigned, entered on the create form. Unassigned
units can't go below zero either. The check of ADR 7 treats them as one more place.

Nesting no longer follows one association. The stock page shows each holder with its paths
along every association. A holder counts the units in objects whose path along any
association passes through it, each holder once (`unitsInside` in
`src/lib/domain/unitLedger.ts`).

## Consequences

- Converting a field's kind no longer depends on stocks, except that a stock's text value
  can't become an association.
- A holder inside two others along different associations counts toward both.

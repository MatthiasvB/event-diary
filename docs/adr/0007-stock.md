# 7. Stock is counted as a ledger of unit moves

## Context

Some things are only counted, not told apart: 16 rechargeable batteries, 3 in the remote, 4
in the charger, 9 in the cupboard. Tracking each battery as an object of its own would be
tedious and meaningless. An association (ADR 6) gives each object one value, so it can't
say "3 here and 4 there".

## Decision

An object with `objects.stock_field_id` set is a stock. Its units are spread along that
association. The column is a foreign key to `fields` together with the generated
constants `stock_field_role` and `stock_field_type`, so it can only name an association.
Keeping the association per stock, not per move, means a move never asks for one, and the
counts roll up along a single, known chain.

`unit_moves` records each move: a quantity, from an object or from nowhere (new units),
to an object or to nowhere (used up). A `CHECK (from_id IS NOT to_id)` refuses a move with
neither side and a move within one object. A move has a date of its own, the date of its
event, or neither, which counts from the start like an initial property value. Moves with
an event go when the event does. Counts are never stored. They are derived from the moves
by the pure functions in `src/lib/domain/unitLedger.ts`.

The generated column `objects.stock` (0 or 1) has a unique key with `id`, so other tables
can require one or the other by a foreign key on a constant:

- `unit_moves (object_id, stock = 1)`: only a stock has moves.
- `unit_moves (from_id | to_id, holder_stock = 0)`: units are held by items, not by a stock.
- `property_values (object_id | target_id, associated_stock)`: `associated_stock` is 0 for
  an association and NULL for text, so a stock neither has associations nor is the value
  of one, while text properties stay allowed.

The same keys refuse changing `stock_field_id` while moves or associations would break.

No holder may hold fewer than none at the end of any day. This is checked by the app, not
by a trigger: saving an event deletes and rewrites its moves, and row triggers would see
the counts in between. `savedUnlessRefused` (`src/lib/server/refusals.ts`) runs the check
inside every save's transaction and rolls the save back with a message. Every write that
can change counts goes through it: moves, events, and deleting events, objects, types and
categories.

## Consequences

- Within a day the order of moves doesn't matter. A backdated move is checked against
  everything after it.
- Deleting an event whose units were used later is refused until the later moves change.
- An object's timeline includes the events that moved its units, even when it isn't one of
  the event's objects.
- The check reads all moves of the diary on every save. Diaries are small, so this costs
  nothing noticeable.
- Converting a field's kind is refused while a stock is spread along it, or while a stock
  has a text value that would become an association.

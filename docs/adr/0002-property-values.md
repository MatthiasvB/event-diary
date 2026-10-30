# 2. A property value's date comes from where it was set

## Context

Up to schema version 9, `object_attrs` stored three kinds of rows in one shape: the initial
value (no date, no event), a correction made on the object (a date, no event) and a change
made by an event (the event's date copied into `since`, and the event). The copy had to be
rewritten whenever the event's date changed. A row with an event but no date could be
stored, and so could a change whose object differed from its event's. The value a change
replaced was computed three times: in SQL for the event list, in SQL before setting an
initial value, and in `FieldsEditor.svelte`.

## Decision

`property_values` has `CHECK (event_id IS NULL OR since IS NULL)`. A change made by an event
takes its date from the event (`coalesce(events.date, since)`), so moving the event moves
the change. A deferred foreign key `(event_id, object_id) → events (id, object_id)` with
`ON UPDATE CASCADE` keeps a change with its event's object, and moving the event to
another object takes its changes along.

`replaced()` in `src/lib/domain/propertyHistory.ts` is the only place that decides what a
change replaces and whether it is a property's first change. The server and the field
editor both call it.

## Consequences

- Every read of a value's date joins `events`.
- The read model `PropertyValue` can express only the valid shapes: initial without event,
  or dated with or without event.

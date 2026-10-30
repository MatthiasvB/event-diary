# 4. An event can belong to several objects

## Context

Up to schema version 11, recording an event for several objects created one copy per
object, sharing a `batch_id`. Details, notes and files were stored once per copy, an edit
"for all" had to update every copy by hand, and the batch size was a subquery on every
read. A copy edited on its own kept its `batch_id`, so a batch could hold copies that no
longer matched.

## Decision

`events` has no object. `event_objects (event_id, object_id)` links an event to each of
its objects. A property change refers to `event_objects (event_id, object_id)`, so it
always belongs to one of its event's objects, and taking an object out of an event takes
its changes along.

Editing one object's part of a shared event takes the object out of the event and records
the edit as an event of its own. Editing "for all" changes the one event. Deleting from an
object's timeline only takes that object out, and deleting an object deletes only the
events no other object has.

A trigger deletes an event once its last object is removed, so an event always has an
object.

Migration 12 merges the copies of a batch that are still alike (type, date, note, details,
changes and files). A copy that was edited on its own becomes an event of its own.

## Consequences

- A batch counts as one event in type counts, suggestions and delete impacts.
- An event's changes differ per object in the value they replaced. A card without an
  object context shows each changed name once, without that value.

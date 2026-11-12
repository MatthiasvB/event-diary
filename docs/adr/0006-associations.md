# 6. An association's value is an object, held by a foreign key

## Context

Diaries started to track where things are: batteries in a remote, a remote in the car,
orchids on a shelf. Text properties like _Standort_ could name a place, but not link to it.
A rename of the place didn't reach the values, nothing listed what is in a place, and
nothing stopped a box from being inside itself.

## Decision

A field may have the kind `object`. Its values are objects of the same diary, so it is an
association between them. Only properties can have this kind (`CHECK (kind != 'object' OR
role = 'property')`). A new name chosen as `object` becomes a property even when the form
sent it as a detail.

`property_values` keeps an association's value in `target_id`, a foreign key to `objects`,
and every other value in `value`. Exactly one of them is set. Which one must match the
field's kind. Both tables have a stored generated column `value_type`, `'object'` or
`'text'`, derived from `fields.kind` and from whether `target_id` is set. The foreign key
`(field_id, role, value_type)` to `fields` makes a text value under an association, or an
object under a text field, a violation, the way `role` does for details and properties
(ADR 1). Changing a field's kind therefore has to convert its values in the same
transaction: text values become the object of that name, or a new unlisted object when
there is none or more than one. Back to text, they become the objects' names.

Above the database, values stay strings. An association's value is the object's id as
text. The form sends either that id or `+` and the name of an object to create
(`src/lib/domain/associations.ts`), and the save resolves it inside its transaction.

Triggers on `property_values` refuse a change after which following the association from
the changed object leads back to it. Only current values count: the last of each object in
the order of their dates. A `CHECK` refuses an object pointing to itself. Both are mapped to
one message in `src/lib/server/refusals.ts`.

The foreign key on `target_id` has no `ON DELETE` action. An object that others point to,
now or in their history, can't be deleted. The page says so and suggests setting it
inactive.

`objects.listed` says whether the object is on the start page. Objects that only hold other
things, like a cupboard or the car, can stay off it. Objects created by typing a new name
start unlisted.

Event type defaults can't be associations. `event_type_fields.default_value` is text without
a foreign key, so an id there could point to an object that no longer exists.

## Consequences

- Renaming an object renames it everywhere it is a value, for free.
- Paths (_Fernbedienung › Auto_) and "what is in here" are computed from current values in
  `src/lib/domain/associations.ts`, without SQL.
- The cycle check runs a recursive query on every change of an association. Diaries are
  small, so this costs nothing noticeable.
- Converting between text and objects can create objects. Converting back keeps them.

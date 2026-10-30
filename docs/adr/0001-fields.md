# 1. Fields are a table, and their role is a constraint

## Context

Every value in a diary belongs to a named field. A field is either an event detail, which
belongs to one event, or an object property, which keeps a history per object. Up to
schema version 8 there was no field entity. A name was a property if it occurred in
`object_attrs`, its kind lived in `field_kinds`, its place in a `propertyOrder` setting,
and event types kept a JSON copy of each name with its target. Renaming a name had to
visit all of these by hand. After every write, `promoteToProperties` swept event details
whose name had become a property into `object_attrs` and rewrote every type's JSON.

## Decision

`fields` holds one row per name with its role, kind, unit and place. Event details,
property values and event type templates refer to it by ID. A rename is one `UPDATE`,
and a merge repoints the references and deletes the source.

The role is enforced by the schema. `fields` has `UNIQUE (id, role)`. `event_details` and
`object_attrs` each carry a constant `role` column (`CHECK (role = 'detail')` and
`CHECK (role = 'property')`) and refer to `fields (id, role)`. A detail value for a
property, or the reverse, violates a foreign key. The foreign keys are deferred, so turning
a detail into a property (`useField` in `src/lib/server/fields.ts`) can move the values and
change the role in one transaction, in any order.

A field keeps its role once it is a property, even when no object has a value for it any
more. Before, a name without values silently became a detail again.

## Consequences

- No sweep after writes. A detail becomes a property in one explicit step, when an event,
  an object or an event type asks for it.
- The constant `role` columns cost a few bytes per row. They are the price of having the
  rule in the schema instead of in code that has to run after every write.
- A template's target is derived from the field's role. It can't disagree with it.

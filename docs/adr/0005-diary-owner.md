# 5. A diary's owner is a column

## Context

Up to registry version 3, the owner was a row in `members` with `role = 'owner'`, and
`role` was free text. "Exactly one owner" held only by convention: every query that changed
members carried `role != 'owner'`, and `createDiary` had to insert the owner row next to
the diary.

## Decision

`diaries.owner` holds the owner. `members` and `invites` hold only shared roles, with
`CHECK (role IN ('editor', 'viewer'))`. A trigger ignores inserting the owner as a member,
so accepting an invite to one's own diary changes nothing, like it does for an existing
member. `Role` in code is `'owner' | SharedRole`, and the owner is read from the column.

Migration 4 takes the owner row of each diary. A diary that had several becomes owned by
the first by name, and the others become editors.

## Consequences

- There is always exactly one owner, and no query has to guard against changing it.
- Ownership could be transferred with one `UPDATE`, if that is ever wanted.

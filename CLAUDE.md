# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server on localhost:5173
npm run build        # production build → build/
npm run preview      # preview production build
npm run check        # svelte-check + tsc type checking

# Database
DATABASE_URL='postgres:///kanban?host=/var/run/postgresql' npx drizzle-kit generate   # generate migration from schema changes
DATABASE_URL='postgres:///kanban?host=/var/run/postgresql' npx drizzle-kit migrate    # apply pending migrations
psql -d kanban -f drizzle/triggers.sql   # (re-)apply triggers after schema changes
```

## Architecture

SvelteKit serves both the frontend and all API routes — no separate backend process. The database is PostgreSQL accessed via Drizzle ORM + `pg`.

### Database connection
Unix socket peer auth only — **do not use TCP (`localhost`)**, it triggers SCRAM auth which fails.
```
DATABASE_URL=postgres:///kanban?host=/var/run/postgresql
```

### Type flow
All DB types originate in `drizzle/schema.ts` → re-exported via `src/lib/types.ts`. Never define types that duplicate schema columns elsewhere.

### Board state (`src/lib/board.svelte.ts`)
Module-level Svelte 5 `$state` — a single shared reactive store for all board components. Access via the exported `board` object:
- `board.todo / .doing / .done` — `$derived` task lists sorted by position
- `board.moveTask(id, status, position)` — applies an optimistic update to `state.tasks`, sends `PATCH /api/tasks/:id/move`, and rolls back the full `state.tasks` array on failure
- `board.setTasks()` is called once on mount in `KanbanBoard.svelte`; subsequent mutations (add/edit/delete/move) update the store directly

### Drag and drop (`src/lib/sortable.ts`)
SortableJS wraps as a Svelte action. **Critical pattern**: `onEnd` must immediately revert SortableJS's DOM mutation before calling `board.moveTask()`, otherwise Svelte's keyed `{#each}` reconciliation creates duplicate cards:
```ts
function onEnd(evt) {
    evt.from.insertBefore(evt.item, evt.from.children[evt.oldIndex ?? 0] ?? null); // revert DOM
    board.moveTask(id, toStatus, newIndex); // let Svelte re-render
}
```

### Move transaction (`src/routes/api/tasks/[id]/move/+server.ts` → `src/lib/server/queries/tasks.ts:moveTask`)
Uses a raw `pg` client (not Drizzle) for an atomic transaction: `SELECT FOR UPDATE` the row, shift positions in source/destination columns, then update the task's `status` and `position`. Drizzle is bypassed here intentionally for transactional atomicity.

### PostgreSQL triggers (`drizzle/triggers.sql`)
Applied manually — not part of Drizzle migrations. Must be re-applied after any `psql` reset:
- `set_updated_at` — `BEFORE UPDATE` on tasks and projects
- `check_project_completion` — `AFTER INSERT|UPDATE|DELETE` on tasks; auto-sets project `status` to `done` when all its tasks are done, reverts to `active` otherwise

### Path alias
`$components` → `src/components` (configured in `svelte.config.js`)

### Users in layout
`src/routes/+layout.ts` fetches `/api/users` — result is available as `data.users` on every page without extra fetching.

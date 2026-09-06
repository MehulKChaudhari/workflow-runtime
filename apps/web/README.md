# @workflow/web

React + Vite UI for Workflow Runtime. Visualizes workflow runs as a live DAG
using React Flow. Currently backed by in-memory mocks; swap `client.ts` for
real HTTP when `apps/api` is ready.

## Run locally

From the monorepo root:

```bash
pnpm install
pnpm --filter @workflow/web dev
```

Open http://localhost:5173

## Build

```bash
pnpm --filter @workflow/web build
```

## Project layout

```
src/
  lib/
    types.ts      # Domain types (mirror runtime packages)
    mocks.ts      # In-memory data + live-run simulation
    client.ts     # API surface — replace internals with fetch()
    layout.ts     # DAG auto-layout
  components/     # Shared UI + React Flow nodes
  pages/          # Landing, runs list, run detail, new workflow
```

Example workflow JSON lives in `examples/` at the repo root and is imported
via the `@examples` Vite alias.

## Mock behavior

- `listRuns` / `getRun` / `submitWorkflow` / `startRun` simulate 100–300ms latency.
- `run-live-digest` (yc-digest) advances node statuses every ~1.5s; the run
  detail page polls `getRun` on the same interval.
- `run-cake-done` and `run-cake-failed` are static completed runs using
  `birthday-cake.json`.

All mock logic stays in `mocks.ts`. `client.ts` is the only file the UI
imports for data.

## Swapping in the real API

Replace the function bodies in `client.ts` with `fetch` calls to the Hono API.
Keep the same exported signatures and return types. Delete or gate `mocks.ts`
once the backend exists.

## Theming

Colors are CSS custom properties in `src/index.css`. Toggle dark mode later
by setting `data-theme="dark"` on `<html>` — components already reference
variables, not hard-coded colors.

# Workflow Runtime

A lightweight AI workflow runtime, inspired by *"Structured Graph Harness (SGH):
A Scheduler-Centric Architecture for Reliable LLM Agents"*.

The core idea: **use the LLM to plan, once, up front — then execute that plan
with boring, deterministic infrastructure.** The LLM produces a graph of steps.
A scheduler decides what runs when. Workers execute steps. A state machine
tracks each step's lifecycle. Failure handling belongs to the runtime, not the
model.

This is not a chatbot, an AI wrapper, or an agent framework. It is the
execution layer that powers AI workflows.

## Architecture

```
        shared  (types, schemas — depends on nothing)
          ▲
   ┌──────┼───────────┬──────────┐
 graph  provider   workers   scheduler
   ▲       ▲           ▲         ▲
   │       │           │         │
   └── planner         └── runtime
                             ▲
                        apps/api ──► apps/web (via HTTP, not imports)
```

| Package | Analogy | Responsibility |
| --- | --- | --- |
| `packages/shared` | common types lib | Zod schemas and types everything agrees on |
| `packages/graph` | AST / IR | The plan as a data structure: nodes, edges, DAG validation |
| `packages/scheduler` | OS scheduler | Decides which ready node runs when |
| `packages/runtime` | event loop | Drives state machines, persists state, handles failure |
| `packages/workers` | microservices | Execute a single node's work |
| `packages/provider` | database driver | One interface over "which LLM" |
| `packages/planner` | compiler | Turns intent (a prompt) into a validated graph |
| `apps/api` | — | Hono HTTP API: submit workflows, inspect runs |
| `apps/web` | — | React Flow visualization of live runs |

## Stack

TypeScript, Hono, PostgreSQL, Drizzle, Zod, Pino · React, Vite, Tailwind,
React Flow · pnpm workspaces.

## Demo: crash and continue

Postgres must be up (`docker compose up -d`). Then:

```bash
pnpm demo                # birthday-cake, slow workers
pnpm demo -- yc-digest   # same engine, larger graph
```

While a node says `working`, kill the process (`Ctrl-C` or `kill -9`). Restart with:

```bash
pnpm demo -- --recover
```

Finished nodes stay finished. The node that was `running` retries (at-least-once). The run completes.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Status

Early. Built incrementally, phase by phase — see `LEARNING.md` for the log of
concepts behind each phase.

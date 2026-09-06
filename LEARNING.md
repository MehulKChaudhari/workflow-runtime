# Learning Log

One entry per phase: the concept, why it exists, and what we built.

## Lesson 0 — Why a workflow runtime exists

The naive agent is a loop: ask the LLM "what next?", do it, repeat. It fails in
production because control flow is non-deterministic, state lives in process
memory (no crash recovery), there is no structured trace, and every decision
costs an LLM call.

The fix is a separation of concerns: **the LLM plans once, up front; a
deterministic runtime executes the plan.**

Three sentences to retain:

1. **The scheduler decides, the graph encodes.** Steps are dumb; control flow
   is centralized. (Policy = graph, mechanism = scheduler.)
2. **Durability means `kill -9` is survivable.** Persist state before acting;
   recovery is just "reload state and reschedule" — the same code path as
   normal operation.
3. **Acyclic means guaranteed progress.** A cycle gives the scheduler either a
   deadlock (no node is ever ready) or an infinite loop. Every DAG has a
   topological order, so termination is guaranteed and bad plans can be
   rejected at submission time.

Production parallels: Temporal, AWS Step Functions, Airflow, GitHub Actions,
Kubernetes controllers.

## Phase 0 — Monorepo as enforced architecture

Package boundaries are the SGH separation of concerns made compiler-enforced:
a package can only import what its `package.json` declares, so the scheduler
*cannot* reach the LLM provider. Our own package dependency structure is
itself a DAG.

Rules we hold ourselves to:

- `shared` is the bottom: types and schemas only, no logic, no I/O.
- The scheduler never knows LLMs exist. Test of the abstraction: rip out the
  AI packages and the runtime should still be a good generic job orchestrator.

Implementation notes: pnpm workspaces; the "internal packages" pattern (each
package exports its TypeScript source directly — no build step, since nothing
is published to npm); one root tsconfig for typechecking.

## Phase 1 — The workflow graph (`shared` + `graph`)

**Plan as data beats plan as code**: a graph you can inspect can be validated
before running, stored in Postgres, emitted by an LLM, drawn on screen, and
resumed from the middle. This is our IR — the contract between the planner
(compiler front-end) and the scheduler/runtime (back-end).

Design decisions and why:

- **Definition ≠ run.** The definition is the immutable recipe card; status,
  outputs and timestamps belong to a *run* (one cooking session). GitHub
  Actions YAML vs. run #4123. Runs get their own state machine in Phase 2.
- **Edges are first-class objects** (`{from, to}` list), not `dependsOn`
  arrays: anything that might ever carry properties (e.g. a `condition` for
  failure branches) should be an object. Also maps directly to a DB table and
  to React Flow's input format. Arrows stored exactly once in the wire format;
  algorithms build an adjacency list in memory from it.
- **Node = `id` + `type` + `config`.** The scheduler reads ids/edges and never
  looks inside `config`; only the matching worker interprets it. Same pattern
  as Kubernetes `kind:`/`spec:`.
- **Parse, don't validate**: `parseWorkflowDefinition(unknown)` returns a
  typed `WorkflowDefinition` or a list of *all* issues (not just the first) —
  those messages become feedback to the planner LLM in Phase 6.
- **Validation layers, cheapest first**: shape (Zod) → referential integrity
  (unique ids, edges point at real nodes, no self/duplicate edges) →
  semantics (acyclicity).
- **Kahn's algorithm is the scheduler, fast-forwarded**: repeatedly emit
  nodes with in-degree 0, decrementing dependents. Leftover nodes are
  deadlocked in (or downstream of) a cycle. Every DAG has ≥1 entry node
  (in-degree 0 — Kahn's seeds) and ≥1 terminal node. Disconnected nodes are
  legal: in-degree 0 just means "immediately ready".
- **`config` values must be `JsonValue`** — only things that survive a
  round-trip through Postgres and an LLM. No Dates, no undefined.

Verdicts: reject bad shape, duplicate ids, unknown refs, self-edges,
duplicate edges, empty graphs, cycles; allow disconnected nodes and any
number of entry/terminal nodes.

## Phase 2 — State machines (node + run lifecycles)

**If a thing has a lifecycle, it's a state machine** — the only question is
whether you wrote it down or left it implicit in scattered booleans. N
booleans = 2^N representable combinations, mostly meaningless; one enum +
a transition table makes illegal states unrepresentable and illegal moves
loudly rejected.

Node lifecycle: `pending → ready → running → succeeded | failed`, plus
`pending → skipped` (upstream failed permanently — Airflow's
`upstream_failed`; named *skipped* not *blocked* because it is terminal).

Design decisions and why:

- **Transition function is a pure reducer**: `(state, event, policy) →
  result`, no I/O, no clock. The runtime later plays "Redux store": holds
  state, applies events, persists. Pure decisions now, effects in Phase 4.
- **Retries are a counter, not a status loop.** `failed` always means
  failed-for-good, so downstream logic can trust it. A failed attempt with
  budget left goes `running → ready` (dependencies are still met) with
  `attempts` incremented on each dispatch — like Kubernetes container
  restarts: the counter ticks, the pod doesn't teleport through Failed.
- **Stored `ready` is a materialized view** of a derivable fact
  (pending + all parents succeeded). We store it for cheap scheduler reads
  (`WHERE status = 'ready'`) and an auditable "became ready" event; the
  staleness risk is contained by a single writer going through one doorway.
  When you store a derived fact, you own its invalidation.
- **Run status is derived, not a second machine**: a pure fold over node
  statuses (all pending → pending; all terminal → failed if any
  failed/skipped else succeeded; otherwise running). One less machine to
  keep consistent.
- **Failure policy**: on permanent node failure, descendants get skipped,
  independent branches run to completion (Airflow-style; GitHub Actions
  fail-fast is the alternative — cheaper, needs cancellation machinery).

Production parallels: Kubernetes Pod phases, TCP states, Stripe
PaymentIntent (webhooks = transition notifications), CI job lifecycles.

## Phase 3 — The scheduler

**Kahn's algorithm unfrozen.** `topologicalSort` pretends every ready node
finishes instantly. `schedule()` takes one look: given the graph and current
statuses, which pending nodes should change, and to what? The runtime
applies those proposals through `transitionNode` and later dispatches
workers. The scheduler never cooks.

Two graph rules, parents only:

- **Ready** if every parent succeeded (or there are no parents).
- **Skipped** if any parent is `failed` or `skipped`. Skip is contagious
  so a grandchild of a failure does not sit `pending` forever.

Skip ripples one hop per look (`A` failed → skip `B`; next look skip `C`).
Crash recovery is the same function over reloaded statuses — it does **not**
re-run a failed branch. Terminal means terminal.

Design decisions and why:

- **Propose, do not apply.** Returning `{ becomeReady, becomeSkipped }`
  keeps the package DAG acyclic (`runtime → scheduler → graph/shared`)
  and leaves `transitionNode` as the only doorway into node state.
- **Scan the whole graph each look.** Our graphs are small; an incremental
  wake-the-children scheduler is a later optimization and easier to get
  wrong.
- **Dispatch is not this function.** "Which nodes are legal to run" is
  graph policy. "How many workers, who gets which ready node" is the
  runtime. Unbounded dispatch first; a concurrency cap (and maybe
  fair-share) when we have real workers. Round-robin is a *worker
  assignment* algorithm, not a graph algorithm.

Production parallels: kube-scheduler vs kubelet, Airflow scheduler vs
workers, OS run queue vs process code.

## Phase 4a — The execution engine (in memory) + workers

First phase where anything *executes*. `executeRun(workflow, workers)`
wires the existing brains to effects in a loop: scheduler-to-fixpoint →
apply transitions through `transitionNode` (still the only doorway) →
dispatch every ready node → `Promise.race` the in-flight workers → record
the outcome → look again. Exit when `computeRunStatus` says terminal.

Worker contract (the plugin seam):

- `(input: { config, inputs }) => Promise<JsonObject>`; `inputs` is
  parents' outputs keyed by parent id. **Edges are data pipes now**, not
  just wait-for arrows — same idea as Airflow XCom / GitHub Actions
  `needs.X.outputs`. This is why outputs were constrained to JsonValue.
- Throw = failure. A Result return type would sit *next to* the try/catch
  the runtime needs anyway (buggy workers throw regardless); one failure
  path is enough. The stored record stays explicit: every failed attempt
  leaves an error string.
- Unknown node type = plan defect, not runtime event: refuse to start the
  run (retrying cannot make a worker exist). Cheapest failure is before
  any side effect.

Failure semantics decided:

- **At-least-once.** An interrupted `running` node will be re-dispatched
  on recovery; duplicate side effects are the accepted risk (mitigation:
  idempotent workers — Stripe idempotency keys are the model). At-most-
  once (never duplicate, lose work instead) is the alternative; per-node
  choice is the mature design (Temporal per-activity policies).
- A crash burns retry budget for free: `attempts` increments at DISPATCH,
  so an unknown-outcome attempt is already counted.
- Illegal transitions inside the engine throw ("engine bug") — corrupting
  state silently is worse than crashing the run.

Tested without a database or clock: concurrency proven by counting
overlapping workers, retries by a flaky worker succeeding on attempt 3,
skip propagation and independent-branch survival on the cake graph.

In-memory Maps mean kill -9 still loses everything — durability is
exactly one change away: persist states/outputs where the Maps are.

## Phase 4b — Durability (Postgres + Drizzle) and crash recovery

We built a write-ahead log for workflows on top of Postgres — the same
idea Postgres itself uses (WAL) and Temporal sells: **persist the state
change before performing the side effect it authorizes**. If we crash
after "bake attempt 1 running" is written but before the worker ran, the
record honestly says "attempt started, outcome unknown" — recovery
re-dispatches (at-least-once, as decided).

Schema (four tables): `workflows` (immutable definition as one JSONB blob
— always read whole, never queried into by the engine; Postgres stores
the graph, it never interprets it), `runs`, `node_runs` (composite PK
`(run_id, node_id)` — definition vs run in DDL; latest snapshot), and
`run_events` (append-only history: snapshot answers "what state", history
answers "why / when / after how many attempts").

Design decisions and why:

- **`RunStore` seam.** The engine writes through a small interface
  (`saveTransitions(batch)`, `saveRunStatus`); in-memory for tests,
  Drizzle/Postgres for real. Same trick as the worker registry: effects
  behind an interface keep the loop testable.
- **Transaction boundaries follow logical facts**: one scheduler tick's
  transitions = one atomic batch; each DISPATCHED is its own write
  immediately before its worker call (persist-before-act at the finest
  grain). Per-node ticks would even self-heal (the scheduler recomputes
  from any consistent state), but tick-atomicity is easier to reason
  about and free at our scale.
- **Memory stays the working copy** in a single-writer process; Postgres
  is the source of truth for recovery, not a per-tick read. The moment a
  second runtime process exists this flips (row locking — the Airflow
  `SELECT FOR UPDATE` world).
- **Recovery is almost no code**, by earlier design: reload states, apply
  ATTEMPT_FAILED("interrupted") to every `running` node — the reducer
  requeues or terminally fails by remaining budget (a crash burns budget
  because attempts increment at dispatch) — then enter the normal loop.
  The scheduler cannot tell recovery from a slow Tuesday; stateless
  recompute-everything scheduling bought crash recovery for free.
- Loaded definitions are re-parsed (`parse, don't trust`): they crossed a
  boundary since validation.

Proved by integration tests against real Postgres: full run persisted
with event history; simulated crash (legal persisted prefix with a node
stuck `running`) recovers, keeps pre-crash outputs, re-runs only the
interrupted node; recovery with exhausted budget fails the run and skips
descendants.

## Demo script

`pnpm demo` is the same engine with slow echo workers and a printed
transition log. `--recover` calls `recoverRun` on the last run id. The
script adds no new semantics — it only makes persist-before-act visible
in a terminal so a `kill -9` can be shown, not just tested.

## Phase 5 — Provider + llm-call worker

An LLM is next-token autocomplete. We never let it drive the graph. We
only ask it for text, behind one interface, the same way `pg` hides
which database vendor you use.

`Provider.complete({ messages, model? })` returns `{ text, model,
inputTokens, outputTokens }`. Per-call `model` wins over the provider
default (`gemini-2.5-flash`). Keys come from `GEMINI_API_KEY`, never
from node config (that JSON is stored and shown).

Retries: provider retries 429 / 5xx / timeout a few times with backoff,
then throws. Runtime owns attempt budget. "Not JSON" is the caller's
problem — the provider does not know we wanted a graph.

`createFakeProvider` lives in the package so worker tests don't need a
key. First real adapter is Gemini over REST (`fetch`), no vendor SDK.

import {
  bigserial,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The definition is stored as one JSONB blob: it is immutable and always
 * read whole (the engine schedules over the in-memory graph, never via
 * SQL), so normalizing nodes/edges into tables would add joins without
 * adding a single query we need.
 */
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  definition: jsonb("definition").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflows.id),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Current state of one node within one run: definition vs run, in DDL. */
export const nodeRuns = pgTable(
  "node_runs",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    nodeId: text("node_id").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    output: jsonb("output"),
    error: text("error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.nodeId] })],
);

/**
 * Append-only history. node_runs answers "what state is bake in";
 * this table answers "why is bake failed, after how many attempts,
 * when, with which errors". simple logs
 */
export const runEvents = pgTable("run_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id),
  /** Null for run-level events (e.g. run status changes). */
  nodeId: text("node_id"),
  eventType: text("event_type").notNull(),
  toStatus: text("to_status"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

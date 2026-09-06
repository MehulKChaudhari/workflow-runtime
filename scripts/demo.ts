import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseWorkflowDefinition, type WorkflowDefinition } from "@workflow/graph";
import {
  createDb,
  createRun,
  ensureSchema,
  executeRun,
  loadRun,
  PgRunStore,
  recoverRun,
} from "@workflow/runtime";
import type { Worker, WorkerRegistry } from "@workflow/workers";

const DEFAULT_DATABASE_URL =
  "postgres://workflow:workflow@localhost:5433/workflow";
const LAST_RUN_PATH = resolve(process.cwd(), ".demo-last-run");
const DELAY_MS = Number(process.env["DEMO_DELAY_MS"] ?? 2500);

function parseArgs(argv: string[]): { recoverId?: string; example: string } {
  const recoverFlag = argv.indexOf("--recover");
  if (recoverFlag >= 0) {
    const next = argv[recoverFlag + 1];
    return {
      example: "birthday-cake",
      ...(next !== undefined && !next.startsWith("--")
        ? { recoverId: next }
        : {}),
    };
  }
  const positional = argv.find((arg) => !arg.startsWith("--"));
  return { example: positional ?? "birthday-cake" };
}

async function readExample(name: string): Promise<WorkflowDefinition> {
  const path = resolve(process.cwd(), "examples", `${name}.json`);
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const parsed = parseWorkflowDefinition(raw);
  if (!parsed.ok) {
    throw new Error(
      `example "${name}" is invalid:\n${parsed.issues
        .map((issue) => `  ${issue.code}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  return parsed.workflow;
}

/**
 * Same contract as echo, plus a sleep so a human can kill the process
 * while work is in flight. Real HTTP/LLM workers land later.
 */
function slowWorker(label: string): Worker {
  return async ({ config, inputs }) => {
    process.stdout.write(`  … ${label} working (${DELAY_MS}ms)\n`);
    await new Promise((resolveTimer) => setTimeout(resolveTimer, DELAY_MS));
    return { config, inputs };
  };
}

function registryFor(workflow: WorkflowDefinition): WorkerRegistry {
  const workers = new Map<string, Worker>();
  for (const node of workflow.nodes) {
    if (!workers.has(node.type)) {
      workers.set(node.type, slowWorker(node.type));
    }
  }
  return workers;
}

function printTransition(nodeId: string, status: string, attempts: number): void {
  const attempt = status === "running" ? `  attempt ${attempts}` : "";
  process.stdout.write(`  ${nodeId.padEnd(22)} → ${status}${attempt}\n`);
}

function printHint(runId: string): void {
  process.stdout.write(
    `\nrun ${runId}\n` +
      `kill this process mid-run (Ctrl-C or kill -9), then:\n` +
      `  pnpm demo -- --recover\n\n`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env["DATABASE_URL"] ?? DEFAULT_DATABASE_URL;
  const { db, close } = createDb(databaseUrl);

  try {
    await ensureSchema(db);

    if (args.recoverId !== undefined || process.argv.includes("--recover")) {
      const runId =
        args.recoverId ?? (await readFile(LAST_RUN_PATH, "utf8")).trim();
      if (runId === "") {
        throw new Error("no run id: pass --recover <id> or start a run first");
      }
      const { workflow } = await loadRun(db, runId);
      process.stdout.write(`recovering ${runId} (${workflow.name})\n\n`);
      const result = await recoverRun(db, runId, {
        workers: registryFor(workflow),
        retryPolicy: { maxAttempts: 2 },
        onTransition: (id, state) =>
          printTransition(id, state.status, state.attempts),
      });
      process.stdout.write(`\nrun ${result.status}\n`);
      return;
    }

    const workflow = await readExample(args.example);
    const { runId } = await createRun(db, workflow);
    await writeFile(LAST_RUN_PATH, runId, "utf8");
    printHint(runId);

    const result = await executeRun({
      workflow,
      workers: registryFor(workflow),
      retryPolicy: { maxAttempts: 2 },
      store: new PgRunStore(db, runId),
      onTransition: (id, state) =>
        printTransition(id, state.status, state.attempts),
    });
    process.stdout.write(`\nrun ${result.status}\n`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRun } from "../lib/client";
import type { RunView } from "../lib/types";
import { StatusPill } from "../components/StatusPill";
import { LoadingState } from "../components/LoadingState";
import { WorkflowDag } from "../components/dag/WorkflowDag";
import { NodeDetailPanel } from "../components/NodeDetailPanel";
import { formatDuration, isRunTerminal } from "../lib/format";

const POLL_MS = 1500;

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();

  const fetchRun = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getRun(id);
      setRun(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    }
  }, [id]);

  useEffect(() => {
    void fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    if (!run || isRunTerminal(run.status)) return;
    const timer = setInterval(() => void fetchRun(), POLL_MS);
    return () => clearInterval(timer);
  }, [run, fetchRun]);

  if (error) {
    return (
      <div>
        <Link to="/app" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to runs
        </Link>
        <p className="mt-4 rounded-xl bg-[var(--status-failed-bg)] p-4 text-sm text-[var(--status-failed-text)]">
          {error}
        </p>
      </div>
    );
  }

  if (!run) return <LoadingState label="Loading run" />;

  const selectedDef = run.definition.nodes.find((n) => n.id === selectedNodeId);
  const selectedRun = run.nodes.find((n) => n.nodeId === selectedNodeId);

  return (
    <div className="animate-fade-up">
      <Link to="/app" className="text-sm text-[var(--text-muted)] transition hover:text-[var(--accent)]">
        ← All runs
      </Link>

      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-subtle)]">
            Definition vs run
          </p>
          <h1 className="mt-1 truncate font-serif text-2xl text-[var(--text)] sm:text-3xl">
            {run.workflowName}
          </h1>
          <p className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">{run.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <StatusPill status={run.status} size="md" pulse={run.status === "running"} />
          <span className="rounded-lg bg-[var(--bg-muted)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            {formatDuration(run.startedAt)}
          </span>
        </div>
      </header>

      <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[1fr_320px]">
        <WorkflowDag
          definition={run.definition}
          nodeRuns={run.nodes}
          selectedNodeId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
        />
        {selectedDef && selectedRun ? (
          <NodeDetailPanel
            definition={selectedDef}
            run={selectedRun}
            onClose={() => setSelectedNodeId(undefined)}
          />
        ) : (
          <aside className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-6 text-center sm:p-8">
            <p className="text-sm text-[var(--text-muted)]">
              Tap a node to inspect config, output, and errors.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRuns } from "../lib/client";
import type { RunSummary } from "../lib/types";
import { StatusPill } from "../components/StatusPill";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { formatDateTime } from "../lib/format";

function RunCard({ run }: { run: RunSummary }) {
  return (
    <Link
      to={`/app/runs/${run.id}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--accent-ring)] hover:shadow-[var(--shadow-md)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--text)]">{run.workflowName}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-[var(--text-subtle)]">{run.id}</p>
        </div>
        <StatusPill status={run.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{formatDateTime(run.startedAt)}</span>
        <span className="font-mono">
          {run.succeededNodes}/{run.totalNodes} succeeded
        </span>
      </div>
    </Link>
  );
}

export function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRuns()
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load runs");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-xl bg-[var(--status-failed-bg)] p-4 text-sm text-[var(--status-failed-text)]">
        {error}
      </p>
    );
  }

  if (!runs) return <LoadingState label="Fetching runs" />;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl text-[var(--text)] sm:text-3xl">Runs</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Workflow executions with persisted node state.
          </p>
        </div>
        <Link
          to="/app/new"
          className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
        >
          New workflow
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="mt-8 sm:mt-10">
          <EmptyState
            title="No runs yet"
            description="Submit a workflow definition and start a run to see it here."
            action={
              <Link
                to="/app/new"
                className="inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Create workflow
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:hidden">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>

          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] sm:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                  <th className="px-5 py-3 font-medium text-[var(--text-muted)]">Workflow</th>
                  <th className="px-5 py-3 font-medium text-[var(--text-muted)]">Status</th>
                  <th className="px-5 py-3 font-medium text-[var(--text-muted)]">Started</th>
                  <th className="px-5 py-3 font-medium text-[var(--text-muted)]">Progress</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="group border-b border-[var(--border-subtle)] transition last:border-0 hover:bg-[var(--bg-muted)]/60"
                  >
                    <td className="px-5 py-4">
                      <Link
                        to={`/app/runs/${run.id}`}
                        className="font-medium text-[var(--text)] group-hover:text-[var(--accent)]"
                      >
                        {run.workflowName}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-[var(--text-subtle)]">{run.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={run.status} />
                    </td>
                    <td className="px-5 py-4 text-[var(--text-muted)]">
                      {formatDateTime(run.startedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-[var(--text)]">
                        {run.succeededNodes}/{run.totalNodes}
                      </span>
                      <span className="ml-1 text-[var(--text-muted)]">succeeded</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

import { StatusPill } from "./StatusPill";
import { prettyJson } from "../lib/format";
import type { NodeDefinition, NodeRunView } from "../lib/types";

interface NodeDetailPanelProps {
  definition: NodeDefinition;
  run: NodeRunView;
  onClose: () => void;
}

export function NodeDetailPanel({ definition, run, onClose }: NodeDetailPanelProps) {
  return (
    <aside className="animate-fade-in rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-medium text-[var(--text)]">
            {definition.id}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{definition.type}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
        >
          Close
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <StatusPill status={run.status} size="md" />
        <span className="text-xs text-[var(--text-muted)]">
          {run.attempts} attempt{run.attempts === 1 ? "" : "s"}
        </span>
      </div>

      <section className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
          Config
        </h4>
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[var(--bg-muted)] p-3 font-mono text-xs leading-relaxed text-[var(--text)]">
          {prettyJson(definition.config)}
        </pre>
      </section>

      {run.output && (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
            Output
          </h4>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[var(--status-succeeded-bg)] p-3 font-mono text-xs leading-relaxed text-[var(--status-succeeded-text)]">
            {prettyJson(run.output)}
          </pre>
        </section>
      )}

      {run.error && (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
            Error
          </h4>
          <p className="mt-2 rounded-lg bg-[var(--status-failed-bg)] p-3 text-sm text-[var(--status-failed-text)]">
            {run.error}
          </p>
        </section>
      )}
    </aside>
  );
}

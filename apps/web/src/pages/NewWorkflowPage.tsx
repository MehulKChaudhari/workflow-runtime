import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EXAMPLE_WORKFLOWS } from "../lib/mocks";
import { submitWorkflow, startRun } from "../lib/client";
import type { ValidationIssue } from "../lib/types";
import { prettyJson } from "../lib/format";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "created"; workflowId: string }
  | { kind: "invalid"; issues: ValidationIssue[] }
  | { kind: "error"; message: string };

export function NewWorkflowPage() {
  const navigate = useNavigate();
  const [json, setJson] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [starting, setStarting] = useState(false);

  const loadExample = (key: keyof typeof EXAMPLE_WORKFLOWS) => {
    setJson(prettyJson(EXAMPLE_WORKFLOWS[key]));
    setState({ kind: "idle" });
  };

  const handleSubmit = async () => {
    setState({ kind: "submitting" });
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setState({
        kind: "invalid",
        issues: [{ code: "INVALID_JSON", message: "Could not parse JSON" }],
      });
      return;
    }

    const result = await submitWorkflow(parsed);
    if (!result.ok) {
      setState({ kind: "invalid", issues: result.issues });
      return;
    }
    setState({ kind: "created", workflowId: result.workflowId });
  };

  const handleStart = async () => {
    if (state.kind !== "created") return;
    setStarting(true);
    try {
      const { runId } = await startRun(state.workflowId);
      navigate(`/app/runs/${runId}`);
    } catch (err: unknown) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to start run",
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="animate-fade-up w-full max-w-2xl">
      <h1 className="font-serif text-2xl text-[var(--text)] sm:text-3xl">New workflow</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Paste a workflow definition as JSON. Validation runs before anything hits
        the runtime.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => loadExample("birthday-cake")}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--bg-muted)]"
        >
          Load birthday-cake
        </button>
        <button
          type="button"
          onClick={() => loadExample("yc-digest")}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--bg-muted)]"
        >
          Load yc-digest
        </button>
      </div>

      <textarea
        value={json}
        onChange={(e) => {
          setJson(e.target.value);
          if (state.kind !== "idle" && state.kind !== "submitting") {
            setState({ kind: "idle" });
          }
        }}
        placeholder='{ "name": "...", "nodes": [...], "edges": [...] }'
        rows={14}
        className="mt-4 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 font-mono text-xs leading-relaxed text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition focus:border-[var(--accent-ring)] focus:ring-2 focus:ring-[var(--accent-soft)] sm:p-4 sm:text-sm"
      />

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!json.trim() || state.kind === "submitting"}
        className="mt-4 w-full rounded-lg bg-[var(--text)] px-5 py-2.5 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-40 sm:w-auto"
      >
        {state.kind === "submitting" ? "Validating..." : "Submit workflow"}
      </button>

      {state.kind === "created" && (
        <div className="mt-6 rounded-xl border border-[var(--status-succeeded-ring)] bg-[var(--status-succeeded-bg)] p-5 animate-fade-in">
          <p className="text-sm font-medium text-[var(--status-succeeded-text)]">
            Workflow accepted
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--status-succeeded-text)]">
            {state.workflowId}
          </p>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={starting}
            className="mt-4 rounded-lg bg-[var(--status-succeeded-text)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {starting ? "Starting..." : "Start run"}
          </button>
        </div>
      )}

      {state.kind === "invalid" && (
        <div className="mt-6 space-y-3 animate-fade-in">
          <p className="text-sm font-medium text-[var(--status-failed-text)]">
            Validation failed
          </p>
          {state.issues.map((issue, i) => (
            <div
              key={`${issue.code}-${i}`}
              className="rounded-lg border border-[var(--status-failed-ring)] bg-[var(--status-failed-bg)] p-4"
            >
              <p className="font-mono text-xs font-medium text-[var(--status-failed-text)]">
                {issue.code}
                {issue.path ? ` @ ${issue.path}` : ""}
              </p>
              <p className="mt-1 text-sm text-[var(--status-failed-text)]">{issue.message}</p>
            </div>
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <p className="mt-6 rounded-xl bg-[var(--status-failed-bg)] p-4 text-sm text-[var(--status-failed-text)]">
          {state.message}
        </p>
      )}
    </div>
  );
}

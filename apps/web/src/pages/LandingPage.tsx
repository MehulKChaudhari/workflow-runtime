import { Link } from "react-router-dom";
import { HeroWorkflowGrid } from "../components/HeroWorkflowGrid";
import { ThemeToggle } from "../components/ThemeToggle";

const GITHUB_URL = "https://github.com/MehulKChaudhari/workflow-runtine";

function AgentLoopDiagram() {
  return (
    <svg viewBox="0 0 200 155" className="h-full w-full" aria-hidden>
      <defs>
        <marker id="agent-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-subtle)" />
        </marker>
      </defs>
      <rect x="60" y="14" width="80" height="28" rx="6" fill="var(--bg-muted)" stroke="var(--border)" />
      <text x="100" y="32" textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">LLM</text>
      <path d="M100 42 L100 54" stroke="var(--text-subtle)" strokeWidth="1.5" markerEnd="url(#agent-arrow)" />
      <rect x="50" y="56" width="100" height="28" rx="6" fill="var(--bg-muted)" stroke="var(--border)" />
      <text x="100" y="74" textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">do step</text>
      <path d="M100 84 L100 96" stroke="var(--text-subtle)" strokeWidth="1.5" />
      {/* Loop stays clear of both boxes — arcs wide left before rejoining above LLM */}
      <path
        d="M100 96 C 100 108, 6 108, 6 32 C 6 10, 48 6, 100 10"
        fill="none"
        stroke="var(--status-failed-ring)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        markerEnd="url(#agent-arrow)"
      />
      <text x="100" y="138" textAnchor="middle" className="fill-[var(--status-failed-text)] text-[9px]">
        repeat every step
      </text>
    </svg>
  );
}

function PlanFirstDiagram() {
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden>
      <rect x="60" y="8" width="80" height="24" rx="6" fill="var(--accent-soft)" stroke="var(--accent-ring)" />
      <text x="100" y="24" textAnchor="middle" className="fill-[var(--accent)] text-[10px]">plan once</text>
      <path d="M100 32 L100 44" stroke="var(--accent)" strokeWidth="1.5" />
      <rect x="40" y="46" width="120" height="28" rx="6" fill="var(--bg-elevated)" stroke="var(--border)" />
      <text x="100" y="64" textAnchor="middle" className="fill-[var(--text)] text-[10px]">DAG</text>
      <path d="M70 74 L70 88 M100 74 L100 88 M130 74 L130 88" stroke="var(--border)" strokeWidth="1.5" />
      <rect x="50" y="90" width="40" height="22" rx="4" fill="var(--status-succeeded-bg)" stroke="var(--status-succeeded-ring)" />
      <rect x="80" y="90" width="40" height="22" rx="4" fill="var(--status-succeeded-bg)" stroke="var(--status-succeeded-ring)" />
      <rect x="110" y="90" width="40" height="22" rx="4" fill="var(--status-running-bg)" stroke="var(--status-running-ring)" />
      <text x="100" y="125" textAnchor="middle" className="fill-[var(--status-succeeded-text)] text-[9px]">
        deterministic execution
      </text>
    </svg>
  );
}

function FlowStep({ label, caption, showArrow }: { label: string; caption: string; showArrow?: boolean }) {
  return (
    <>
      <div className="flex w-full flex-col items-center text-center sm:min-w-[120px] sm:w-auto">
        <div className="w-full max-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:max-w-none sm:w-auto">
          <span className="font-mono text-sm text-[var(--text)]">{label}</span>
        </div>
        <p className="mt-2 max-w-[200px] text-xs leading-relaxed text-[var(--text-muted)] sm:max-w-[140px]">
          {caption}
        </p>
      </div>
      {showArrow && (
        <span className="text-[var(--text-subtle)] sm:mt-5" aria-hidden>
          <span className="block sm:hidden">↓</span>
          <span className="hidden sm:block">→</span>
        </span>
      )}
    </>
  );
}

function LifecycleDiagramDesktop() {
  const boxW = 72;
  const boxH = 36;
  const rowY = 24;
  const branchY = 92;
  const cy = rowY + boxH / 2;

  const main = [
    { id: "pending", x: 24 },
    { id: "ready", x: 120 },
    { id: "running", x: 216 },
    { id: "succeeded", x: 312 },
  ];

  const skipped = { id: "skipped", x: 24 };
  const failed = { id: "failed", x: 216 };

  return (
    <svg
      viewBox="0 0 408 132"
      className="mx-auto w-full max-w-2xl"
      aria-label="Node lifecycle states"
      overflow="visible"
    >
      {main.slice(0, -1).map((s, i) => (
        <line
          key={`main-${s.id}`}
          x1={s.x + boxW}
          y1={cy}
          x2={(main[i + 1]?.x ?? 0)}
          y2={cy}
          stroke="var(--border)"
          strokeWidth="1.5"
        />
      ))}

      {main.map((s) => (
        <g key={s.id}>
          <rect
            x={s.x}
            y={rowY}
            width={boxW}
            height={boxH}
            rx="8"
            fill="var(--bg-elevated)"
            stroke="var(--border)"
          />
          <text
            x={s.x + boxW / 2}
            y={cy + 4}
            textAnchor="middle"
            className="fill-[var(--text-muted)] text-[9px]"
          >
            {s.id}
          </text>
        </g>
      ))}

      {/* pending → skipped (upstream failure) */}
      <path
        d={`M ${skipped.x + 20} ${rowY + boxH} L ${skipped.x + 20} ${branchY - 10} C ${skipped.x + 20} ${branchY - 2}, ${skipped.x + boxW / 2} ${branchY - 2}, ${skipped.x + boxW / 2} ${branchY}`}
        fill="none"
        stroke="var(--status-skipped-ring)"
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />
      <rect
        x={skipped.x}
        y={branchY}
        width={boxW}
        height={boxH}
        rx="8"
        fill="var(--bg-elevated)"
        stroke="var(--status-skipped-ring)"
        strokeDasharray="3 2"
      />
      <text
        x={skipped.x + boxW / 2}
        y={branchY + boxH / 2 + 4}
        textAnchor="middle"
        className="fill-[var(--status-skipped-text)] text-[9px]"
      >
        {skipped.id}
      </text>

      {/* running → failed */}
      <line
        x1={failed.x + boxW / 2}
        y1={rowY + boxH}
        x2={failed.x + boxW / 2}
        y2={branchY}
        stroke="var(--status-failed-ring)"
        strokeWidth="1.5"
      />
      <rect
        x={failed.x}
        y={branchY}
        width={boxW}
        height={boxH}
        rx="8"
        fill="var(--status-failed-bg)"
        stroke="var(--status-failed-ring)"
      />
      <text
        x={failed.x + boxW / 2}
        y={branchY + boxH / 2 + 4}
        textAnchor="middle"
        className="fill-[var(--status-failed-text)] text-[9px]"
      >
        {failed.id}
      </text>
    </svg>
  );
}

function LifecycleDiagramMobile() {
  const main = ["pending", "ready", "running", "succeeded"];
  const boxW = 120;
  const boxH = 36;
  const cx = 70;

  return (
    <svg
      viewBox="0 0 140 300"
      className="mx-auto w-full max-w-[180px]"
      aria-label="Node lifecycle states"
      overflow="visible"
    >
      {main.map((id, i) => {
        const y = 16 + i * 58;
        return (
          <g key={id}>
            {i > 0 && (
              <line
                x1={cx}
                y1={y - 16}
                x2={cx}
                y2={y - 4}
                stroke="var(--border)"
                strokeWidth="1.5"
              />
            )}
            <rect
              x={cx - boxW / 2}
              y={y}
              width={boxW}
              height={boxH}
              rx="8"
              fill="var(--bg-elevated)"
              stroke="var(--border)"
            />
            <text
              x={cx}
              y={y + boxH / 2 + 4}
              textAnchor="middle"
              className="fill-[var(--text-muted)] text-[9px]"
            >
              {id}
            </text>
          </g>
        );
      })}

      {/* skipped branch from pending */}
      <path
        d="M 34 52 C 12 52, 12 200, 34 200"
        fill="none"
        stroke="var(--status-skipped-ring)"
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />
      <rect
        x={cx - boxW / 2}
        y={208}
        width={boxW}
        height={boxH}
        rx="8"
        fill="var(--bg-elevated)"
        stroke="var(--status-skipped-ring)"
        strokeDasharray="3 2"
      />
      <text
        x={cx}
        y={226}
        textAnchor="middle"
        className="fill-[var(--status-skipped-text)] text-[9px]"
      >
        skipped
      </text>

      {/* failed branch from running */}
      <line
        x1={cx + boxW / 2}
        y1={16 + 2 * 58 + boxH / 2}
        x2={cx + boxW / 2 + 28}
        y2={16 + 2 * 58 + boxH / 2}
        stroke="var(--status-failed-ring)"
        strokeWidth="1.5"
      />
      <line
        x1={cx + boxW / 2 + 28}
        y1={16 + 2 * 58 + boxH / 2}
        x2={cx + boxW / 2 + 28}
        y2={250}
        stroke="var(--status-failed-ring)"
        strokeWidth="1.5"
      />
      <rect
        x={cx + boxW / 2 + 4}
        y={250}
        width={56}
        height={boxH}
        rx="8"
        fill="var(--status-failed-bg)"
        stroke="var(--status-failed-ring)"
      />
      <text
        x={cx + boxW / 2 + 32}
        y={268}
        textAnchor="middle"
        className="fill-[var(--status-failed-text)] text-[8px]"
      >
        failed
      </text>
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl sm:text-2xl">Workflow</span>
          <span className="text-sm text-[var(--text-muted)]">Runtime</span>
        </div>
        <nav className="flex w-full items-center justify-end gap-2 text-sm sm:w-auto sm:gap-3">
          <ThemeToggle />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            GitHub
          </a>
          <Link
            to="/app"
            className="rounded-full bg-[var(--accent)] px-4 py-2 font-medium text-white transition hover:bg-[var(--accent-hover)]"
          >
            Open app
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <HeroWorkflowGrid />
        <div className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
        <div className="animate-fade-up max-w-2xl">
          <p className="text-xs font-medium tracking-widest text-[var(--accent)] uppercase sm:text-sm">
            Plan once, execute reliably
          </p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-[1.12] tracking-tight text-[var(--text)] sm:text-5xl md:text-6xl">
            The LLM plans once.
            <br />
            <span className="text-[var(--text-muted)]">A deterministic runtime executes it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--text-muted)] sm:mt-6 sm:text-lg">
            A lightweight workflow engine for AI steps. The model produces a DAG;
            a scheduler decides what is ready; workers run single nodes; every state
            change is persisted so a crashed run resumes instead of restarting.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link
              to="/app"
              className="rounded-full bg-[var(--text)] px-6 py-3 text-center text-sm font-medium text-[var(--bg)] transition hover:opacity-90"
            >
              View runs
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border)] px-6 py-3 text-center text-sm font-medium text-[var(--text)] transition hover:bg-[var(--bg-muted)]"
            >
              Source on GitHub
            </a>
          </div>
        </div>

        <p className="relative z-10 mx-auto mt-8 max-w-xs rotate-[-1deg] px-4 font-serif text-sm italic text-[var(--text-subtle)] animate-fade-up stagger-2 sm:mt-10 sm:px-6 sm:text-base">
          p.s. if kill -9 does not scare you, persistence is working.
        </p>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-elevated)] py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-serif text-2xl text-[var(--text)] sm:text-3xl">The problem</h2>
          <p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">
            Naive agent loops ask the model what to do on every step. That is
            expensive, non-deterministic, and impossible to resume after a crash.
          </p>
          <div className="mt-8 grid gap-6 sm:mt-12 sm:gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] p-5 animate-fade-up stagger-1 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--status-failed-text)]">
                Agent loop
              </p>
              <div className="mt-4 h-40 sm:h-36">
                <AgentLoopDiagram />
              </div>
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Control flow lives in the model. No shared plan, no crash recovery.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--accent-ring)] bg-[var(--accent-soft)]/30 p-5 animate-fade-up stagger-2 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                Plan-first
              </p>
              <div className="mt-4 h-36">
                <PlanFirstDiagram />
              </div>
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                The graph is data. The runtime owns execution, retries, and durability.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-serif text-2xl sm:text-3xl">How it works</h2>
          <div className="mt-8 flex flex-col items-center gap-2 sm:mt-12 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
            <FlowStep label="planner" caption="LLM emits a validated DAG" showArrow />
            <FlowStep label="graph" caption="Cycles rejected at submit time" showArrow />
            <FlowStep label="scheduler" caption="Picks ready nodes" showArrow />
            <FlowStep label="workers" caption="One step per attempt" showArrow />
            <FlowStep label="postgres" caption="State survives restarts" />
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg-muted)] py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-serif text-2xl sm:text-3xl">Node lifecycle</h2>
          <p className="mt-3 text-sm text-[var(--text-muted)] sm:text-base">
            Every node moves through a small, explicit state machine. Illegal
            transitions are rejected — the runtime, not the model, owns status.
          </p>
          <div className="mt-8 flex justify-center sm:mt-10">
            <div className="hidden w-full sm:block">
              <LifecycleDiagramDesktop />
            </div>
            <div className="sm:hidden">
              <LifecycleDiagramMobile />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-10 sm:py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-[var(--text-muted)]">
              Educational project inspired by the Structured Graph Harness paper.
              Not a Temporal replacement — built to learn scheduler-centric agent
              architectures.
            </p>
            <p className="mt-3 font-serif text-sm italic text-[var(--text-subtle)]">
              sketched between coffee refills — Mehul
            </p>
          </div>
          <Link to="/app" className="shrink-0 text-sm font-medium text-[var(--accent)] hover:underline">
            Open the run visualizer →
          </Link>
        </div>
      </footer>
    </div>
  );
}

/**
 * Decorative hero backdrop — faint grid + a single workflow DAG.
 * Uses status/accent tokens at low opacity so it stays quiet in both themes.
 */
export function HeroWorkflowGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="hero-grid absolute inset-0" />

      <div className="absolute -right-8 top-8 h-[min(420px,70%)] w-[min(520px,95%)] opacity-[0.55] sm:right-0 sm:top-12 lg:right-4 lg:opacity-70">
        <svg
          viewBox="0 0 480 320"
          className="h-full w-full"
          fill="none"
        >
          {/* edges */}
          <path d="M 88 72 L 168 72" stroke="var(--border)" strokeWidth="1" />
          <path d="M 88 72 L 168 128" stroke="var(--border)" strokeWidth="1" />
          <path d="M 88 72 L 168 184" stroke="var(--border)" strokeWidth="1" />
          <path d="M 232 72 L 312 160" stroke="var(--border)" strokeWidth="1" />
          <path d="M 232 128 L 312 160" stroke="var(--border)" strokeWidth="1" />
          <path d="M 232 184 L 312 160" stroke="var(--border)" strokeWidth="1" />
          <path d="M 376 160 L 416 160" stroke="var(--accent-ring)" strokeWidth="1" />

          {/* fetch */}
          <rect x="24" y="52" width="64" height="40" rx="8" fill="var(--status-ready-bg)" stroke="var(--status-ready-ring)" strokeWidth="1" />
          <text x="56" y="76" textAnchor="middle" className="fill-[var(--status-ready-text)] text-[9px] opacity-80">fetch</text>

          {/* parallel summarize nodes */}
          <rect x="168" y="52" width="64" height="40" rx="8" fill="var(--status-running-bg)" stroke="var(--status-running-ring)" strokeWidth="1" />
          <text x="200" y="76" textAnchor="middle" className="fill-[var(--status-running-text)] text-[9px] opacity-80">sum-1</text>

          <rect x="168" y="108" width="64" height="40" rx="8" fill="var(--status-succeeded-bg)" stroke="var(--status-succeeded-ring)" strokeWidth="1" />
          <text x="200" y="132" textAnchor="middle" className="fill-[var(--status-succeeded-text)] text-[9px] opacity-80">sum-2</text>

          <rect x="168" y="164" width="64" height="40" rx="8" fill="var(--status-pending-bg)" stroke="var(--status-pending-ring)" strokeWidth="1" />
          <text x="200" y="188" textAnchor="middle" className="fill-[var(--status-pending-text)] text-[9px] opacity-80">sum-3</text>

          {/* merge */}
          <rect x="312" y="140" width="64" height="40" rx="8" fill="var(--accent-soft)" stroke="var(--accent-ring)" strokeWidth="1" />
          <text x="344" y="164" textAnchor="middle" className="fill-[var(--accent)] text-[9px] opacity-90">merge</text>

          {/* save */}
          <rect x="416" y="140" width="48" height="40" rx="8" fill="var(--status-succeeded-bg)" stroke="var(--status-succeeded-ring)" strokeWidth="1" />
          <text x="440" y="164" textAnchor="middle" className="fill-[var(--status-succeeded-text)] text-[9px] opacity-80">save</text>

          {/* small lifecycle hint — bottom left */}
          <rect x="48" y="248" width="52" height="28" rx="6" fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth="1" />
          <rect x="116" y="248" width="52" height="28" rx="6" fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth="1" />
          <rect x="184" y="248" width="52" height="28" rx="6" fill="var(--bg-elevated)" stroke="var(--status-running-ring)" strokeWidth="1" />
          <path d="M 100 262 L 116 262 M 168 262 L 184 262" stroke="var(--border)" strokeWidth="1" />
          <text x="74" y="266" textAnchor="middle" className="fill-[var(--text-subtle)] text-[7px]">pending</text>
          <text x="142" y="266" textAnchor="middle" className="fill-[var(--text-subtle)] text-[7px]">ready</text>
          <text x="210" y="266" textAnchor="middle" className="fill-[var(--text-subtle)] text-[7px]">running</text>
        </svg>
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg)]/40 to-[var(--bg)]" />
      <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[var(--bg)] via-[var(--bg)]/80 to-transparent" />
    </div>
  );
}

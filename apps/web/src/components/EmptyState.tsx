import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-8 py-16 text-center animate-fade-up">
      <h3 className="font-serif text-2xl text-[var(--text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

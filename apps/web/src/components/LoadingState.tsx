interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 animate-fade-in">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse-soft"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

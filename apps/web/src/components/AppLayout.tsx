import { Link, NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)]",
  ].join(" ");

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-elevated)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="group flex min-w-0 items-baseline gap-1.5 sm:gap-2">
            <span className="truncate font-serif text-lg text-[var(--text)] sm:text-xl">Workflow</span>
            <span className="text-sm font-medium tracking-wide text-[var(--text-muted)]">
              Runtime
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <ThemeToggle />
            <NavLink to="/app" end className={navLinkClass}>
              Runs
            </NavLink>
            <NavLink to="/app/new" className={navLinkClass}>
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New workflow</span>
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

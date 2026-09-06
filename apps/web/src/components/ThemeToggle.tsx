import { useEffect, useId, useRef, useState } from "react";
import { LuCheck, LuChevronDown, LuMonitor, LuMoon, LuSun } from "react-icons/lu";
import { useTheme } from "./ThemeProvider";
import type { ThemePreference } from "../lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof LuSun }> = [
  { value: "system", label: "System", Icon: LuMonitor },
  { value: "light", label: "Light", Icon: LuSun },
  { value: "dark", label: "Dark", Icon: LuMoon },
];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0]!;
  const CurrentIcon = current.Icon;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (value: ThemePreference) => {
    setPreference(value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={["relative", className].join(" ")}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
      >
        <CurrentIcon size={15} aria-hidden />
        <span className="hidden sm:inline">{current.label}</span>
        <LuChevronDown
          size={14}
          aria-hidden
          className={["transition-transform", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Color theme"
          className="absolute right-0 z-50 mt-1.5 min-w-[148px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-md)] animate-fade-in"
        >
          {OPTIONS.map(({ value, label, Icon }) => {
            const active = preference === value;
            return (
              <li key={value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => select(value)}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
                    active
                      ? "bg-[var(--bg-muted)] text-[var(--text)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  <Icon size={15} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {active && <LuCheck size={14} className="text-[var(--accent)]" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

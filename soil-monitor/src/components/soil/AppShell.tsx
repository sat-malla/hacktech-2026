import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Search, Bell, Moon, Sun } from "lucide-react";
import { useSoilStore, PLOTS } from "@/lib/soil/store";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/" as const, label: "Dashboard" },
  { to: "/plan" as const, label: "Plan" },
  { to: "/scan" as const, label: "Scan" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const activePlot = useSoilStore((s) => s.activePlot);
  const plotMeta = PLOTS.find((p) => p.id === activePlot)!;
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };
  return (
    <div className="min-h-screen w-full bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-[1320px] items-center gap-8 px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-success to-biology text-background shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
              <Leaf />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">
              Soil<span className="text-success">Compass</span>
            </span>
          </Link>

          <nav className="flex items-center gap-5">
            {NAV.map((item) => {
              const active = loc.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative py-3.5 text-[13px] transition-colors",
                    active
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-px bg-foreground" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              aria-label="Search"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Notifications"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <div className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
              EM
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 py-10">{children}</main>

      <footer className="mx-auto max-w-[1320px] px-6 py-8 text-[11.5px] text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
          <span>© 2026 SoilCompass · {plotMeta.label} · {plotMeta.bearing}</span>
          <span className="tabular-nums">Synced 2 min ago</span>
        </div>
      </footer>
    </div>
  );
}

function Leaf() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-10-1 12-5 16-9 17Z" />
      <path d="M2 22c2-3 5-6 9-9" />
    </svg>
  );
}

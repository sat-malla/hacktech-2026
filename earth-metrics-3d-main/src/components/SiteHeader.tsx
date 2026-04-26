import { Link } from "@tanstack/react-router";

export default function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/40 border-b border-border/40">
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-2 h-2 rounded-full bg-copper pulse-ring" />
          <span className="font-display text-sm tracking-[0.18em] uppercase">
            Soil<span className="text-copper">T</span>une
          </span>
        </Link>
        <nav className="flex items-center gap-7 text-xs uppercase tracking-[0.16em]">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: "text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Overview
          </Link>
          <Link
            to="/home-garden"
            className="text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: "text-foreground" }}
          >
            Home Garden
          </Link>
          <Link
            to="/demo"
            className="text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: "text-foreground" }}
          >
            Live Demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

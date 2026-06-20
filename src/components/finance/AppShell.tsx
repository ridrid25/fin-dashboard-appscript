import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Wallet, TrendingUp, Landmark } from "lucide-react";
import { PeriodPicker } from "./PeriodPicker";
import { ThemeToggle } from "./ThemeToggle";
import { DataSourceBadge } from "./DataSourceBadge";

const NAV: { to: "/" | "/money" | "/profit" | "/capital"; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Дэшборд", icon: LayoutDashboard, exact: true },
  { to: "/money", label: "Деньги", icon: Wallet },
  { to: "/profit", label: "Прибыль", icon: TrendingUp },
  { to: "/capital", label: "Капитал", icon: Landmark },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });


  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-6">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
              CF
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-base font-semibold leading-none">CFO Dashboard</div>
              <div className="truncate text-[11px] text-muted-foreground">финансовый прототип</div>
            </div>
          </div>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <PeriodPicker />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur sm:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <DataSourceBadge />
    </div>
  );
}

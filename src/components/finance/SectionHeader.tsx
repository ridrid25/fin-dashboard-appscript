import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Accent = "money" | "profit" | "capital";

const ACCENTS: Record<Accent, { bg: string; ring: string; text: string; bar: string }> = {
  money: {
    bg: "bg-income/10",
    ring: "ring-income/30",
    text: "text-income",
    bar: "bg-gradient-to-r from-income via-income/60 to-transparent",
  },
  profit: {
    bg: "bg-primary/10",
    ring: "ring-primary/30",
    text: "text-primary",
    bar: "bg-gradient-to-r from-primary via-primary/60 to-transparent",
  },
  capital: {
    bg: "bg-chart-4/10",
    ring: "ring-chart-4/30",
    text: "text-chart-4",
    bar: "bg-gradient-to-r from-chart-4 via-chart-4/60 to-transparent",
  },
};

export function SectionHeader({
  accent,
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  accent: Accent;
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${a.bar}`} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${a.bg} ${a.ring} ${a.text}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-semibold leading-tight">{title}</div>
            {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

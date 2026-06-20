import type { ReactNode } from "react";
import type { StatusLevel } from "@/types/finance";

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-lg font-semibold leading-none">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/70 bg-card ${padded ? "p-4 sm:p-5" : ""} shadow-[0_1px_2px_rgb(15_23_42_/_4%),0_1px_0_0_rgb(255_255_255_/_2%)_inset] dark:shadow-[0_1px_0_0_rgb(255_255_255_/_2%)_inset] ${className}`}
    >
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  status,
  trend,
  emphasis = "md",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  status?: StatusLevel;
  trend?: ReactNode;
  emphasis?: "md" | "lg";
}) {
  const dot =
    status === "good"
      ? "bg-good"
      : status === "warn"
        ? "bg-warn"
        : status === "bad"
          ? "bg-bad"
          : "bg-muted-foreground/50";
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {status && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
      </div>
      <div
        className={`mt-2 font-display tabular font-bold leading-none text-foreground ${
          emphasis === "lg" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-[28px]"
        }`}
      >
        {value}
      </div>
      {(hint || trend) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{hint}</span>
          {trend && <span className="shrink-0 tabular">{trend}</span>}
        </div>
      )}
    </Card>
  );
}

export function StatusBadge({ level, children }: { level: StatusLevel; children: ReactNode }) {
  const styles =
    level === "good"
      ? "bg-good/15 text-good border-good/30"
      : level === "warn"
        ? "bg-warn/15 text-warn border-warn/30"
        : "bg-bad/15 text-bad border-bad/30";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${level === "good" ? "bg-good" : level === "warn" ? "bg-warn" : "bg-bad"}`}
      />
      {children}
    </span>
  );
}

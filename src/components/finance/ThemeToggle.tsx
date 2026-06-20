import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className={`sr-only ${className}`}>Сменить тему</span>
    </button>
  );
}

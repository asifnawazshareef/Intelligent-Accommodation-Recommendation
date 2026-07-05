import { cn } from "@/lib/utils";

export const FilterChip = ({ active, onClick, children, count = 0 }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground shadow-sm"
        : "border-border/60 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground",
    )}
  >
    {children}
    {count > 0 && (
      <span
        className={cn(
          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    )}
  </button>
);

const FilterChipBar = ({ children, className }) => (
  <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
);

export default FilterChipBar;

import { cn } from "@/lib/utils";

export const StatChip = ({ icon: Icon, label, value, tone = "default" }) => (
  <div
    className={cn(
      "flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border px-4 py-3",
      tone === "amber" && "border-amber-500/25 bg-amber-500/5",
      tone === "emerald" && "border-emerald-500/25 bg-emerald-500/5",
      tone === "primary" && "border-primary/25 bg-primary/5",
      tone === "violet" && "border-violet-500/25 bg-violet-500/5",
      tone === "default" && "border-border/60 bg-muted/20",
    )}
  >
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        tone === "amber" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        tone === "emerald" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "violet" && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        tone === "default" && "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold leading-tight" dir="ltr">
        {value}
      </p>
    </div>
  </div>
);

const StatSummaryBar = ({ children, className }) => (
  <div
    className={cn(
      "flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
  >
    {children}
  </div>
);

export default StatSummaryBar;

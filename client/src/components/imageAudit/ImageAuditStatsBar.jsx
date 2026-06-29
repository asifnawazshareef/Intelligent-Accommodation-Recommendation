import { Building2, CheckCircle2, Clock, ShieldAlert, ShieldX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const statConfig = [
  { key: "all", icon: Building2, activeClass: "border-primary/40 bg-primary/5" },
  {
    key: "pending",
    icon: Clock,
    activeClass: "border-amber-500/40 bg-amber-500/10",
    valueClass: "text-amber-800 dark:text-amber-300",
  },
  {
    key: "verified",
    icon: CheckCircle2,
    activeClass: "border-emerald-500/40 bg-emerald-500/10",
    valueClass: "text-emerald-700 dark:text-emerald-400",
  },
  {
    key: "suspicious",
    icon: ShieldAlert,
    activeClass: "border-orange-500/40 bg-orange-500/10",
    valueClass: "text-orange-700 dark:text-orange-400",
  },
  {
    key: "rejected",
    icon: ShieldX,
    activeClass: "border-red-500/40 bg-red-500/10",
    valueClass: "text-red-700 dark:text-red-400",
  },
];

const ImageAuditStatsBar = ({ counts, activeFilter, onFilterChange, loading }) => {
  const { t } = useTranslation();

  const labelFor = (key) =>
    key === "all" ? t("imageAudit.filterAll") : t(`imageAudit.status.${key}`, key);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {statConfig.map(({ key, icon: Icon, activeClass, valueClass }) => {
        const isActive = activeFilter === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            className={cn(
              "rounded-xl border border-border/60 bg-card/60 p-3 text-start transition-all hover:border-primary/30 hover:bg-muted/30",
              isActive && activeClass,
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  valueClass && isActive ? valueClass : "text-foreground",
                )}
                dir="ltr"
              >
                {loading ? "—" : counts[key]}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {labelFor(key)}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default ImageAuditStatsBar;

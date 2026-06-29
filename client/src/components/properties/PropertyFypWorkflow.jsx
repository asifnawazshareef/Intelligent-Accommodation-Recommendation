import {
  CalendarRange,
  CreditCard,
  MessageSquarePlus,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const steps = [
  { key: "search", icon: Search },
  { key: "book", icon: CalendarRange },
  { key: "pay", icon: CreditCard },
  { key: "review", icon: MessageSquarePlus },
  { key: "sentiment", icon: Sparkles },
];

const PropertyFypWorkflow = ({ className }) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5",
        className,
      )}
    >
      <p className="text-sm font-semibold">{t("propertyDetail.fypWorkflowTitle")}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t("propertyDetail.fypWorkflowHint")}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className="relative flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-2 py-3 text-center"
            >
              {index < steps.length - 1 && (
                <span
                  className="absolute end-0 top-1/2 hidden h-px w-2 translate-x-full bg-border sm:block"
                  aria-hidden="true"
                />
              )}
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-foreground">
                {t(`propertyDetail.fypStep_${step.key}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PropertyFypWorkflow;

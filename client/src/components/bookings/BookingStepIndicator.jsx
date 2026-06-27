import { cn } from "@/lib/utils";

const BookingStepIndicator = ({ currentStep, t }) => {
  const steps = [
    { id: 1, label: t("bookingPage.stepDates") },
    { id: 2, label: t("bookingPage.stepPayment") },
    { id: 3, label: t("bookingPage.stepDone") },
  ];

  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label={t("bookingPage.flowLabel")}>
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = step.id < currentStep;

        return (
          <li key={step.id} className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium sm:text-sm",
                isActive && "bg-primary/15 text-primary",
                isComplete &&
                  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                !isActive && !isComplete && "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold",
                  isActive && "bg-primary text-primary-foreground",
                  isComplete && "bg-emerald-600 text-white",
                  !isActive &&
                    !isComplete &&
                    "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {isComplete ? "✓" : step.id}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
            </span>
            {index < steps.length - 1 && (
              <span
                className="hidden h-px w-4 bg-border sm:block lg:w-6"
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default BookingStepIndicator;

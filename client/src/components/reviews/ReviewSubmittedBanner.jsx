import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const ReviewSubmittedBanner = ({
  propertyId,
  className,
  showViewLink = true,
  variant = "default",
}) => {
  const { t } = useTranslation();
  const isCompact = variant === "compact";

  if (isCompact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2.5",
          className,
        )}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-emerald-800 dark:text-emerald-300">
          {t("review.reviewSubmittedTitle")}
        </p>
        {showViewLink && propertyId ? (
          <Link
            to={`/properties/${propertyId}#reviews`}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("review.viewShort")}
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-primary/[0.06] p-3.5 sm:p-4",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -end-6 -top-6 size-24 rounded-full bg-emerald-400/15 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-4 start-8 size-16 rounded-full bg-primary/10 blur-xl"
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/35">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          <Sparkles
            className="absolute -end-0.5 -top-0.5 size-3.5 text-emerald-500/80"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-emerald-800 dark:text-emerald-300">
            {t("review.reviewSubmittedTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("review.reviewSubmittedHint")}
          </p>

          {showViewLink && propertyId ? (
            <Link
              to={`/properties/${propertyId}#reviews`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80 sm:text-sm"
            >
              {t("review.viewYourReview")}
              <ArrowRight className="size-3.5 shrink-0" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ReviewSubmittedBanner;

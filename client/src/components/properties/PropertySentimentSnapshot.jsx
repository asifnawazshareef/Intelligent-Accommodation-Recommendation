import { MessageSquare, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropertyInsightStrip from "@/components/properties/PropertyInsightStrip";
import { cn } from "@/lib/utils";

const SentimentBar = ({ label, value, total, tone }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums" dir="ltr">
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/50">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const PropertySentimentSnapshot = ({ summary, onViewReviews, className }) => {
  const { t } = useTranslation();
  const data = summary || {};
  const total = data.totalReviews || 0;

  if (total <= 0) {
    return null;
  }

  const segments = [
    {
      key: "positive",
      label: t("review.positive"),
      value: data.positiveCount || 0,
      tone: "bg-emerald-500",
    },
    {
      key: "neutral",
      label: t("review.neutral"),
      value: data.neutralCount || 0,
      tone: "bg-slate-400",
    },
    {
      key: "negative",
      label: t("review.negative"),
      value: data.negativeCount || 0,
      tone: "bg-red-500",
    },
  ];

  if ((data.mixedCount || 0) > 0) {
    segments.push({
      key: "mixed",
      label: t("review.mixed"),
      value: data.mixedCount,
      tone: "bg-amber-500",
    });
  }

  const positiveShare =
    total > 0 ? Math.round(((data.positiveCount || 0) / total) * 100) : 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="size-4 text-primary" />
            {t("propertyDetail.sentimentSnapshot")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("propertyDetail.sentimentSnapshotHint")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
          <Star className="size-4 fill-amber-400 text-amber-400" />
          <div>
            <p className="text-sm font-bold leading-none" dir="ltr">
              {data.averageRating || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("search.reviewCount", { count: total })}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted/40">
        {segments.map((segment) => {
          const width = total > 0 ? (segment.value / total) * 100 : 0;
          if (width <= 0) return null;
          return (
            <div
              key={segment.key}
              className={cn(segment.tone, "h-full")}
              style={{ width: `${width}%` }}
              title={`${segment.label}: ${Math.round(width)}%`}
            />
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <SentimentBar
              key={segment.key}
              label={segment.label}
              value={segment.value}
              total={total}
              tone={segment.tone}
            />
          ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {t("propertyDetail.positiveShare", { value: positiveShare })}
      </p>

      <PropertyInsightStrip summary={summary} compact className="mt-3" />

      {onViewReviews ? (
        <button
          type="button"
          onClick={onViewReviews}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          {t("propertyDetail.viewFullSentiment")}
        </button>
      ) : null}
    </div>
  );
};

export default PropertySentimentSnapshot;

import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildPropertyInsightText,
  getAspectLabel,
  sentimentToneClass,
} from "@/lib/sentimentInsights";

const StatCard = ({ label, value }) => (
  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xl font-semibold" dir="ltr">
      {value}
    </p>
  </div>
);

const AspectChip = ({ aspect, sentiment, count, t }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs capitalize ${sentimentToneClass(sentiment)}`}
  >
    <span>{getAspectLabel(aspect, t)}</span>
    {count ? (
      <span className="opacity-70" dir="ltr">
        ({count})
      </span>
    ) : null}
  </span>
);

const SentimentSummary = ({ summary }) => {
  const { t } = useTranslation();
  const data = summary || {};
  const insightText = buildPropertyInsightText(data, t);

  const aspectBreakdown =
    data.aspectBreakdown ||
    (data.topAspects || []).map(({ aspect, count }) => ({
      aspect,
      total: count,
      dominantSentiment: "neutral",
    }));

  const sentimentStats = [
    { key: "positive", label: t("review.positive"), value: data.positiveCount || 0 },
    { key: "negative", label: t("review.negative"), value: data.negativeCount || 0 },
    { key: "neutral", label: t("review.neutral"), value: data.neutralCount || 0 },
  ];

  if ((data.mixedCount || 0) > 0) {
    sentimentStats.push({
      key: "mixed",
      label: t("review.mixed"),
      value: data.mixedCount,
    });
  }

  return (
    <Card className="glass-card border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          {t("review.sentimentSummary")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insightText ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium text-primary">
              {t("review.guestInsightTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {insightText}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label={t("propertyDetail.totalReviews")}
            value={data.totalReviews || 0}
          />
          <StatCard
            label={t("propertyDetail.averageRating")}
            value={data.averageRating || 0}
          />
          {sentimentStats.map((stat) => (
            <StatCard key={stat.key} label={stat.label} value={stat.value} />
          ))}
        </div>

        {(data.praisedAspects?.length > 0 || data.concernAspects?.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.praisedAspects?.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {t("review.praisedThemes")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.praisedAspects.map(({ aspect, count }) => (
                    <AspectChip
                      key={`praise-${aspect}`}
                      aspect={aspect}
                      sentiment="positive"
                      count={count}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {data.concernAspects?.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-red-700 dark:text-red-300">
                  {t("review.concernThemes")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.concernAspects.map(({ aspect, count }) => (
                    <AspectChip
                      key={`concern-${aspect}`}
                      aspect={aspect}
                      sentiment="negative"
                      count={count}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">
            {t("propertyDetail.topAspects")}
          </p>
          <div className="flex flex-wrap gap-2">
            {aspectBreakdown.length ? (
              aspectBreakdown.map(({ aspect, total, dominantSentiment }) => (
                <AspectChip
                  key={aspect}
                  aspect={aspect}
                  sentiment={dominantSentiment}
                  count={total}
                  t={t}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("propertyDetail.noAspects")}
              </p>
            )}
          </div>
        </div>

        <Badge variant="outline" className="text-xs font-normal">
          {t("review.nlpPowered")}
        </Badge>
      </CardContent>
    </Card>
  );
};

export default SentimentSummary;

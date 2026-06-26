import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StatCard = ({ label, value }) => (
  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xl font-semibold" dir="ltr">
      {value}
    </p>
  </div>
);

const SentimentSummary = ({ summary }) => {
  const { t } = useTranslation();
  const data = summary || {};
  const topAspects =
    data.topAspects ||
    Object.entries(data.aspectCounts || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([aspect, count]) => ({ aspect, count }));

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
        <CardTitle>{t("review.sentimentSummary")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div>
          <p className="mb-2 text-sm font-medium">
            {t("propertyDetail.topAspects")}
          </p>
          <div className="flex flex-wrap gap-2">
            {topAspects.length ? (
              topAspects.map(({ aspect, count }) => (
                <span
                  key={aspect}
                  className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs capitalize"
                >
                  {aspect}: {count}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("propertyDetail.noAspects")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SentimentSummary;

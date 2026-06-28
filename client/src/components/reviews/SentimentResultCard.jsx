import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SentimentBadge from "./SentimentBadge";
import {
  getAspectLabel,
  sentimentToneClass,
} from "@/lib/sentimentInsights";

const normalizeAspectInsights = (review) => {
  if (Array.isArray(review.aspectInsights) && review.aspectInsights.length) {
    return review.aspectInsights;
  }

  return (review.aspects || []).map((aspect) => ({
    aspect,
    sentiment: review.sentiment || "neutral",
  }));
};

const SentimentResultCard = ({ review }) => {
  const { t } = useTranslation();

  if (!review) {
    return null;
  }

  const reviewText = review.text || review.comment;
  const aspectInsights = normalizeAspectInsights(review);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          {t("review.analysisResultTitle")}
          <SentimentBadge sentiment={review.sentiment} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">
              {t("review.confidenceLabel")}
            </p>
            <p className="text-lg font-semibold" dir="ltr">
              {Math.round((review.sentimentScore || 0) * 100)}%
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">{t("review.rating")}</p>
            <p className="text-lg font-semibold" dir="ltr">
              {review.rating}/5
            </p>
          </div>
        </div>

        {review.summary ? (
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="text-sm font-medium">{t("review.aiSummary")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{review.summary}</p>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-medium">{t("review.detectedThemes")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {aspectInsights.length ? (
              aspectInsights.map((item) => (
                <Badge
                  key={item.aspect}
                  variant="outline"
                  className={`capitalize ${sentimentToneClass(item.sentiment)}`}
                >
                  {getAspectLabel(item.aspect, t)}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("review.noThemesDetected")}
              </p>
            )}
          </div>
        </div>

        {reviewText ? (
          <p className="text-xs text-muted-foreground line-clamp-3">{reviewText}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default SentimentResultCard;

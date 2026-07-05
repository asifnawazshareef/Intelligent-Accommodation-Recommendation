import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/components/ui/EmptyState";
import AspectInsightBadges from "@/components/reviews/AspectInsightBadges";
import SentimentBadge from "@/components/reviews/SentimentBadge";
import StarRatingRow from "@/components/reviews/StarRatingDisplay";
import { formatDate } from "@/lib/formatters";
import { normalizeAspectInsights } from "@/lib/reviewAspects";

const ReviewsList = ({ reviews = [] }) => {
  const { t, i18n } = useTranslation();

  return (
    <Card className="glass-card border-border/60">
      <CardHeader>
        <CardTitle>{t("review.reviews")}</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length ? (
          <div className="space-y-4">
            {reviews.map((review) => {
              const guestName =
                review.guest?.name || t("review.anonymousGuest");
              const aspectInsights = normalizeAspectInsights(review);

              return (
                <article
                  key={review._id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{guestName}</p>
                      <StarRatingRow rating={review.rating} />
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.createdAt, i18n.language)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SentimentBadge sentiment={review.sentiment} />
                      {review.sentimentScore > 0 ? (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {t("review.confidence", {
                            value: Math.round(review.sentimentScore * 100),
                          })}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed">{review.text}</p>

                  {review.summary ? (
                    <p className="mt-2 rounded-md border border-border/50 bg-background/60 p-2 text-sm italic text-muted-foreground">
                      {review.summary}
                    </p>
                  ) : null}

                  <AspectInsightBadges
                    insights={aspectInsights}
                    reviewId={review._id}
                    t={t}
                    className="mt-3"
                  />
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title={t("review.reviews")}
            description={t("review.noReviewsHint")}
            compact
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewsList;

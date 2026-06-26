import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/formatters";
import SentimentBadge from "./SentimentBadge";

const StarRating = ({ rating }) => {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={t("review.ratingStars", { count: rating })}
      role="img"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={
            index < rating ? "text-amber-400" : "text-muted-foreground/30"
          }
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
};

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

              return (
                <article
                  key={review._id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{guestName}</p>
                      <StarRating rating={review.rating} />
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.createdAt, i18n.language)}
                      </p>
                    </div>
                    <SentimentBadge sentiment={review.sentiment} />
                  </div>

                  <p className="mt-3 text-sm leading-relaxed">{review.text}</p>

                  {review.summary ? (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      {review.summary}
                    </p>
                  ) : null}

                  {review.aspects?.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.aspects.map((aspect) => (
                        <Badge key={aspect} variant="outline">
                          {aspect}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title={t("propertyDetail.noReviews")}
            description={t("review.noReviewsHint")}
            className="border-none bg-transparent shadow-none"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewsList;

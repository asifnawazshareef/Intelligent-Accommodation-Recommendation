import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SentimentBadge from "./SentimentBadge";

const StarRating = ({ rating }) => (
  <div className="flex items-center gap-0.5" aria-label={`${rating} stars`}>
    {Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`size-4 ${
          index < rating
            ? "fill-amber-400 text-amber-400"
            : "text-muted-foreground/30"
        }`}
      />
    ))}
  </div>
);

const ReviewsList = ({ reviews = [] }) => {
  const { t } = useTranslation();

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
                        {new Date(review.createdAt).toLocaleDateString()}
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
                        <Badge
                          key={aspect}
                          variant="outline"
                          className="capitalize"
                        >
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
          <p className="text-sm text-muted-foreground">
            {t("propertyDetail.noReviews")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewsList;

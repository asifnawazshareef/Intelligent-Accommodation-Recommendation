import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Star, ThumbsUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import { formatPrice } from "@/lib/formatters";
import { getAspectLabel } from "@/lib/sentimentInsights";
import { getListingVerificationBadge } from "@/lib/imageVerification";
import { cn } from "@/lib/utils";

const sentimentClass = (percent) => {
  if (percent >= 60) {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (percent >= 40) {
    return "text-amber-600 dark:text-amber-400";
  }

  return "text-muted-foreground";
};

const RecommendedPropertyCard = ({ property }) => {
  const { t } = useTranslation();
  const coverUrl = property.images?.[0]?.url;
  const matchReasons = Array.isArray(property.matchReasons)
    ? property.matchReasons
    : [];
  const primaryReason = matchReasons[0];
  const sentiment = property.sentimentSummary;
  const praisedAspect = sentiment?.topPraisedAspect;
  const positivePercent = sentiment?.positivePercent || 0;
  const hasReviews = (property.reviewCount || 0) > 0;
  const verificationStatus = getListingVerificationBadge(property.images);

  const reasonLabel = (reason) => {
    if (reason === "praised_sentiment" && praisedAspect) {
      return t("search.matchReason.praised_sentiment", {
        aspect: getAspectLabel(praisedAspect, t),
      });
    }

    return t(`search.matchReason.${reason}`, {
      defaultValue: t("search.matchReason.recommended_for_you"),
    });
  };

  return (
    <Link to={`/properties/${property._id}`} className="group block h-full">
      <Card className="glass-card flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative">
          <PropertyCoverImage
            src={coverUrl}
            alt={property.title}
            imageClassName="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              {primaryReason ? (
                <Badge
                  variant="secondary"
                  className="max-w-full truncate border-0 bg-background/90 text-xs font-normal shadow-sm backdrop-blur-sm"
                >
                  {reasonLabel(primaryReason)}
                </Badge>
              ) : null}
              {verificationStatus ? (
                <ImageVerificationBadge
                  status={verificationStatus}
                  variant="overlay"
                  compact
                />
              ) : null}
            </div>
            {property.avgRating ? (
              <Badge
                variant="secondary"
                className="shrink-0 gap-1 border-0 bg-background/90 shadow-sm backdrop-blur-sm"
              >
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-semibold" dir="ltr">
                  {property.avgRating}
                </span>
              </Badge>
            ) : null}
          </div>
        </div>

        <CardHeader className="space-y-2 px-4 pb-0 pt-4">
          <CardTitle className="line-clamp-2 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
            {property.title}
          </CardTitle>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 opacity-70" />
            <span className="truncate">
              {property.location?.city}, {property.location?.country}
            </span>
          </p>
        </CardHeader>

        <CardContent className="mt-auto flex flex-col gap-3 px-4 pb-4 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-primary" dir="ltr">
                {formatPrice(property.price, t("common.currency"))}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("search.perNight")}
              </p>
            </div>

            {hasReviews ? (
              <div className="text-end text-xs">
                <p className="text-muted-foreground">
                  {t("search.reviewCount", { count: property.reviewCount })}
                </p>
                <p
                  className={cn(
                    "mt-0.5 inline-flex items-center justify-end gap-1 font-medium",
                    sentimentClass(positivePercent),
                  )}
                >
                  <ThumbsUp className="size-3" />
                  <span dir="ltr">
                    {t("search.positiveReviewPercent", {
                      percent: positivePercent,
                    })}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("search.noReviewsYet")}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <span className="text-sm font-medium text-primary transition-colors group-hover:underline">
              {t("search.viewAndBook")}
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default RecommendedPropertyCard;

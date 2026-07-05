import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ThumbsUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import PropertyCoverBadges from "@/components/properties/PropertyCoverBadges";
import { formatPrice } from "@/lib/formatters";
import { getAspectLabel, sentimentToneClass } from "@/lib/sentimentInsights";
import { cn } from "@/lib/utils";

const PropertyListingCard = ({ property, variant = "search" }) => {
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
  const isRecommended = variant === "recommended";

  const reasonLabel = primaryReason
    ? primaryReason === "praised_sentiment" && praisedAspect
      ? t("search.matchReason.praised_sentiment", {
          aspect: getAspectLabel(praisedAspect, t),
        })
      : t(`search.matchReason.${primaryReason}`, {
          defaultValue: t("search.matchReason.recommended_for_you"),
        })
    : null;

  const sentimentClass =
    positivePercent >= 60
      ? "text-emerald-600 dark:text-emerald-400"
      : positivePercent >= 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <Link to={`/properties/${property._id}`} className="group block h-full">
      <Card
        className={cn(
          "glass-card flex h-full flex-col overflow-hidden transition-all",
          isRecommended
            ? "duration-200 hover:-translate-y-1 hover:shadow-lg"
            : "hover:-translate-y-0.5 hover:shadow-md",
        )}
      >
        <div className="relative">
          <PropertyCoverImage
            src={coverUrl}
            alt={property.title}
            imageClassName={cn(
              "transition-transform",
              isRecommended
                ? "duration-500 group-hover:scale-105"
                : "duration-300 group-hover:scale-[1.02]",
            )}
          />
          <PropertyCoverBadges
            images={property.images}
            matchReasonLabel={reasonLabel}
            avgRating={property.avgRating}
          />
        </div>

        <CardHeader className={cn("pb-2", isRecommended && "space-y-2 px-4 pb-0 pt-4")}>
          <CardTitle
            className={cn(
              "line-clamp-2 transition-colors group-hover:text-primary",
              isRecommended
                ? "text-base font-semibold leading-snug"
                : "text-base",
            )}
          >
            {property.title}
          </CardTitle>
          <CardDescription
            className={cn(
              isRecommended && "flex items-center gap-1 text-sm text-muted-foreground",
            )}
          >
            {isRecommended ? (
              <MapPin className="size-3.5 shrink-0 opacity-70" />
            ) : null}
            <span className="truncate">
              {property.location?.city}, {property.location?.country}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent
          className={cn(
            "mt-auto space-y-3 pb-4",
            isRecommended && "flex flex-col gap-3 px-4 pb-4 pt-3",
          )}
        >
          {isRecommended ? (
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
                      sentimentClass,
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
          ) : (
            <>
              <div>
                <p className="text-lg font-semibold text-primary" dir="ltr">
                  {formatPrice(property.price, t("common.currency"))}
                </p>
                {hasReviews && (
                  <p className="text-xs text-muted-foreground">
                    {t("search.reviewCount", { count: property.reviewCount })}
                  </p>
                )}
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {property.description}
              </p>
            </>
          )}

          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium text-primary group-hover:underline",
              isRecommended &&
                "justify-between gap-2 border-t border-border/60 pt-3 group-hover:no-underline",
            )}
          >
            <span>{t("search.viewAndBook")}</span>
            {isRecommended ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            ) : (
              <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default PropertyListingCard;

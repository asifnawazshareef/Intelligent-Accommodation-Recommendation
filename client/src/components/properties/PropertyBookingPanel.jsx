import { ArrowRight, CalendarRange, MapPin, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import ActionLink from "@/components/ui/action-link";
import StarRatingDisplay from "@/components/reviews/StarRatingDisplay";
import PropertyInsightStrip from "@/components/properties/PropertyInsightStrip";
import { formatPrice } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PropertyBookingPanel = ({
  property,
  summary,
  makeBookingPath,
  offlineBookingPath,
  onViewSentiment,
  className,
}) => {
  const { t } = useTranslation();
  const hasSentiment = (summary?.totalReviews || 0) > 0;

  return (
    <Card className={cn("overflow-hidden border-border/60", className)}>
      <CardHeader className="space-y-3 border-b border-border/60 pb-4">
        <CardTitle className="line-clamp-2 text-xl leading-snug">
          {property.title}
        </CardTitle>
        {property.location && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {property.location.city}, {property.location.country}
            </span>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        <div>
          <p className="text-3xl font-bold tracking-tight text-primary" dir="ltr">
            {formatPrice(property.price, t("common.currency"))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("bookingPage.pricePerStay")}
          </p>
        </div>

        <StarRatingDisplay
          rating={summary?.averageRating}
          reviewCountLabel={t("search.reviewCount", {
            count: summary?.totalReviews || 0,
          })}
          size="lg"
          showEmptyHint
          emptyHint={t("propertyDetail.noReviewsYet")}
        />

        {hasSentiment && <PropertyInsightStrip summary={summary} compact />}

        <div className="flex flex-col gap-2.5">
          <ActionLink to={makeBookingPath} size="lg" className="h-11 w-full gap-2">
            <CalendarRange className="size-4 shrink-0" />
            {t("propertyDetail.selectDatesBook")}
            <ArrowRight className="size-4 shrink-0" />
          </ActionLink>
          <ActionLink
            to={offlineBookingPath}
            variant="outline"
            size="lg"
            className="h-11 w-full"
          >
            {t("offline.contactOwner")}
          </ActionLink>
        </div>

        {hasSentiment && onViewSentiment && (
          <button
            type="button"
            onClick={onViewSentiment}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            <MessageSquare className="size-4 shrink-0" />
            {t("propertyDetail.viewFullSentiment")}
          </button>
        )}
      </CardContent>
    </Card>
  );
};

export default PropertyBookingPanel;

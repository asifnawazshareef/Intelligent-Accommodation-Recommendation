import {
  ArrowRight,
  CalendarRange,
  CreditCard,
  MapPin,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ActionLink from "@/components/ui/action-link";
import StarRatingDisplay from "@/components/reviews/StarRatingDisplay";
import PropertyInsightStrip from "@/components/properties/PropertyInsightStrip";
import { formatPrice } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BookingStep = ({ step, label, active }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {step}
    </span>
    <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  </div>
);

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
    <Card className={cn("glass-card overflow-hidden border-border/60 shadow-md", className)}>
      <CardHeader className="space-y-3 border-b border-border/60 bg-gradient-to-br from-muted/20 to-primary/5 pb-4">
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

        {hasSentiment && (
          <PropertyInsightStrip summary={summary} compact />
        )}

        {/* <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
            {t("propertyDetail.howToBook")}
          </p>
          <div className="flex items-center gap-1">
            <BookingStep step={1} label={t("bookingPage.stepDates")} active />
            <div className="h-px flex-1 bg-border/80" aria-hidden="true" />
            <BookingStep step={2} label={t("bookingPage.stepPayment")} active={false} />
            <div className="h-px flex-1 bg-border/80" aria-hidden="true" />
            <BookingStep step={3} label={t("review.reviews")} active={false} />
          </div>
        </div> */}

        <div className="flex flex-col gap-2.5">
          <ActionLink to={makeBookingPath} size="lg" className="h-11 w-full gap-2 shadow-sm">
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-800 transition-colors hover:bg-violet-500/15 dark:text-violet-300"
          >
            <Sparkles className="size-4 shrink-0" />
            {t("propertyDetail.viewFullSentiment")}
          </button>
        )}

        {/* <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
          <span className="inline-flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-2 py-2">
            <CalendarRange className="size-3.5 text-primary" />
            {t("bookingPage.stepDates")}
          </span>
          <span className="inline-flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-2 py-2">
            <CreditCard className="size-3.5 text-primary" />
            {t("booking.payment")}
          </span>
          <span className="inline-flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-2 py-2">
            <MessageSquarePlus className="size-3.5 text-primary" />
            {t("review.reviews")}
          </span>
        </div> */}
      </CardContent>
    </Card>
  );
};

export default PropertyBookingPanel;

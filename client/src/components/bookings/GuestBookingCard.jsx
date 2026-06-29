import {
  CalendarRange,
  CreditCard,
  MapPin,
  MessageSquarePlus,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import ReviewSubmittedBanner from "@/components/reviews/ReviewSubmittedBanner";
import ActionLink from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/lib/formatters";
import { getGuestDisplayImages } from "@/lib/imageVerification";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const todayValue = () => new Date().toISOString().slice(0, 10);

const GuestBookingCard = ({ booking }) => {
  const { t, i18n } = useTranslation();
  const property = booking.property;
  const displayImages = getGuestDisplayImages(property?.images);
  const coverUrl = displayImages[0]?.url || property?.images?.[0]?.url;
  const coverVerification = displayImages[0]?.verificationStatus;

  const needsPayment =
    booking.paymentStatus === "pending" && booking.status !== "cancelled";
  const canReview =
    booking.status === "confirmed" &&
    booking.paymentStatus === "confirmed" &&
    !booking.hasReview;
  const isReviewed = Boolean(booking.hasReview);
  const isCancelled = booking.status === "cancelled";

  const stayTiming = useMemo(() => {
    const today = todayValue();
    if (booking.endDate < today) return "past";
    if (booking.startDate > today) return "upcoming";
    return "active";
  }, [booking.endDate, booking.startDate]);

  const nights = useMemo(() => {
    const start = new Date(`${booking.startDate}T00:00:00`);
    const end = new Date(`${booking.endDate}T00:00:00`);
    const count = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return count > 0 ? count : 0;
  }, [booking.endDate, booking.startDate]);

  const primaryActionCount =
    Number(needsPayment) + Number(canReview) + 1;

  return (
    <Card
      className={cn(
        "glass-card group flex flex-col overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        canReview && "ring-1 ring-primary/25",
        isReviewed && "border-emerald-500/25",
        needsPayment && "ring-1 ring-amber-500/30",
        isCancelled && "opacity-75",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <PropertyCoverImage
          src={coverUrl}
          alt={property?.title}
          className="absolute inset-0 aspect-auto h-full w-full rounded-none border-0"
          imageClassName="transition-transform duration-700 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {stayTiming === "upcoming" && (
              <Badge className="border-0 bg-primary/90 text-white shadow-sm hover:bg-primary/90">
                {t("bookingPage.upcomingStay")}
              </Badge>
            )}
            {stayTiming === "active" && (
              <Badge className="border-0 bg-sky-500/90 text-white shadow-sm hover:bg-sky-500/90">
                {t("bookingPage.activeStay")}
              </Badge>
            )}
            {stayTiming === "past" && !isReviewed && canReview && (
              <Badge className="border-0 bg-violet-500/90 text-white shadow-sm hover:bg-violet-500/90">
                {t("bookingPage.reviewPending")}
              </Badge>
            )}
            {needsPayment && (
              <Badge className="border-0 bg-amber-500/90 text-white shadow-sm hover:bg-amber-500/90">
                {t("booking.paymentPending")}
              </Badge>
            )}
            {isReviewed && (
              <Badge className="border-0 bg-emerald-500/90 text-white shadow-sm hover:bg-emerald-500/90">
                {t("review.reviewSubmittedBadge")}
              </Badge>
            )}
          </div>

          {!isCancelled && booking.paymentStatus === "confirmed" && !needsPayment && (
            <Badge
              variant="secondary"
              className="shrink-0 border-0 bg-white/15 text-white backdrop-blur-sm hover:bg-white/15"
            >
              {t("booking.paymentConfirmed")}
            </Badge>
          )}
        </div>

        {coverVerification === "verified" && (
          <div className="absolute end-3 bottom-[4.25rem] z-10 sm:bottom-[4.75rem]">
            <ImageVerificationBadge
              status="verified"
              variant="overlay"
              compact
            />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 space-y-1 p-3 pt-8 text-white">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug sm:text-lg">
            {property?.title || t("booking.booking")}
          </h3>
          {property?.location && (
            <p className="flex items-center gap-1.5 text-xs text-white/80 sm:text-sm">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {property.location.city}, {property.location.country}
              </span>
            </p>
          )}
        </div>
      </div>

      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarRange className="size-3" />
              {t("bookingPage.staySummary")}
            </p>
            <p dir="ltr" className="mt-1 text-xs font-medium sm:text-sm">
              {formatDate(booking.startDate, i18n.language)} –{" "}
              {formatDate(booking.endDate, i18n.language)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("bookingPage.totalPaid")}
            </p>
            <p dir="ltr" className="mt-1 text-sm font-bold text-primary sm:text-base">
              {formatPrice(
                booking.totalAmount ?? property?.price,
                t("common.currency"),
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {nights > 0 && (
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="size-3.5 text-primary" />
              {t("bookingPage.nightsCount", { count: nights })}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5 text-primary" />
            {t("bookingPage.guestCount", { count: booking.guests })}
          </span>
        </div>

        {isReviewed && (
          <ReviewSubmittedBanner
            propertyId={property?._id}
            variant="compact"
          />
        )}

        {canReview && !isReviewed && (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t("bookingPage.reviewInviteHint")}
          </p>
        )}
      </CardContent>

      <CardFooter className="grid gap-2 border-t border-border/60 bg-muted/10 p-3 sm:p-4">
        <div
          className={cn(
            "grid gap-2",
            primaryActionCount > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <ActionLink
            to={`/properties/${property?._id}`}
            variant="outline"
            className="h-9 w-full text-sm"
          >
            {t("common.viewDetails")}
          </ActionLink>

          {needsPayment && (
            <ActionLink
              to={`/bookings/payment/${booking._id}`}
              className="h-9 w-full gap-1.5 text-sm shadow-sm"
            >
              <CreditCard className="size-3.5 shrink-0" />
              {t("bookingPage.payShort")}
            </ActionLink>
          )}

          {canReview && !needsPayment && (
            <ActionLink
              to={`/properties/${property?._id}#reviews`}
              className="h-9 w-full gap-1.5 text-sm shadow-sm"
            >
              <MessageSquarePlus className="size-3.5 shrink-0" />
              {t("review.leaveReview")}
            </ActionLink>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default GuestBookingCard;

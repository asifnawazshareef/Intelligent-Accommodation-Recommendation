import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  ImageOff,
  Loader2,
  MapPin,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import PageLoader from "@/components/layout/PageLoader";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewsList from "@/components/reviews/ReviewsList";
import SentimentSummary from "@/components/reviews/SentimentSummary";
import { formatDate, formatPrice } from "@/lib/formatters";
import { getPropertyById } from "@/services/propertyService";
import {
  getPropertyReviews,
  getPropertySentimentSummary,
} from "@/services/reviewService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const PropertyImageGallery = ({ images = [], title }) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState("loading");

  const activeImage = images[activeIndex];

  useEffect(() => {
    setStatus("loading");
  }, [activeIndex, activeImage?.url]);

  if (!images.length) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30">
        <Building2 className="size-12 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border/60 bg-muted/30">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="size-8" />
            <span className="text-sm">{t("propertyDetail.imageError")}</span>
          </div>
        )}
        <img
          src={activeImage.url}
          alt={title}
          className={cn(
            "h-full w-full object-cover",
            status === "loaded" ? "block" : "hidden",
          )}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
        {activeImage?.verificationStatus && (
          <div className="absolute start-3 top-3">
            <ImageVerificationBadge status={activeImage.verificationStatus} />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image._id || index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:size-20",
                activeIndex === index
                  ? "border-primary"
                  : "border-transparent opacity-80 hover:opacity-100",
              )}
            >
              <img
                src={image.url}
                alt={`${title} ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PropertyDetailPage = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();

  const [property, setProperty] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const makeBookingPath = !isAuthenticated
    ? `/login?from=${encodeURIComponent(`/bookings/new/${id}`)}`
    : user?.role === "guest"
      ? `/bookings/new/${id}`
      : `/login?from=${encodeURIComponent(`/bookings/new/${id}`)}`;

  const offlineBookingPath = `/offline-booking?propertyId=${id}`;

  useEffect(() => {
    const fetchPropertyDetails = async () => {
      setLoading(true);
      setError("");

      try {
        const propertyResponse = await getPropertyById(id);
        const propertyData = propertyResponse.data.data;

        if (propertyData.status !== "approved") {
          setError(t("propertyDetail.notAvailable"));
          setProperty(null);
          return;
        }

        setProperty(propertyData);

        const [reviewsResponse, summaryResponse] = await Promise.all([
          getPropertyReviews(id),
          getPropertySentimentSummary(id),
        ]);

        setReviews(reviewsResponse.data.data || []);
        setSummary(summaryResponse.data.data || null);
      } catch (err) {
        setProperty(null);
        setError(err.response?.data?.message || t("propertyDetail.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [id, t]);

  if (loading) {
    return <PageLoader message={t("propertyDetail.loading")} />;
  }

  if (error || !property) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Alert variant="destructive">
          <AlertTitle>{t("propertyDetail.errorTitle")}</AlertTitle>
          <AlertDescription>{error || t("propertyDetail.notFound")}</AlertDescription>
        </Alert>
        <Link to="/search" className="mt-6 inline-block">
          <Button variant="outline">
            <ArrowLeft className="size-4" />
            {t("propertyDetail.backToSearch")}
          </Button>
        </Link>
      </div>
    );
  }

  const showSentiment = summary && summary.totalReviews > 0;
  const canLeaveReview = isAuthenticated && user?.role === "guest";

  const refreshReviewData = async () => {
    try {
      const [reviewsResponse, summaryResponse] = await Promise.all([
        getPropertyReviews(id),
        getPropertySentimentSummary(id),
      ]);
      setReviews(reviewsResponse.data.data || []);
      setSummary(summaryResponse.data.data || null);
    } catch {
      // Keep existing data on refresh failure
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link to="/search" className="mb-6 inline-flex">
        <Button variant="ghost" size="sm" className="whitespace-normal">
          <ArrowLeft className="size-4" />
          {t("propertyDetail.backToSearch")}
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <PropertyImageGallery images={property.images} title={property.title} />

          <div className="space-y-3 lg:hidden">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {property.title}
            </h1>
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>
                {property.location?.address}
                <br />
                {property.location?.city}, {property.location?.country}
              </span>
            </p>
            <p className="text-2xl font-bold text-primary" dir="ltr">
              {formatPrice(property.price, t("common.currency"))}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("property.description")}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {property.description}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MapPin className="size-5" />
              {t("property.locationSection")}
            </h2>
            <Card className="glass-card border-border/60">
              <CardContent className="space-y-1 pt-6 text-sm">
                <p>{property.location?.address}</p>
                <p className="text-muted-foreground">
                  {property.location?.city}, {property.location?.country}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarRange className="size-5" />
              {t("property.availability")}
            </h2>
            {property.availabilityCalendar?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {property.availabilityCalendar.map((range, index) => (
                  <Badge key={`${range.startDate}-${index}`} variant="outline">
                    {formatDate(range.startDate, i18n.language)} –{" "}
                    {formatDate(range.endDate, i18n.language)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("propertyDetail.noAvailability")}
              </p>
            )}
          </section>

          <section id="reviews" className="space-y-4 scroll-mt-24">
            {showSentiment && <SentimentSummary summary={summary} />}

            {canLeaveReview && (
              <ReviewForm
                propertyId={id}
                onReviewCreated={refreshReviewData}
              />
            )}

            <ReviewsList reviews={reviews} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="glass-card border-border/60">
            <CardHeader className="hidden lg:block">
              <CardTitle className="line-clamp-2 text-xl">{property.title}</CardTitle>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  {property.location?.city}, {property.location?.country}
                </span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="hidden lg:block">
                <p className="text-3xl font-bold text-primary" dir="ltr">
                  {formatPrice(property.price, t("common.currency"))}
                </p>
                {summary?.averageRating > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    <span dir="ltr">{summary.averageRating}</span>
                    <span>
                      ({t("search.reviewCount", { count: summary.totalReviews })})
                    </span>
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full whitespace-normal" asChild>
                  <Link to={makeBookingPath}>{t("property.makeBooking")}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full whitespace-normal"
                  asChild
                >
                  <Link to={offlineBookingPath}>
                    {t("offline.offlineBookingRequest")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 p-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">
          <Button variant="outline" className="flex-1 whitespace-normal" asChild>
            <Link to={offlineBookingPath}>{t("offline.offlineBookingRequest")}</Link>
          </Button>
          <Button className="flex-1 whitespace-normal" asChild>
            <Link to={makeBookingPath}>{t("property.makeBooking")}</Link>
          </Button>
        </div>
      </div>

      <div className="h-20 lg:hidden" aria-hidden="true" />
    </div>
  );
};

export default PropertyDetailPage;

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import PageLoader from "@/components/layout/PageLoader";
import ActionLink from "@/components/ui/action-link";
import PropertyBookingPanel from "@/components/properties/PropertyBookingPanel";
import PropertyImageGallery from "@/components/properties/PropertyImageGallery";
import PropertySentimentSnapshot from "@/components/properties/PropertySentimentSnapshot";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewsList from "@/components/reviews/ReviewsList";
import SentimentSummary from "@/components/reviews/SentimentSummary";
import StarRatingDisplay from "@/components/reviews/StarRatingDisplay";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatPrice } from "@/lib/formatters";
import { getGuestDisplayImages } from "@/lib/imageVerification";
import { getPropertyById, trackPropertyView } from "@/services/propertyService";
import {
  getPropertyReviews,
  getPropertySentimentSummary,
} from "@/services/reviewService";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const SECTION_IDS = ["about", "location", "availability", "reviews"];

const SectionNav = ({ sections, activeId, onSelect }) => (
  <nav
    className="sticky top-[4.5rem] z-20 -mx-1 flex gap-2 overflow-x-auto border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] sm:top-20 [&::-webkit-scrollbar]:hidden"
    aria-label="Property sections"
  >
    {sections.map((section) => (
      <button
        key={section.id}
        type="button"
        onClick={() => onSelect(section.id)}
        className={cn(
          "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
          activeId === section.id
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
      >
        {section.label}
      </button>
    ))}
  </nav>
);

const PropertyDetailPage = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();

  const [property, setProperty] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("about");

  const makeBookingPath = !isAuthenticated
    ? `/login?from=${encodeURIComponent(`/bookings/new/${id}`)}`
    : user?.role === "guest"
      ? `/bookings/new/${id}`
      : `/login?from=${encodeURIComponent(`/bookings/new/${id}`)}`;

  const offlineBookingPath = !isAuthenticated
    ? `/login?from=${encodeURIComponent(`/offline-booking?propertyId=${id}`)}`
    : user?.role === "guest"
      ? `/offline-booking?propertyId=${id}`
      : `/login?from=${encodeURIComponent(`/offline-booking?propertyId=${id}`)}`;

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

        if (isAuthenticated && user?.role === "guest") {
          trackPropertyView(id).catch(() => {});
        }

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
  }, [id, t, isAuthenticated, user?.role]);

  useEffect(() => {
    const observers = SECTION_IDS.map((sectionId) => {
      const element = document.getElementById(sectionId);
      if (!element) return null;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(sectionId);
          }
        },
        { rootMargin: "-30% 0px -55% 0px", threshold: 0.1 },
      );

      observer.observe(element);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, [property]);

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (loading) {
    return <PageLoader message={t("propertyDetail.loading")} />;
  }

  if (error || !property) {
    return (
      <div className="site-container py-16">
        <Alert variant="destructive">
          <AlertTitle>{t("propertyDetail.errorTitle")}</AlertTitle>
          <AlertDescription>{error || t("propertyDetail.notFound")}</AlertDescription>
        </Alert>
        <ActionLink to="/search" variant="outline" className="mt-6">
          <ArrowLeft className="size-4 shrink-0" />
          {t("propertyDetail.backToSearch")}
        </ActionLink>
      </div>
    );
  }

  const showSentiment = summary && summary.totalReviews > 0;
  const canLeaveReview = isAuthenticated && user?.role === "guest";
  const displayImages = getGuestDisplayImages(property.images);

  const sections = [
    { id: "about", label: t("property.description") },
    { id: "location", label: t("property.locationSection") },
    { id: "availability", label: t("property.availability") },
    { id: "reviews", label: t("review.reviews") },
  ];

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
    <div className="site-container py-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/search"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" />
          {t("propertyDetail.backToSearch")}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">
        <div className="min-w-0 space-y-5">
          <PropertyImageGallery images={displayImages} title={property.title} />

          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5 lg:hidden">
            <h1 className="text-2xl font-bold tracking-tight">{property.title}</h1>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {property.location?.city}, {property.location?.country}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-2xl font-bold text-primary" dir="ltr">
                {formatPrice(property.price, t("common.currency"))}
              </p>
              {summary?.averageRating > 0 && (
                <StarRatingDisplay
                  rating={summary.averageRating}
                  reviewCountLabel={t("search.reviewCount", {
                    count: summary.totalReviews || 0,
                  })}
                  size="lg"
                />
              )}
            </div>
          </div>

          {showSentiment && (
            <PropertySentimentSnapshot
              summary={summary}
              onViewReviews={() => scrollToSection("reviews")}
              className="lg:hidden"
            />
          )}

          <SectionNav
            sections={sections}
            activeId={activeSection}
            onSelect={scrollToSection}
          />

          <section id="about" className="scroll-mt-28 space-y-4">
            <h2 className="text-lg font-semibold">{t("property.description")}</h2>
            <Card className="glass-card border-border/60">
              <CardContent className="space-y-4 pt-6">
                <p className="leading-relaxed text-muted-foreground">
                  {property.description || t("propertyDetail.noDescription")}
                </p>
              </CardContent>
            </Card>
          </section>

          <section id="location" className="scroll-mt-28 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MapPin className="size-5 text-primary" />
              {t("property.locationSection")}
            </h2>
            <Card className="glass-card border-border/60">
              <CardContent className="space-y-2 pt-6 text-sm">
                <p className="font-medium">{property.location?.address}</p>
                <p className="text-muted-foreground">
                  {property.location?.city}, {property.location?.country}
                </p>
              </CardContent>
            </Card>
          </section>

          <section id="availability" className="scroll-mt-28 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarRange className="size-5 text-primary" />
              {t("property.availability")}
            </h2>
            {property.availabilityCalendar?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {property.availabilityCalendar.map((range, index) => (
                  <Badge
                    key={`${range.startDate}-${index}`}
                    variant="outline"
                    className="rounded-lg px-3 py-1.5 text-sm"
                  >
                    {formatDate(range.startDate, i18n.language)} –{" "}
                    {formatDate(range.endDate, i18n.language)}
                  </Badge>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title={t("propertyDetail.noAvailability")}
              />
            )}
          </section>

          <section id="reviews" className="scroll-mt-28 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MessageSquare className="size-5 text-primary" />
                {t("review.reviews")}
              </h2>
              {summary?.totalReviews > 0 && (
                <Badge variant="secondary">
                  {t("propertyDetail.sentimentPowered")}
                </Badge>
              )}
            </div>

            {showSentiment && <SentimentSummary summary={summary} />}

            {!showSentiment && (
              <EmptyState
                compact
                title={t("propertyDetail.noReviews")}
                description={t("review.noReviewsHint")}
              />
            )}

            {canLeaveReview && (
              <ReviewForm propertyId={id} onReviewCreated={refreshReviewData} />
            )}

            <ReviewsList reviews={reviews} />
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <PropertyBookingPanel
              property={property}
              summary={summary}
              makeBookingPath={makeBookingPath}
              offlineBookingPath={offlineBookingPath}
              onViewSentiment={
                showSentiment ? () => scrollToSection("reviews") : undefined
              }
            />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md lg:hidden">
        <div className="site-container flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{property.title}</p>
            <p className="text-lg font-bold text-primary" dir="ltr">
              {formatPrice(property.price, t("common.currency"))}
            </p>
          </div>
          <ActionLink to={makeBookingPath} className="h-11 shrink-0 gap-1.5 px-5">
            {t("propertyDetail.selectDatesBook")}
            <ArrowRight className="size-4 shrink-0" />
          </ActionLink>
        </div>
      </div>

      <div className="h-20 lg:hidden" aria-hidden="true" />
    </div>
  );
};

export default PropertyDetailPage;

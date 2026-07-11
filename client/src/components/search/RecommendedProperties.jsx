import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import RecommendedPropertyCard from "@/components/search/RecommendedPropertyCard";
import { getRecommendations } from "@/services/searchService";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ActionLink from "@/components/ui/action-link";

import EmptyState from "@/components/ui/EmptyState";

const DISPLAY_LIMIT = 24;

const CardSkeleton = () => (
  <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
    <Skeleton className="aspect-video w-full rounded-none" />
    <div className="space-y-3 p-4">
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  </div>
);

const SectionSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-7 w-64" />
    <div className="property-grid">
      {[1, 2, 3, 4].map((item) => (
        <CardSkeleton key={item} />
      ))}
    </div>
  </div>
);

const RecommendedProperties = ({
  city = "",
  minPrice = "",
  maxPrice = "",
  price = "",
  availabilityDate = "",
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError("");

      try {
        const params = { limit: DISPLAY_LIMIT };
        if (city?.trim()) params.city = city.trim();
        if (minPrice) params.minPrice = minPrice;
        if (maxPrice) params.maxPrice = maxPrice;
        if (price) params.price = price;
        if (availabilityDate?.trim()) {
          params.availabilityDate = availabilityDate.trim();
        }

        const response = await getRecommendations(params);
        const responseSections = response.data.sections || [];
        const responseItems = (response.data.data || []).slice(0, DISPLAY_LIMIT);

        setSections(responseSections);
        setItems(responseItems);
        setPersonalized(Boolean(response.data.profileSignals?.personalized));
      } catch (err) {
        setError(
          err.response?.data?.message || t("search.recommendationsError"),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [city, minPrice, maxPrice, price, availabilityDate, t, user?._id]);

  if (loading) {
    return (
      <section className="space-y-10">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const hasSectionedLayout = sections.length > 0;
  const isEmpty = hasSectionedLayout
    ? sections.every((section) => !section.items?.length)
    : items.length === 0;

  if (isEmpty) {
    return (
      <section className="space-y-6">
        <header className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Compass className="size-5 text-primary" />
          </span>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t("search.recommendedTitle")}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t("search.recommendedEmptyHint")}
            </p>
          </div>
        </header>

        <EmptyState
          title={t("search.recommendedEmptyTitle")}
          description={t("search.recommendedEmptyHint")}
        />
      </section>
    );
  }

  const hint = !user
    ? t("search.recommendedHintGuest")
    : personalized
      ? t("search.recommendedHintPersonalized")
      : t("search.recommendedHintColdStart");

  return (
    <section className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Compass className="size-5 text-primary" />
          </span>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t("search.recommendedTitle")}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {hint}
            </p>
          </div>
        </div>

        {!user ? (
          <ActionLink
            to="/login"
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-center"
          >
            {t("common.signIn")}
          </ActionLink>
        ) : null}
      </header>

      {hasSectionedLayout ? (
        sections.map((section) =>
          section.items?.length ? (
            <div key={section.id} className="space-y-5">
              <h3 className="text-lg font-semibold tracking-tight sm:text-xl">
                {t(section.titleKey)}
              </h3>
              <div className="property-grid gap-5">
                {section.items.map((property) => (
                  <RecommendedPropertyCard
                    key={property._id}
                    property={property}
                  />
                ))}
              </div>
            </div>
          ) : null,
        )
      ) : (
        <div className="property-grid gap-5">
          {items.map((property) => (
            <RecommendedPropertyCard key={property._id} property={property} />
          ))}
        </div>
      )}
    </section>
  );
};

export default RecommendedProperties;

import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import RecommendedPropertyCard from "@/components/search/RecommendedPropertyCard";
import { getRecommendations } from "@/services/searchService";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ActionLink from "@/components/ui/action-link";

const DISPLAY_LIMIT = 6;

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

const RecommendedProperties = ({ city = "", price = "" }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
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
        if (price) params.price = price;

        const response = await getRecommendations(params);
        setItems((response.data.data || []).slice(0, DISPLAY_LIMIT));
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
  }, [city, price, t, user?._id]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="property-grid">
          {[1, 2, 3].map((item) => (
            <CardSkeleton key={item} />
          ))}
        </div>
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

  if (items.length === 0) {
    return null;
  }

  const hint = !user
    ? t("search.recommendedHintGuest")
    : personalized
      ? t("search.recommendedHintPersonalized")
      : t("search.recommendedHint");

  return (
    <section className="space-y-6">
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

      <div className="property-grid gap-5">
        {items.map((property) => (
          <RecommendedPropertyCard key={property._id} property={property} />
        ))}
      </div>
    </section>
  );
};

export default RecommendedProperties;

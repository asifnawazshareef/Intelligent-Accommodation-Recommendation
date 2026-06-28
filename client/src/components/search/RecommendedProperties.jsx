import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropertySearchCard from "@/components/search/PropertySearchCard";
import { getRecommendations } from "@/services/searchService";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const RecommendationSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3].map((item) => (
      <Skeleton key={item} className="aspect-[4/3] w-full rounded-xl" />
    ))}
  </div>
);

const RecommendedProperties = ({ city = "", price = "" }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ engine: "", personalized: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError("");

      try {
        const params = {};
        if (city?.trim()) params.city = city.trim();
        if (price) params.price = price;

        const response = await getRecommendations(params);
        setItems(response.data.data || []);
        setMeta({
          engine: response.data.engine || "",
          personalized: Boolean(response.data.personalized),
        });
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
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-xl font-semibold sm:text-2xl">
            {t("search.recommendedTitle")}
          </h2>
        </div>
        <RecommendationSkeleton />
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

  const hint = user
    ? t("search.recommendedHint")
    : t("search.recommendedHintGuest");

  return (
    <section className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-xl font-semibold sm:text-2xl">
            {t("search.recommendedTitle")}
          </h2>
          {meta.engine && meta.engine !== "fallback" ? (
            <Badge variant="secondary" className="text-xs">
              {t("search.recommendedEngine", { engine: meta.engine })}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((property) => (
          <PropertySearchCard key={property._id} property={property} />
        ))}
      </div>
    </section>
  );
};

export default RecommendedProperties;

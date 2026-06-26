import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import PropertySearchForm, {
  emptySearchValues,
} from "@/components/search/PropertySearchForm";
import PropertySearchCard from "@/components/search/PropertySearchCard";
import RecommendedProperties from "@/components/search/RecommendedProperties";
import { searchProperties } from "@/services/searchService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user, getDashboardPath, loading } = useAuth();
  const [searchValues, setSearchValues] = useState(emptySearchValues);
  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    const loadFeatured = async () => {
      setFeaturedLoading(true);

      try {
        const response = await searchProperties({});
        setFeatured((response.data.data || []).slice(0, 6));
      } catch {
        setFeatured([]);
      } finally {
        setFeaturedLoading(false);
      }
    };

    loadFeatured();
  }, []);

  const handleSearch = (values) => {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value?.toString().trim()) {
        params.set(key, value.toString().trim());
      }
    });

    navigate(params.size ? `/search?${params.toString()}` : "/search");
  };

  const features = useMemo(
    () => [
      {
        icon: Building2,
        title: t("home.featureListingsTitle"),
        description: t("home.featureListingsDesc"),
      },
      {
        icon: Search,
        title: t("home.featureSearchTitle"),
        description: t("home.featureSearchDesc"),
      },
      {
        icon: Sparkles,
        title: t("home.featureSentimentTitle"),
        description: t("home.featureSentimentDesc"),
      },
      {
        icon: ShieldCheck,
        title: t("home.featureAdminTitle"),
        description: t("home.featureAdminDesc"),
      },
    ],
    [t],
  );

  const workflow = useMemo(
    () => [
      t("home.workflowStep1"),
      t("home.workflowStep2"),
      t("home.workflowStep3"),
      t("home.workflowStep4"),
      t("home.workflowStep5"),
      t("home.workflowStep6"),
    ],
    [t],
  );

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Sparkles className="size-4 shrink-0" />
              {t("home.heroBadge")}
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t("home.heroTitle")}{" "}
              <span className="text-primary">{t("home.heroTitleHighlight")}</span>
            </h1>

            <p className="max-w-xl text-lg text-muted-foreground">
              {t("home.heroDescription")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {!loading && isAuthenticated ? (
                <Link to={getDashboardPath(user.role)}>
                  <Button size="lg" className="w-full min-w-fit whitespace-normal sm:w-auto">
                    {t("common.goToDashboard")}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg" className="w-full min-w-fit whitespace-normal sm:w-auto">
                      {t("common.getStarted")}
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full min-w-fit whitespace-normal sm:w-auto"
                    >
                      {t("common.signIn")}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground sm:gap-6">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4 shrink-0 text-primary" />
                {t("home.guestOwnerRoles")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BarChart3 className="size-4 shrink-0 text-primary" />
                {t("home.sentimentInsights")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-4 shrink-0 text-primary" />
                {t("home.trustedReviews")}
              </span>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <h2 className="mb-4 text-lg font-semibold">{t("home.mainWorkflow")}</h2>
            <ol className="space-y-3">
              {workflow.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-start text-muted-foreground">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/20 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("search.homeSearchTitle")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("search.homeSearchHint")}
            </p>
          </div>

          <PropertySearchForm
            values={searchValues}
            onChange={setSearchValues}
            onSubmit={handleSearch}
            compact
          />

          <div className="mt-4 text-end">
            <Link to="/search">
              <Button variant="link" className="px-0">
                {t("search.viewAllResults")}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t("search.featuredTitle")}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {t("search.featuredHint")}
            </p>
          </div>

          {featuredLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="aspect-[4/3] w-full rounded-xl" />
              ))}
            </div>
          )}

          {!featuredLoading && featured.length === 0 && (
            <Card className="glass-card border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t("search.featuredEmpty")}
              </CardContent>
            </Card>
          )}

          {!featuredLoading && featured.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((property) => (
                <PropertySearchCard key={property._id} property={property} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/20 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <RecommendedProperties
            city={searchValues.city}
            price={searchValues.maxPrice || searchValues.minPrice}
          />
        </div>
      </section>

      <section className="border-t border-border/60 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">
              {t("home.featuresTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("home.featuresDescription")}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <Card key={feature.title} className="glass-card border-border/60">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="overflow-hidden border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-2xl font-bold">{t("home.ctaTitle")}</h3>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  {t("home.ctaDescription")}
                </p>
              </div>
              <Link to="/register">
                <Button size="lg" className="min-w-fit whitespace-normal">
                  {t("common.createAccount")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
};

export default HomePage;

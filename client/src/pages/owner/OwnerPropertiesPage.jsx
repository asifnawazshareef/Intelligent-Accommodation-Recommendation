import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PropertyStatusBadge from "@/components/properties/PropertyStatusBadge";
import ImageVerificationSummary from "@/components/imageAudit/ImageVerificationSummary";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import { formatPrice } from "@/lib/formatters";
import { summarizeImageVerification } from "@/lib/imageVerification";
import { getMyProperties } from "@/services/propertyService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const PropertyCardSkeleton = () => (
  <Card className="glass-card overflow-hidden">
    <Skeleton className="aspect-video w-full rounded-none" />
    <CardHeader className="space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-4 w-full" />
    </CardContent>
  </Card>
);

const OwnerPropertiesPage = () => {
  const { t } = useTranslation();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getMyProperties();
        setProperties(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || t("property.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [t]);

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("property.myPropertiesTitle")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("property.myPropertiesHint")}
            </p>
          </div>
          <Link to="/owner/properties/new">
            <Button className="w-full min-w-fit whitespace-normal sm:w-auto">
              <Plus className="size-4" />
              {t("property.createProperty")}
            </Button>
          </Link>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("property.loadError")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="property-grid">
            {[1, 2, 3].map((item) => (
              <PropertyCardSkeleton key={item} />
            ))}
          </div>
        )}

        {!loading && !error && properties.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="size-7" />
              </div>
              <div className="max-w-md space-y-2">
                <h2 className="text-lg font-semibold">
                  {t("property.noPropertiesFound")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("property.emptyStateHint")}
                </p>
              </div>
              <Link to="/owner/properties/new">
                <Button>
                  <Plus className="size-4" />
                  {t("property.createProperty")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!loading && properties.length > 0 && (
          <div className="property-grid">
            {properties.map((property) => {
              const coverImage = property.images?.[0];
              const coverUrl = coverImage?.url;
              const imageSummary = summarizeImageVerification(property.images);
              const hasPendingImages = imageSummary.pending > 0;
              const hasRejectedImages = imageSummary.rejected > 0;

              return (
                <Card
                  key={property._id}
                  className="glass-card flex flex-col overflow-hidden"
                >
                  <div className="relative">
                    <PropertyCoverImage src={coverUrl} alt={property.title} />
                    <div className="absolute start-3 top-3 z-20 flex flex-col gap-1.5">
                      <PropertyStatusBadge status={property.status} />
                      {coverImage?.verificationStatus && (
                        <ImageVerificationBadge
                          status={coverImage.verificationStatus}
                          variant="overlay"
                          compact={
                            coverImage.verificationStatus === "verified"
                          }
                        />
                      )}
                    </div>
                  </div>

                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-base">
                      {property.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {property.location?.city}, {property.location?.country}
                      </span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3 pb-2">
                    <p className="text-lg font-semibold text-primary" dir="ltr">
                      {formatPrice(property.price, t("common.currency"))}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {property.description}
                    </p>

                    {property.status === "pending" && (
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {t("property.waitingForApproval")}
                      </p>
                    )}

                    {hasPendingImages && (
                      <p className="text-sm text-muted-foreground">
                        {t("property.imagesUnderReview")}
                      </p>
                    )}

                    {hasRejectedImages && (
                      <p className="text-sm text-destructive">
                        {t("property.hasRejectedImages")}
                      </p>
                    )}

                    {imageSummary.total > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("property.imageVerificationSummary")}
                        </p>
                        <ImageVerificationSummary
                          images={property.images}
                          compact
                        />
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="border-t border-border/60 pt-4">
                    <Link to={`/owner/properties/${property._id}/edit`} className="w-full">
                      <Button variant="outline" className="w-full whitespace-normal">
                        <Pencil className="size-4" />
                        {t("property.editProperty")}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OwnerPropertiesPage;

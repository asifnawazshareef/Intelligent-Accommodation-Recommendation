import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import { formatPrice } from "@/lib/formatters";
import { getListingVerificationBadge } from "@/lib/imageVerification";

const PropertySearchCard = ({ property }) => {
  const { t } = useTranslation();
  const coverUrl = property.images?.[0]?.url;
  const matchReasons = Array.isArray(property.matchReasons)
    ? property.matchReasons
    : [];
  const primaryReason = matchReasons[0];
  const verificationStatus = getListingVerificationBadge(property.images);

  return (
    <Link to={`/properties/${property._id}`} className="group block h-full">
      <Card className="glass-card flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative">
          <PropertyCoverImage
            src={coverUrl}
            alt={property.title}
            imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {property.avgRating ? (
            <Badge
              variant="secondary"
              className="absolute end-3 top-3 z-20 gap-1 bg-background/90 backdrop-blur-sm"
            >
              <span className="text-amber-400">★</span>
              <span dir="ltr">{property.avgRating}</span>
            </Badge>
          ) : null}
          {primaryReason ? (
            <Badge
              variant="outline"
              className="absolute start-3 top-3 z-20 max-w-[calc(100%-1.5rem)] truncate bg-background/90 backdrop-blur-sm"
            >
              {t(`search.matchReason.${primaryReason}`, {
                defaultValue: t("search.matchReason.recommended_for_you"),
              })}
            </Badge>
          ) : null}
          {verificationStatus ? (
            <div
              className={
                primaryReason
                  ? "absolute start-3 top-12 z-20"
                  : "absolute start-3 top-3 z-20"
              }
            >
              <ImageVerificationBadge
                status={verificationStatus}
                variant="overlay"
                compact
              />
            </div>
          ) : null}
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="line-clamp-2 text-base transition-colors group-hover:text-primary">
            {property.title}
          </CardTitle>
          <CardDescription className="flex items-center gap-1">
            <span className="truncate">
              {property.location?.city}, {property.location?.country}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-auto space-y-3 pb-4">
          <div>
            <p className="text-lg font-semibold text-primary" dir="ltr">
              {formatPrice(property.price, t("common.currency"))}
            </p>
            {property.reviewCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("search.reviewCount", { count: property.reviewCount })}
              </p>
            )}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {property.description}
          </p>
          <p className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
            {t("search.viewAndBook")}
            <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
};

export default PropertySearchCard;

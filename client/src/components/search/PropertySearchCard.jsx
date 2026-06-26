import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import { formatPrice } from "@/lib/formatters";

const PropertySearchCard = ({ property }) => {
  const { t } = useTranslation();
  const coverUrl = property.images?.[0]?.url;

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

        <CardContent className="mt-auto space-y-2 pb-4">
          <p className="text-lg font-semibold text-primary" dir="ltr">
            {formatPrice(property.price, t("common.currency"))}
          </p>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {property.description}
          </p>
          {property.reviewCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("search.reviewCount", { count: property.reviewCount })}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default PropertySearchCard;

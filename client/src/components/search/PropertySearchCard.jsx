import { Link } from "react-router-dom";
import { Building2, MapPin, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PropertySearchCard = ({ property }) => {
  const { t } = useTranslation();
  const coverUrl = property.images?.[0]?.url;

  return (
    <Link to={`/properties/${property._id}`} className="block h-full">
      <Card className="glass-card flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-video bg-muted/40">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={property.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Building2 className="size-10 opacity-40" />
          </div>
        )}
        {property.avgRating && (
          <Badge
            variant="secondary"
            className="absolute end-3 top-3 gap-1 bg-background/90"
          >
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span dir="ltr">{property.avgRating}</span>
          </Badge>
        )}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-2 text-base">{property.title}</CardTitle>
        <CardDescription className="flex items-center gap-1">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {property.location?.city}, {property.location?.country}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="mt-auto space-y-2 pb-4">
        <p className="text-lg font-semibold text-primary" dir="ltr">
          {property.price?.toLocaleString()} PKR
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

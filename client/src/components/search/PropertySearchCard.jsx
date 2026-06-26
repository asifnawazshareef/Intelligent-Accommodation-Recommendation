import { useState } from "react";
import { Building2, ImageOff, Loader2 } from "lucide-react";
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
import { formatPrice } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const PropertySearchCard = ({ property }) => {
  const { t, i18n } = useTranslation();
  const coverUrl = property.images?.[0]?.url;
  const [imageStatus, setImageStatus] = useState(coverUrl ? "loading" : "empty");

  return (
    <Link to={`/properties/${property._id}`} className="group block h-full">
      <Card className="glass-card flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-video overflow-hidden bg-muted/40">
          {coverUrl && imageStatus === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {coverUrl && imageStatus === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageOff className="size-6" />
              <span className="text-xs">{t("common.imageLoadError")}</span>
            </div>
          )}
          {!coverUrl || imageStatus === "empty" ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Building2 className="size-10 opacity-40" />
            </div>
          ) : null}
          {coverUrl && imageStatus !== "error" && imageStatus !== "empty" ? (
            <img
              src={coverUrl}
              alt={property.title}
              className={cn(
                "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]",
                imageStatus === "loaded" ? "block" : "hidden",
              )}
              loading="lazy"
              onLoad={() => setImageStatus("loaded")}
              onError={() => setImageStatus("error")}
            />
          ) : null}
          {property.avgRating ? (
            <Badge
              variant="secondary"
              className="absolute end-3 top-3 gap-1 bg-background/90 backdrop-blur-sm"
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

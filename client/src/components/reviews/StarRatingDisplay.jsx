import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const StarRatingDisplay = ({
  rating = 0,
  reviewCount,
  reviewCountLabel,
  size = "sm",
  className,
  showEmptyHint = false,
  emptyHint,
}) => {
  if (!rating || rating <= 0) {
    if (!showEmptyHint) {
      return null;
    }

    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyHint}
      </p>
    );
  }

  const iconSize = size === "lg" ? "size-4" : "size-3.5";
  const valueClass = size === "lg" ? "text-sm font-semibold" : "text-xs font-semibold";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        <Star className={cn(iconSize, "fill-amber-400 text-amber-400")} />
        <span className={valueClass} dir="ltr">
          {rating}
        </span>
      </div>
      {reviewCountLabel ? (
        <span className="text-sm text-muted-foreground">{reviewCountLabel}</span>
      ) : reviewCount != null ? (
        <span className="text-sm text-muted-foreground" dir="ltr">
          ({reviewCount})
        </span>
      ) : null}
    </div>
  );
};

/** Text star row for review cards */
export const StarRatingRow = ({ rating = 0, className }) => (
  <p
    className={cn("flex items-center gap-0.5 text-amber-400", className)}
    dir="ltr"
    aria-hidden="true"
  >
    {"★".repeat(Math.min(5, Math.max(0, Math.round(rating))))}
    {"☆".repeat(Math.max(0, 5 - Math.round(rating)))}
  </p>
);

export default StarRatingDisplay;

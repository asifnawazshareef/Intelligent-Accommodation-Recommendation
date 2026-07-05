import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import {
  getListingVerificationBadge,
  getVerifiedImages,
} from "@/lib/imageVerification";
import { cn } from "@/lib/utils";

/**
 * Consistent overlay badges for property cover images.
 * mode: public (verified only) | owner (all statuses on cover image)
 */
const PropertyCoverBadges = ({
  images = [],
  coverStatus,
  matchReasonLabel,
  avgRating,
  mode = "public",
  className,
}) => {
  const verificationStatus =
    mode === "owner"
      ? coverStatus
      : getListingVerificationBadge(images);

  const showVerification =
    mode === "owner"
      ? Boolean(coverStatus)
      : Boolean(verificationStatus);

  const hasTopStart = Boolean(matchReasonLabel) || showVerification;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {matchReasonLabel ? (
          <Badge
            variant="secondary"
            className="max-w-full truncate border-0 bg-background/90 text-xs font-normal shadow-sm backdrop-blur-sm"
          >
            {matchReasonLabel}
          </Badge>
        ) : null}
        {showVerification ? (
          <ImageVerificationBadge
            status={verificationStatus}
            variant="overlay"
            compact={verificationStatus === "verified"}
          />
        ) : null}
      </div>

      {avgRating ? (
        <Badge
          variant="secondary"
          className="shrink-0 gap-1 border-0 bg-background/90 shadow-sm backdrop-blur-sm"
        >
          <Star className="size-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-semibold" dir="ltr">
            {avgRating}
          </span>
        </Badge>
      ) : hasTopStart ? (
        <span className="size-0" aria-hidden="true" />
      ) : null}
    </div>
  );
};

export const getOwnerCoverStatus = (images = []) => {
  const cover = images?.[0];
  if (cover?.verificationStatus) {
    return cover.verificationStatus;
  }
  const verified = getVerifiedImages(images);
  return verified[0]?.verificationStatus || null;
};

export default PropertyCoverBadges;

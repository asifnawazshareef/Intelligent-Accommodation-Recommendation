import { BadgeCheck, Camera, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { summarizeImageVerification } from "@/lib/imageVerification";
import { cn } from "@/lib/utils";

const TrustPill = ({ icon: Icon, label, tone = "default" }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
      tone === "emerald" &&
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      tone === "primary" &&
        "border-primary/30 bg-primary/10 text-primary",
      tone === "violet" &&
        "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300",
      tone === "default" &&
        "border-border/60 bg-muted/30 text-muted-foreground",
    )}
  >
    <Icon className="size-3.5 shrink-0" />
    {label}
  </span>
);

const PropertyTrustStrip = ({ property, reviewCount = 0, className }) => {
  const { t } = useTranslation();
  const imageStats = summarizeImageVerification(property?.images);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <TrustPill
        icon={ShieldCheck}
        label={t("propertyDetail.adminApproved")}
        tone="emerald"
      />
      {imageStats.verified > 0 && (
        <TrustPill
          icon={Camera}
          label={t("propertyDetail.verifiedPhotos", { count: imageStats.verified })}
          tone="primary"
        />
      )}
      {reviewCount > 0 && (
        <TrustPill
          icon={Sparkles}
          label={t("propertyDetail.sentimentAnalyzed")}
          tone="violet"
        />
      )}
      {property?.status === "approved" && (
        <TrustPill
          icon={BadgeCheck}
          label={t("propertyDetail.listingVerified")}
          tone="default"
        />
      )}
    </div>
  );
};

export default PropertyTrustStrip;

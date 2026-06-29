import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { summarizeImageVerification } from "@/lib/imageVerification";

const SummaryBadge = ({ label, count, className }) => {
  if (!count) {
    return null;
  }

  return (
    <Badge variant="outline" className={className}>
      {label}: {count}
    </Badge>
  );
};

const ImageVerificationSummary = ({ images = [], compact = false }) => {
  const { t } = useTranslation();
  const summary = summarizeImageVerification(images);

  if (!summary.total) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("listingModeration.noImages")}
      </p>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <SummaryBadge
          label={t("imageAudit.status.verified")}
          count={summary.verified}
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        />
        <SummaryBadge
          label={t("imageAudit.status.pending")}
          count={summary.pending}
          className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        />
        <SummaryBadge
          label={t("imageAudit.status.suspicious")}
          count={summary.suspicious}
          className="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300"
        />
        <SummaryBadge
          label={t("imageAudit.status.rejected")}
          count={summary.rejected}
          className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">{t("listingModeration.totalImages")}</p>
        <p className="text-lg font-semibold" dir="ltr">{summary.total}</p>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-xs text-muted-foreground">{t("imageAudit.status.verified")}</p>
        <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300" dir="ltr">
          {summary.verified}
        </p>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-xs text-muted-foreground">{t("imageAudit.status.pending")}</p>
        <p className="text-lg font-semibold text-amber-800 dark:text-amber-300" dir="ltr">
          {summary.pending}
        </p>
      </div>
      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
        <p className="text-xs text-muted-foreground">{t("imageAudit.status.suspicious")}</p>
        <p className="text-lg font-semibold text-orange-700 dark:text-orange-300" dir="ltr">
          {summary.suspicious}
        </p>
      </div>
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-xs text-muted-foreground">{t("imageAudit.status.rejected")}</p>
        <p className="text-lg font-semibold text-red-700 dark:text-red-300" dir="ltr">
          {summary.rejected}
        </p>
      </div>
    </div>
  );
};

export default ImageVerificationSummary;

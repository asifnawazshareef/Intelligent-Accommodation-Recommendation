import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  verified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  suspicious: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  rejected: "bg-destructive/15 text-destructive",
};

const statusLabelKeys = {
  pending: "property.pending",
  verified: "admin.verified",
  suspicious: "admin.suspicious",
  rejected: "property.rejected",
};

const ImageVerificationBadge = ({ status, className = "" }) => {
  const { t } = useTranslation();
  const labelKey = statusLabelKeys[status] || status;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "whitespace-normal capitalize",
        statusStyles[status] || "",
        className,
      )}
    >
      {t(labelKey, status)}
    </Badge>
  );
};

export default ImageVerificationBadge;

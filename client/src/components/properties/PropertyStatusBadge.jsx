import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
};

const PropertyStatusBadge = ({ status, className = "" }) => {
  const { t } = useTranslation();
  const labelKey = status && t(`property.${status}`, status);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "whitespace-normal capitalize",
        statusStyles[status] || "",
        className,
      )}
    >
      {labelKey}
    </Badge>
  );
};

export default PropertyStatusBadge;

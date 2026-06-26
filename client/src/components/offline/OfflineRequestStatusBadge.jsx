import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  responded: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

const OfflineRequestStatusBadge = ({ status, className = "" }) => {
  const { t } = useTranslation();
  const labelKey = `offline.${status}`;

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

export default OfflineRequestStatusBadge;

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const sentimentClasses = {
  positive:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15",
  negative: "bg-destructive/15 text-destructive hover:bg-destructive/15",
  neutral: "bg-muted text-muted-foreground hover:bg-muted",
  mixed: "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15",
};

const SentimentBadge = ({ sentiment = "neutral" }) => {
  const { t } = useTranslation();
  const labelKey = `review.${sentiment}`;

  return (
    <Badge
      className={cn(
        "whitespace-normal capitalize",
        sentimentClasses[sentiment] || sentimentClasses.neutral,
      )}
    >
      {t(labelKey, sentiment)}
    </Badge>
  );
};

export default SentimentBadge;

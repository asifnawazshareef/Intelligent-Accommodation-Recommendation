import { Badge } from "@/components/ui/badge";
import { getAspectLabel, sentimentToneClass } from "@/lib/sentimentInsights";
import { cn } from "@/lib/utils";

const AspectInsightBadges = ({ insights = [], reviewId = "review", t, className }) => {
  if (!insights?.length) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {insights.map((item) => (
        <Badge
          key={`${reviewId}-${item.aspect}`}
          variant="outline"
          className={`capitalize ${sentimentToneClass(item.sentiment)}`}
        >
          {getAspectLabel(item.aspect, t)}
        </Badge>
      ))}
    </div>
  );
};

export default AspectInsightBadges;

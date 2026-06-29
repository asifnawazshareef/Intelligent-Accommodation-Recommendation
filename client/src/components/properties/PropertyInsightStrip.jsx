import { AlertTriangle, MessageSquareQuote, Sparkles, ThumbsUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  buildPropertyInsightText,
  getInsightTone,
  insightToneClasses,
} from "@/lib/sentimentInsights";
import { cn } from "@/lib/utils";

const toneIcons = {
  positive: ThumbsUp,
  concern: AlertTriangle,
  mixed: MessageSquareQuote,
  balanced: Sparkles,
  neutral: Sparkles,
};

const PropertyInsightStrip = ({ summary, className, compact = false }) => {
  const { t } = useTranslation();
  const insightText = buildPropertyInsightText(summary, t);

  if (!insightText) {
    return null;
  }

  const tone = getInsightTone(summary);
  const styles = insightToneClasses(tone);
  const Icon = toneIcons[tone] || Sparkles;

  const titleKey = {
    positive: "propertyDetail.insightPositive",
    concern: "propertyDetail.insightConcern",
    mixed: "propertyDetail.insightMixed",
    balanced: "propertyDetail.insightBalanced",
    neutral: "propertyDetail.insightNeutral",
  }[tone];

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
          styles.container,
          className,
        )}
      >
        <Icon className={cn("mt-0.5 size-4 shrink-0", styles.icon)} />
        <p className="text-xs leading-relaxed sm:text-sm">{insightText}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        styles.container,
        className,
      )}
    >
      <p className={cn("flex items-center gap-2 text-sm font-semibold", styles.label)}>
        <Icon className={cn("size-4 shrink-0", styles.icon)} />
        {t(titleKey)}
      </p>
      <p className="mt-2 text-sm leading-relaxed">{insightText}</p>
    </div>
  );
};

export default PropertyInsightStrip;

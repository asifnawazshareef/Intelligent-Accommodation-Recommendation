const formatAspectList = (items, t) =>
  items
    .map(({ aspect }) => t(`review.aspects.${aspect}`, aspect))
    .join(", ");

export const buildPropertyInsightText = (summary, t) => {
  if (!summary || !summary.totalReviews) {
    return "";
  }

  const praised = formatAspectList(summary.praisedAspects || [], t);
  const concerns = formatAspectList(summary.concernAspects || [], t);

  switch (summary.insightType) {
    case "praise_and_concern":
      return t("review.insightPraiseAndConcern", { praised, concerns });
    case "mostly_positive":
      return t("review.insightMostlyPositive", { praised });
    case "mostly_negative":
      return t("review.insightMostlyNegative", { concerns });
    case "neutral_themes":
      return t("review.insightNeutralThemes", {
        themes: formatAspectList(summary.neutralAspects || [], t),
      });
    case "balanced":
      return t("review.insightBalanced");
    default:
      return "";
  }
};

export const getAspectLabel = (aspect, t) =>
  t(`review.aspects.${aspect}`, aspect);

export const sentimentToneClass = (sentiment) => {
  switch (sentiment) {
    case "positive":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "negative":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "mixed":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-border/60 bg-muted/30 text-muted-foreground";
  }
};

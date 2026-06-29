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

export const getInsightTone = (summary) => {
  switch (summary?.insightType) {
    case "mostly_positive":
      return "positive";
    case "mostly_negative":
      return "concern";
    case "praise_and_concern":
      return "mixed";
    case "neutral_themes":
      return "neutral";
    case "balanced":
      return "balanced";
    default:
      return "neutral";
  }
};

export const insightToneClasses = (tone) => {
  switch (tone) {
    case "positive":
      return {
        container:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
        icon: "text-emerald-600 dark:text-emerald-400",
        label: "text-emerald-700 dark:text-emerald-300",
      };
    case "concern":
      return {
        container:
          "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        icon: "text-amber-600 dark:text-amber-400",
        label: "text-amber-800 dark:text-amber-300",
      };
    case "mixed":
      return {
        container:
          "border-violet-500/30 bg-violet-500/10 text-violet-950 dark:text-violet-100",
        icon: "text-violet-600 dark:text-violet-400",
        label: "text-violet-800 dark:text-violet-300",
      };
    case "balanced":
      return {
        container:
          "border-primary/25 bg-primary/5 text-foreground",
        icon: "text-primary",
        label: "text-primary",
      };
    default:
      return {
        container: "border-border/60 bg-muted/25 text-foreground",
        icon: "text-muted-foreground",
        label: "text-muted-foreground",
      };
  }
};

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

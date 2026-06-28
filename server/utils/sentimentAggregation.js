const EMPTY_SENTIMENT = { positive: 0, negative: 0, neutral: 0, mixed: 0, total: 0 };

const normalizeInsights = (review) => {
  if (Array.isArray(review.aspectInsights) && review.aspectInsights.length) {
    return review.aspectInsights;
  }

  const fallbackSentiment = review.sentiment || "neutral";

  return (review.aspects || []).map((aspect) => ({
    aspect,
    sentiment: fallbackSentiment,
  }));
};

export const aggregateAspectSentiments = (reviews) => {
  const aspectMap = {};

  reviews.forEach((review) => {
    normalizeInsights(review).forEach(({ aspect, sentiment }) => {
      if (!aspect) {
        return;
      }

      if (!aspectMap[aspect]) {
        aspectMap[aspect] = { ...EMPTY_SENTIMENT };
      }

      const bucket = aspectMap[aspect];
      bucket[sentiment] = (bucket[sentiment] || 0) + 1;
      bucket.total += 1;
    });
  });

  return aspectMap;
};

const dominantSentiment = (counts) => {
  const entries = ["positive", "negative", "neutral", "mixed"].map((key) => [
    key,
    counts[key] || 0,
  ]);

  entries.sort(([, a], [, b]) => b - a);
  const [topSentiment, topCount] = entries[0];

  if (!topCount) {
    return "neutral";
  }

  return topSentiment;
};

export const buildAspectBreakdown = (aspectMap, limit = 8) =>
  Object.entries(aspectMap)
    .map(([aspect, counts]) => ({
      aspect,
      ...counts,
      dominantSentiment: dominantSentiment(counts),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

export const buildPropertyInsight = (reviews, aspectMap) => {
  if (!reviews.length) {
    return {
      praisedAspects: [],
      concernAspects: [],
      neutralAspects: [],
      insightType: "none",
    };
  }

  const praisedAspects = [];
  const concernAspects = [];
  const neutralAspects = [];

  Object.entries(aspectMap).forEach(([aspect, counts]) => {
    const positive = counts.positive || 0;
    const negative = counts.negative || 0;
    const total = counts.total || 0;

    if (total < 1) {
      return;
    }

    if (positive > negative && positive >= 1) {
      praisedAspects.push({ aspect, count: positive, total });
      return;
    }

    if (negative > positive && negative >= 1) {
      concernAspects.push({ aspect, count: negative, total });
      return;
    }

    neutralAspects.push({ aspect, count: total, total });
  });

  praisedAspects.sort((a, b) => b.count - a.count);
  concernAspects.sort((a, b) => b.count - a.count);
  neutralAspects.sort((a, b) => b.count - a.count);

  let insightType = "balanced";

  if (praisedAspects.length && concernAspects.length) {
    insightType = "praise_and_concern";
  } else if (praisedAspects.length) {
    insightType = "mostly_positive";
  } else if (concernAspects.length) {
    insightType = "mostly_negative";
  } else if (neutralAspects.length) {
    insightType = "neutral_themes";
  }

  return {
    praisedAspects: praisedAspects.slice(0, 4),
    concernAspects: concernAspects.slice(0, 4),
    neutralAspects: neutralAspects.slice(0, 4),
    insightType,
  };
};

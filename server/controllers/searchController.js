import Property from "../models/Property.js";
import Review from "../models/Review.js";
import SearchHistory from "../models/SearchHistory.js";

const MAX_SEARCH_HISTORY = 20;

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const attachReviewStats = async (properties) => {
  if (!properties.length) {
    return [];
  }

  const ids = properties.map((property) => property._id);
  const stats = await Review.aggregate([
    { $match: { property: { $in: ids } } },
    {
      $group: {
        _id: "$property",
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const statsMap = new Map(
    stats.map((item) => [item._id.toString(), item]),
  );

  return properties.map((property) => {
    const propertyStats = statsMap.get(property._id.toString());

    return {
      ...property,
      avgRating: propertyStats?.avgRating
        ? Number(propertyStats.avgRating.toFixed(1))
        : null,
      reviewCount: propertyStats?.reviewCount || 0,
    };
  });
};

const saveSearchHistory = async (user, params) => {
  if (!user) {
    return;
  }

  const { city, title, minPrice, maxPrice, availabilityDate } = params;
  const hasCriteria =
    city?.trim() ||
    title?.trim() ||
    minPrice !== null ||
    maxPrice !== null ||
    availabilityDate?.trim();

  if (!hasCriteria) {
    return;
  }

  await SearchHistory.create({
    user: user._id,
    city: city?.trim() || "",
    title: title?.trim() || "",
    minPrice,
    maxPrice,
    availabilityDate: availabilityDate?.trim() || "",
  });

  const total = await SearchHistory.countDocuments({ user: user._id });

  if (total > MAX_SEARCH_HISTORY) {
    const excess = total - MAX_SEARCH_HISTORY;
    const oldestEntries = await SearchHistory.find({ user: user._id })
      .sort({ createdAt: 1 })
      .limit(excess)
      .select("_id");

    await SearchHistory.deleteMany({
      _id: { $in: oldestEntries.map((entry) => entry._id) },
    });
  }
};

const buildApprovedSearchFilter = (query) => {
  const city = query.city?.trim();
  const title = query.title?.trim();
  const minPrice = parseNumber(query.minPrice);
  const maxPrice = parseNumber(query.maxPrice);
  const availabilityDate = query.availabilityDate?.trim();

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    const error = new Error("minPrice cannot be greater than maxPrice");
    error.statusCode = 400;
    throw error;
  }

  const filter = { status: "approved" };

  if (city) {
    filter["location.city"] = { $regex: city, $options: "i" };
  }

  if (title) {
    filter.title = { $regex: title, $options: "i" };
  }

  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = minPrice;
    if (maxPrice !== null) filter.price.$lte = maxPrice;
  }

  if (availabilityDate) {
    filter.availabilityCalendar = {
      $elemMatch: {
        startDate: { $lte: availabilityDate },
        endDate: { $gte: availabilityDate },
      },
    };
  }

  return {
    filter,
    params: { city, title, minPrice, maxPrice, availabilityDate },
  };
};

export const searchProperties = async (req, res, next) => {
  try {
    const { filter, params } = buildApprovedSearchFilter(req.query);

    const properties = await Property.find(filter)
      .populate("owner", "name")
      .sort({ createdAt: -1 })
      .lean();

    const data = await attachReviewStats(properties);

    await saveSearchHistory(req.user, params);

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }
    next(error);
  }
};

const scoreProperty = (property, context, ratingMap) => {
  let score = 0;
  const stats = ratingMap.get(property._id.toString());

  if (
    context.city &&
    property.location?.city?.toLowerCase() === context.city.toLowerCase()
  ) {
    score += 3;
  }

  if (context.price) {
    const difference = Math.abs(property.price - context.price) / context.price;
    if (difference <= 0.2) score += 2;
    else if (difference <= 0.4) score += 1;
  }

  if (stats?.avgRating >= 4) {
    score += 2;
  } else if (stats?.avgRating >= 3) {
    score += 1;
  }

  if (stats?.reviewCount > 0) {
    score += 0.5;
  }

  return score;
};

export const getRecommendations = async (req, res, next) => {
  try {
    const queryCity = req.query.city?.trim();
    const queryPrice = parseNumber(req.query.price);

    let contextCity = queryCity || "";
    let contextPrice = queryPrice;

    if (req.user && (!contextCity || !contextPrice)) {
      const lastSearch = await SearchHistory.findOne({ user: req.user._id })
        .sort({ createdAt: -1 })
        .lean();

      if (lastSearch) {
        if (!contextCity && lastSearch.city) {
          contextCity = lastSearch.city;
        }

        if (!contextPrice) {
          contextPrice =
            lastSearch.maxPrice ?? lastSearch.minPrice ?? null;
        }
      }
    }

    const properties = await Property.find({ status: "approved" })
      .populate("owner", "name")
      .lean();

    const stats = await Review.aggregate([
      {
        $group: {
          _id: "$property",
          avgRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const ratingMap = new Map(stats.map((item) => [item._id.toString(), item]));

    const context = {
      city: contextCity,
      price: contextPrice,
    };

    const scored = properties
      .map((property) => {
        const propertyStats = ratingMap.get(property._id.toString());
        const recommendationScore = scoreProperty(
          property,
          context,
          ratingMap,
        );

        return {
          ...property,
          avgRating: propertyStats?.avgRating
            ? Number(propertyStats.avgRating.toFixed(1))
            : null,
          reviewCount: propertyStats?.reviewCount || 0,
          recommendationScore,
        };
      })
      .filter((property) => property.recommendationScore > 0)
      .sort((a, b) => {
        if (b.recommendationScore !== a.recommendationScore) {
          return b.recommendationScore - a.recommendationScore;
        }

        return (b.avgRating || 0) - (a.avgRating || 0);
      });

    let recommendations = scored.slice(0, 6);

    if (recommendations.length === 0) {
      recommendations = properties
        .map((property) => {
          const propertyStats = ratingMap.get(property._id.toString());

          return {
            ...property,
            avgRating: propertyStats?.avgRating
              ? Number(propertyStats.avgRating.toFixed(1))
              : null,
            reviewCount: propertyStats?.reviewCount || 0,
            recommendationScore: propertyStats?.avgRating || 0,
          };
        })
        .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
        .slice(0, 6);
    }

    res.json({
      success: true,
      count: recommendations.length,
      context,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

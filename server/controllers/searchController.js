import Property from "../models/Property.js";
import Review from "../models/Review.js";
import SearchHistory from "../models/SearchHistory.js";
import {
  buildUserRecommendationProfile,
  getGlobalBookingCounts,
} from "../utils/buildUserProfile.js";
import { filterGuestImages } from "../utils/imageVerification.js";
import {
  attachSentimentSummaries,
  buildProfileSignals,
  enrichMatchReasons,
  rankRecommendedProperties,
} from "../utils/recommendationEnrichment.js";

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
    const plain =
      typeof property.toObject === "function" ? property.toObject() : property;

    return {
      ...plain,
      images: filterGuestImages(plain.images || []),
      avgRating: propertyStats?.avgRating
        ? Number(propertyStats.avgRating.toFixed(1))
        : null,
      reviewCount: propertyStats?.reviewCount || 0,
    };
  });
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

  const MAX_SEARCH_HISTORY = 20;
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

const finalizeRecommendations = (recommendations) =>
  recommendations.map((property) => ({
    ...property,
    images: filterGuestImages(property.images || []),
    matchReasons: enrichMatchReasons(property, property.matchReasons || []),
  }));

export const getRecommendations = async (req, res, next) => {
  try {
    const queryCity = req.query.city?.trim();
    const queryPrice = parseNumber(req.query.price);
    const availabilityDate = req.query.availabilityDate?.trim() || null;
    const limit = Math.min(parseNumber(req.query.limit) || 6, 12);

    const [userProfile, globalBookingCounts, properties] = await Promise.all([
      buildUserRecommendationProfile(req.user?._id, {
        city: queryCity,
        price: queryPrice,
      }),
      getGlobalBookingCounts(),
      Property.find({ status: "approved" }).populate("owner", "name").lean(),
    ]);

    const enrichedProperties = await attachReviewStats(properties);
    const propertiesWithSentiment = await attachSentimentSummaries(
      enrichedProperties,
    );

    const context = {
      city: queryCity || userProfile.preferredCities[0] || "",
      price: queryPrice ?? userProfile.preferredPrice ?? null,
      availabilityDate,
    };

    const profileSignals = buildProfileSignals(userProfile, Boolean(req.user));

    const recommendations = rankRecommendedProperties({
      properties: propertiesWithSentiment,
      userProfile,
      context,
      isPersonalized: profileSignals.personalized,
      globalBookingCounts,
      limit,
    });

    const data = finalizeRecommendations(recommendations);

    res.json({
      success: true,
      count: data.length,
      engine: "hybrid-sentiment-ranker",
      personalized: profileSignals.personalized,
      profileSignals,
      context,
      data,
    });
  } catch (error) {
    next(error);
  }
};

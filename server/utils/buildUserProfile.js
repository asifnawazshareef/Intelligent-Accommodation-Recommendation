import Booking from "../models/Booking.js";
import Property from "../models/Property.js";
import PropertyView from "../models/PropertyView.js";
import Review from "../models/Review.js";
import SearchHistory from "../models/SearchHistory.js";
import User from "../models/User.js";
import {
  extractAmenitySet,
  inferPropertyType,
} from "./propertySimilarity.js";

const RECENCY_DECAY = [1, 0.72, 0.52, 0.38, 0.28];
const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const average = (values) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const todayDateValue = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date(),
  );

const getUpcomingBookingPropertyIds = (bookings = []) => {
  const today = todayDateValue();

  return [
    ...new Set(
      bookings
        .filter((booking) => {
          if (!["confirmed", "pending"].includes(booking.status)) {
            return false;
          }

          const endDate = booking.endDate?.trim();
          return Boolean(endDate && endDate >= today);
        })
        .map((booking) => booking.property?._id?.toString())
        .filter(Boolean),
    ),
  ];
};

const buildInteractionEntries = (propertyMap, bookings, reviews, views) => {
  const entries = [];

  bookings.forEach((booking) => {
    const propertyId = booking.property?._id?.toString();
    const property = propertyMap.get(propertyId);
    if (!property) return;
    entries.push({ propertyId, source: "booking", weight: 1, property });
  });

  reviews
    .filter((review) => (review.rating || 0) >= 4)
    .forEach((review) => {
      const propertyId = review.property?.toString();
      const property = propertyMap.get(propertyId);
      if (!property) return;
      entries.push({ propertyId, source: "review", weight: 0.85, property });
    });

  views.forEach((view, index) => {
    const propertyId = view.property?.toString();
    const property = propertyMap.get(propertyId);
    if (!property) return;
    const recencyBoost = Math.max(0.35, 1 - index * 0.03);
    entries.push({
      propertyId,
      source: "view",
      weight: 0.55 * recencyBoost,
      viewedAt: view.viewedAt,
      property,
    });
  });

  const deduped = new Map();
  entries.forEach((entry) => {
    const existing = deduped.get(entry.propertyId);
    if (!existing || entry.weight > existing.weight) {
      deduped.set(entry.propertyId, entry);
    }
  });

  return [...deduped.values()].sort((a, b) => b.weight - a.weight);
};

const buildWeightedCityList = (cityEntries = []) => {
  const weights = new Map();

  cityEntries.forEach(({ city, index }) => {
    if (!city?.trim()) {
      return;
    }

    const key = city.trim();
    const weight = RECENCY_DECAY[index] ?? 0.2;
    weights.set(key, (weights.get(key) || 0) + weight);
  });

  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([city]) => city);
};

const buildPreferredPropertyTypes = (properties = []) => {
  const typeWeights = new Map();

  properties.forEach((property, index) => {
    if (!property) {
      return;
    }

    const type = inferPropertyType(property.title, property.description);
    const weight = RECENCY_DECAY[index] ?? 0.2;
    typeWeights.set(type, (typeWeights.get(type) || 0) + weight);
  });

  return [...typeWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type)
    .filter((type) => type !== "property");
};

const buildPreferredAmenities = (properties = []) => {
  const amenityWeights = new Map();

  properties.forEach((property, index) => {
    if (!property?.description) {
      return;
    }

    const weight = RECENCY_DECAY[index] ?? 0.2;
    extractAmenitySet(property.description).forEach((amenity) => {
      amenityWeights.set(amenity, (amenityWeights.get(amenity) || 0) + weight);
    });
  });

  return [...amenityWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([amenity]) => amenity);
};

/**
 * Cold-start / anonymous profile.
 * Used when there is no authenticated user_id, so personalization cannot run.
 */
const emptyGuestProfile = (queryCity, queryPrice) => ({
  preferredCities: queryCity ? [queryCity] : [],
  preferredPrice: queryPrice ?? 15000,
  priceMin: queryPrice ? queryPrice * 0.8 : null,
  priceMax: queryPrice ? queryPrice * 1.2 : null,
  bookedCities: [],
  bookedAvgPrice: 0,
  averageBookingPrice: 0,
  bookedCount: 0,
  bookingFrequency: 0,
  reviewCount: 0,
  viewedCount: 0,
  avgRatingGiven: 0,
  preferredSentiment: "neutral",
  sentimentPreference: "neutral",
  languagePref: "en",
  excludePropertyIds: [],
  viewedPropertyIds: [],
  bookedPropertyIds: [],
  likedPropertyIds: [],
  interactions: [],
  recentSearches: [],
  recentViews: [],
  mostViewedPropertyIds: [],
  mostBookedCities: [],
  recentSearchCities: [],
  searchesMatchingLatestBook: [],
  latestBookedCity: "",
  latestSearchCity: queryCity || "",
  latestActivityCity: queryCity || "",
  latestActivitySource: queryCity ? "search" : "",
  latestBudgetMin: queryPrice ? queryPrice * 0.8 : null,
  latestBudgetMax: queryPrice ? queryPrice * 1.2 : null,
  preferredCity: queryCity || "",
  preferredBudget: {
    min: queryPrice ? queryPrice * 0.8 : null,
    max: queryPrice ? queryPrice * 1.2 : null,
    preferred: queryPrice ?? 15000,
  },
  frequentlyViewedCities: queryCity ? [queryCity] : [],
  frequentlyBookedCities: [],
  preferredPropertyTypes: [],
  preferredAmenities: [],
  favouritePropertyIds: [],
  userId: "",
  hasSufficientHistory: false,
});

/**
 * Summarises the guest's review-writing behaviour into a sentiment preference.
 * Positive writers tend to leave high ratings / positive classified reviews.
 */
const deriveSentimentPreference = (reviews = []) => {
  if (!reviews.length) {
    return "neutral";
  }

  const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  reviews.forEach((review) => {
    const key = review.sentiment || "neutral";
    if (counts[key] !== undefined) {
      counts[key] += 1;
    }
  });

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] === 0) {
    const avgRating = average(reviews.map((r) => r.rating).filter(Boolean));
    if (avgRating >= 4) return "positive";
    if (avgRating <= 2.5) return "negative";
    return "neutral";
  }

  return ranked[0][0];
};

/**
 * Bookings per month over the guest's observed booking window.
 * Returns 0 when there is no history (cold start).
 */
const deriveBookingFrequency = (bookings = []) => {
  if (!bookings.length) {
    return 0;
  }

  const timestamps = bookings
    .map((booking) => new Date(booking.createdAt).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (timestamps.length === 1) {
    return 1;
  }

  const spanMs = Math.max(timestamps[timestamps.length - 1] - timestamps[0], 1);
  const spanMonths = Math.max(spanMs / (1000 * 60 * 60 * 24 * 30), 1);
  return Number((bookings.length / spanMonths).toFixed(2));
};

/**
 * Builds a reusable, user_id-scoped recommendation profile.
 *
 * This is the research contribution's personalization input: every authenticated
 * guest's searches, views, bookings, ratings, and reviews are linked through
 * user_id and summarised into preferences that the Personalized Recommendation
 * Layer consumes. Guests with insufficient history receive hasSufficientHistory=false
 * so the engine falls back to Bayesian cold-start ranking.
 */
export const buildUserRecommendationProfile = async (
  userId,
  queryOverrides = {},
) => {
  const queryCity = queryOverrides.city?.trim() || "";
  const queryMinPrice = parseNumber(queryOverrides.minPrice);
  const queryMaxPrice = parseNumber(queryOverrides.maxPrice);
  const queryPrice =
    parseNumber(queryOverrides.price) ?? queryMaxPrice ?? queryMinPrice;

  if (!userId) {
    return emptyGuestProfile(queryCity, queryPrice);
  }

  const [user, searches, bookings, reviews, views] = await Promise.all([
    User.findById(userId).select("languagePref").lean(),
    SearchHistory.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Booking.find({
      guest: userId,
      status: { $in: ["confirmed", "pending"] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: "property",
        select: "title description location price sentimentSnapshot",
      })
      .lean(),
    Review.find({ guest: userId }).select("property rating sentiment").lean(),
    PropertyView.find({ user: userId })
      .sort({ viewedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const preferredCities = [];
  const searchPrices = [];
  let priceMin = null;
  let priceMax = null;

  searches.forEach((entry) => {
    if (entry.city?.trim()) {
      preferredCities.push(entry.city.trim());
    }

    const entryMin = parseNumber(entry.minPrice);
    const entryMax = parseNumber(entry.maxPrice);

    if (entryMin !== null) {
      priceMin = priceMin === null ? entryMin : Math.min(priceMin, entryMin);
      searchPrices.push(entryMin);
    }

    if (entryMax !== null) {
      priceMax = priceMax === null ? entryMax : Math.max(priceMax, entryMax);
      searchPrices.push(entryMax);
    }
  });

  if (queryCity) {
    preferredCities.unshift(queryCity);
  }

  const bookedCities = [];
  const bookedPrices = [];
  const bookedPropertyIds = [];

  bookings.forEach((booking) => {
    const propertyId = booking.property?._id?.toString();
    const city = booking.property?.location?.city;
    const price = parseNumber(booking.property?.price);

    if (propertyId) {
      bookedPropertyIds.push(propertyId);
    }

    if (city?.trim()) {
      bookedCities.push(city.trim());
    }

    if (price !== null) {
      bookedPrices.push(price);
    }
  });

  const reviewRatings = reviews.map((review) => review.rating).filter(Boolean);
  const likedPropertyIds = reviews
    .filter((review) => (review.rating || 0) >= 4)
    .map((review) => review.property?.toString())
    .filter(Boolean);

  const viewedPropertyIds = views
    .map((view) => view.property?.toString())
    .filter(Boolean);

  const interactionPropertyIds = [
    ...new Set([
      ...bookedPropertyIds,
      ...likedPropertyIds,
      ...viewedPropertyIds,
    ]),
  ];

  const propertyDocs = await Property.find({
    _id: { $in: interactionPropertyIds },
    status: "approved",
  })
    .select("title description location price sentimentSnapshot")
    .lean();

  const propertyMap = new Map(
    propertyDocs.map((property) => [property._id.toString(), property]),
  );

  const interactionProperties = [
    ...bookings.map((booking) => booking.property).filter(Boolean),
    ...views
      .map((view) => propertyMap.get(view.property?.toString()))
      .filter(Boolean),
    ...likedPropertyIds
      .map((id) => propertyMap.get(id))
      .filter(Boolean),
  ].slice(0, 10);

  const viewedCityEntries = views.map((view, index) => ({
    city: propertyMap.get(view.property?.toString())?.location?.city,
    index,
  }));
  const bookedCityEntries = bookings.map((booking, index) => ({
    city: booking.property?.location?.city,
    index,
  }));
  const searchCityEntries = searches.map((entry, index) => ({
    city: entry.city,
    index,
  }));

  const frequentlyViewedCities = buildWeightedCityList(viewedCityEntries);
  const frequentlyBookedCities = buildWeightedCityList(bookedCityEntries);
  const preferredPropertyTypes = buildPreferredPropertyTypes(interactionProperties);
  const preferredAmenities = buildPreferredAmenities(interactionProperties);
  const favouritePropertyIds = [...new Set(likedPropertyIds)];
  const preferredSentiment = deriveSentimentPreference(reviews);
  const bookingFrequency = deriveBookingFrequency(bookings);
  const bookedAvgPrice = average(bookedPrices);

  const dedupedInteractions = buildInteractionEntries(
    propertyMap,
    bookings,
    reviews,
    views,
  );

  const excludePropertyIds = getUpcomingBookingPropertyIds(bookings);

  const preferredPrice =
    queryPrice ??
    (bookedPrices.length
      ? bookedAvgPrice
      : searchPrices.length
        ? average(searchPrices)
        : 15000);

  if (queryPrice) {
    priceMin =
      priceMin === null ? queryPrice * 0.8 : Math.min(priceMin, queryPrice * 0.8);
    priceMax =
      priceMax === null ? queryPrice * 1.2 : Math.max(priceMax, queryPrice * 1.2);
  }

  if (queryMinPrice !== null) {
    priceMin = priceMin === null ? queryMinPrice : Math.min(priceMin, queryMinPrice);
  }

  if (queryMaxPrice !== null) {
    priceMax = priceMax === null ? queryMaxPrice : Math.max(priceMax, queryMaxPrice);
  }

  const latestBooking = bookings[0] || null;
  const latestBookedCity = latestBooking?.property?.location?.city?.trim() || "";
  const latestBookedPrice = parseNumber(latestBooking?.property?.price);
  const latestSearch = searches[0] || null;
  const latestSearchCity = latestSearch?.city?.trim() || "";

  let latestActivityCity = "";
  let latestActivitySource = "";

  if (latestSearch && latestBooking) {
    if (new Date(latestSearch.createdAt) >= new Date(latestBooking.createdAt)) {
      latestActivityCity = latestSearchCity;
      latestActivitySource = "search";
    } else {
      latestActivityCity = latestBookedCity;
      latestActivitySource = "booking";
    }
  } else if (latestSearchCity) {
    latestActivityCity = latestSearchCity;
    latestActivitySource = "search";
  } else if (latestBookedCity) {
    latestActivityCity = latestBookedCity;
    latestActivitySource = "booking";
  }

  const recentSearchCities = [
    ...new Set(
      searches.map((entry) => entry.city?.trim()).filter(Boolean),
    ),
  ].slice(0, 5);

  const searchesMatchingLatestBook = latestBookedCity
    ? searches.filter(
        (entry) =>
          entry.city?.trim().toLowerCase() === latestBookedCity.toLowerCase(),
      )
    : [];

  const latestSearchWithPrice = searches.find(
    (entry) => parseNumber(entry.minPrice) !== null || parseNumber(entry.maxPrice) !== null,
  );

  let latestBudgetMin = priceMin;
  let latestBudgetMax = priceMax;

  if (latestSearchWithPrice) {
    latestBudgetMin =
      parseNumber(latestSearchWithPrice.minPrice) ??
      (parseNumber(latestSearchWithPrice.maxPrice)
        ? parseNumber(latestSearchWithPrice.maxPrice) * 0.75
        : null);
    latestBudgetMax =
      parseNumber(latestSearchWithPrice.maxPrice) ??
      (parseNumber(latestSearchWithPrice.minPrice)
        ? parseNumber(latestSearchWithPrice.minPrice) * 1.25
        : null);
  } else if (latestBookedPrice) {
    latestBudgetMin = Math.round(latestBookedPrice * 0.75);
    latestBudgetMax = Math.round(latestBookedPrice * 1.25);
  }

  const preferredCity =
    latestBookedCity ||
    latestSearchCity ||
    buildWeightedCityList([
      ...bookedCityEntries,
      ...searchCityEntries,
      ...viewedCityEntries,
    ])[0] ||
    queryCity ||
    "";

  /**
   * Sufficient history gate for the Personalized Recommendation Layer.
   *
   * Cold start (Bayesian-only) applies until the guest has at least one strong
   * signal (booking / high rating / city search) OR two weaker view signals.
   * This prevents noisy personalization from a single accidental click.
   */
  const hasSufficientHistory =
    bookings.length > 0 ||
    likedPropertyIds.length > 0 ||
    recentSearchCities.length > 0 ||
    views.length >= 2;

  return {
    preferredCities,
    preferredPrice,
    priceMin,
    priceMax,
    preferredBudget: {
      min: latestBudgetMin,
      max: latestBudgetMax,
      preferred: preferredPrice,
    },
    bookedCities,
    bookedAvgPrice,
    averageBookingPrice: bookedAvgPrice,
    bookedCount: bookings.length,
    bookingFrequency,
    reviewCount: reviews.length,
    viewedCount: views.length,
    avgRatingGiven: average(reviewRatings),
    preferredSentiment,
    sentimentPreference: preferredSentiment,
    languagePref: user?.languagePref || "en",
    userId: userId?.toString() || "",
    excludePropertyIds,
    viewedPropertyIds,
    bookedPropertyIds: [...new Set(bookedPropertyIds)],
    likedPropertyIds: [...new Set(likedPropertyIds)],
    interactions: dedupedInteractions,
    recentSearches: searches.slice(0, 5),
    recentViews: views.slice(0, 5).map((view) => ({
      propertyId: view.property?.toString(),
      viewedAt: view.viewedAt,
    })),
    mostViewedPropertyIds: viewedPropertyIds.slice(0, 5),
    mostBookedCities: frequentlyBookedCities.slice(0, 5),
    recentSearchCities,
    searchesMatchingLatestBook: searchesMatchingLatestBook.slice(0, 5),
    latestBookedCity,
    latestSearchCity,
    latestActivityCity,
    latestActivitySource,
    latestBudgetMin,
    latestBudgetMax,
    preferredCity,
    frequentlyViewedCities,
    frequentlyBookedCities,
    preferredPropertyTypes,
    preferredAmenities,
    favouritePropertyIds,
    hasSufficientHistory,
  };
};

export const getGlobalBookingCounts = async () => {
  const counts = await Booking.aggregate([
    {
      $match: {
        status: { $in: ["confirmed", "pending"] },
      },
    },
    {
      $group: {
        _id: "$property",
        count: { $sum: 1 },
      },
    },
  ]);

  return counts.reduce((map, item) => {
    map[item._id.toString()] = item.count;
    return map;
  }, {});
};

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

const emptyGuestProfile = (queryCity, queryPrice) => ({  preferredCities: queryCity ? [queryCity] : [],
  preferredPrice: queryPrice ?? 15000,
  priceMin: queryPrice ? queryPrice * 0.8 : null,
  priceMax: queryPrice ? queryPrice * 1.2 : null,
  bookedCities: [],
  bookedAvgPrice: 0,
  bookedCount: 0,
  reviewCount: 0,
  viewedCount: 0,
  avgRatingGiven: 0,
  languagePref: "en",
  excludePropertyIds: [],
  viewedPropertyIds: [],
  bookedPropertyIds: [],
  likedPropertyIds: [],
  interactions: [],
  recentSearches: [],
  recentViews: [],
  recentSearchCities: [],
  searchesMatchingLatestBook: [],
  latestBookedCity: "",
  latestSearchCity: queryCity || "",
  latestActivityCity: queryCity || "",
  latestActivitySource: queryCity ? "search" : "",
  latestBudgetMin: queryPrice ? queryPrice * 0.8 : null,
  latestBudgetMax: queryPrice ? queryPrice * 1.2 : null,
  preferredCity: queryCity || "",
  frequentlyViewedCities: queryCity ? [queryCity] : [],
  frequentlyBookedCities: [],
  preferredPropertyTypes: [],
  preferredAmenities: [],
  favouritePropertyIds: [],
  userId: "",
});

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
    Review.find({ guest: userId }).select("property rating").lean(),
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
      ? average(bookedPrices)
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

  return {
    preferredCities,
    preferredPrice,
    priceMin,
    priceMax,
    bookedCities,
    bookedAvgPrice: average(bookedPrices),
    bookedCount: bookings.length,
    reviewCount: reviews.length,
    viewedCount: views.length,
    avgRatingGiven: average(reviewRatings),
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

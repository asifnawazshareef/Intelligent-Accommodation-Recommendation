import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import SearchHistory from "../models/SearchHistory.js";
import User from "../models/User.js";

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

export const buildUserRecommendationProfile = async (userId, queryOverrides = {}) => {
  const queryCity = queryOverrides.city?.trim() || "";
  const queryPrice = parseNumber(queryOverrides.price);

  if (!userId) {
    return {
      preferredCities: queryCity ? [queryCity] : [],
      preferredPrice: queryPrice ?? 15000,
      priceMin: queryPrice ? queryPrice * 0.8 : null,
      priceMax: queryPrice ? queryPrice * 1.2 : null,
      bookedCities: [],
      bookedAvgPrice: 0,
      bookedCount: 0,
      avgRatingGiven: 0,
      languagePref: "en",
      excludePropertyIds: [],
    };
  }

  const [user, searches, bookings, reviews] = await Promise.all([
    User.findById(userId).select("languagePref").lean(),
    SearchHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
    Booking.find({
      guest: userId,
      status: { $in: ["confirmed", "pending"] },
    })
      .populate({
        path: "property",
        select: "location price",
      })
      .lean(),
    Review.find({ guest: userId }).select("property rating").lean(),
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

  bookings.forEach((booking) => {
    const city = booking.property?.location?.city;
    const price = parseNumber(booking.property?.price);

    if (city?.trim()) {
      bookedCities.push(city.trim());
    }

    if (price !== null) {
      bookedPrices.push(price);
    }
  });

  const reviewRatings = reviews.map((review) => review.rating).filter(Boolean);
  const excludePropertyIds = getUpcomingBookingPropertyIds(bookings);

  const preferredPrice =
    queryPrice ??
    (bookedPrices.length
      ? average(bookedPrices)
      : searchPrices.length
        ? average(searchPrices)
        : 15000);

  if (queryPrice) {
    priceMin = priceMin === null ? queryPrice * 0.8 : Math.min(priceMin, queryPrice * 0.8);
    priceMax = priceMax === null ? queryPrice * 1.2 : Math.max(priceMax, queryPrice * 1.2);
  }

  return {
    preferredCities,
    preferredPrice,
    priceMin,
    priceMax,
    bookedCities,
    bookedAvgPrice: average(bookedPrices),
    bookedCount: bookings.length,
    avgRatingGiven: average(reviewRatings),
    languagePref: user?.languagePref || "en",
    excludePropertyIds,
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

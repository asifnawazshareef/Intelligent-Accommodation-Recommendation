import axios from "axios";

const DEFAULT_ENGINE = "fallback";

export const getMlRecommendations = async ({
  userProfile,
  properties,
  globalBookingCounts,
  limit = 6,
}) => {
  try {
    const apiUrl =
      process.env.RECOMMENDATION_API_URL || "http://localhost:8001";

    const response = await axios.post(
      `${apiUrl}/recommend`,
      {
        userProfile,
        properties: properties.map((property) => ({
          id: property._id.toString(),
          title: property.title || "",
          city: property.location?.city || "",
          country: property.location?.country || "Pakistan",
          price: Number(property.price) || 0,
          avgRating: property.avgRating ?? null,
          reviewCount: property.reviewCount || 0,
        })),
        limit,
        globalBookingCounts,
      },
      { timeout: 15000 },
    );

    return {
      engine: response.data?.engine || "Gradient Boosting Regressor",
      recommendations: Array.isArray(response.data?.recommendations)
        ? response.data.recommendations
        : [],
    };
  } catch (error) {
    console.error("Recommendation API error:", error.message);
    return {
      engine: DEFAULT_ENGINE,
      recommendations: [],
      error: error.message,
    };
  }
};

export const checkRecommendationHealth = async () => {
  try {
    const apiUrl =
      process.env.RECOMMENDATION_API_URL || "http://localhost:8001";
    const response = await axios.get(`${apiUrl}/health`, { timeout: 5000 });
    return response.data;
  } catch {
    return null;
  }
};

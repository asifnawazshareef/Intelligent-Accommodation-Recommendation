import axios from "axios";

const DEFAULT_SENTIMENT_RESULT = {
  sentiment: "neutral",
  confidence: 0,
  aspects: [],
  aspectInsights: [],
  summary: "Sentiment service unavailable",
};

export const analyzeSentiment = async (text) => {
  try {
    const apiUrl = process.env.SENTIMENT_API_URL || "http://localhost:8000";

    const response = await axios.post(
      `${apiUrl}/predict`,
      { review: text },
      { timeout: 15000 },
    );

    return {
      sentiment: response.data?.sentiment || "neutral",
      confidence: Number(response.data?.confidence || 0),
      aspects: Array.isArray(response.data?.aspects) ? response.data.aspects : [],
      aspectInsights: Array.isArray(response.data?.aspectInsights)
        ? response.data.aspectInsights
        : [],
      summary: response.data?.summary || "",
    };
  } catch (error) {
    console.error("Sentiment API error:", error.message);
    return DEFAULT_SENTIMENT_RESULT;
  }
};

import axios from "axios";

const DEFAULT_SENTIMENT_RESULT = {
  sentiment: "neutral",
  confidence: 0,
  aspects: [],
  summary: "Sentiment service unavailable, saved as neutral.",
};

export const analyzeSentiment = async (comment) => {
  try {
    const apiUrl = process.env.SENTIMENT_API_URL || "http://localhost:8000";

    const response = await axios.post(
      `${apiUrl}/predict`,
      { review: comment },
      { timeout: 15000 }
    );

    return {
      sentiment: response.data?.sentiment || "neutral",
      confidence: Number(response.data?.confidence || 0),
      aspects: Array.isArray(response.data?.aspects) ? response.data.aspects : [],
      summary: response.data?.summary || "",
    };
  } catch (error) {
    console.error("Sentiment API error:", error.message);
    return DEFAULT_SENTIMENT_RESULT;
  }
};

import axios from "axios";
import crypto from "node:crypto";

const unavailableMessage = "The sentiment model is unavailable or returned invalid data. Start npm.cmd run sentiment, check SENTIMENT_API_URL, then retry analysis.";
export class SentimentServiceError extends Error {
  constructor() { super(unavailableMessage); this.code = "SENTIMENT_UNAVAILABLE"; this.status = 503; }
}
const endpoint = () => (process.env.SENTIMENT_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
export const reviewTextHash = text => crypto.createHash("sha256").update(text).digest("hex");
export const hasCurrentPrediction = review => review.sentimentAnalysis?.source === "model" &&
  review.sentimentAnalysis?.status === "completed" && review.sentimentAnalysis.textHash === reviewTextHash(review.text);
const labels = ["positive", "negative", "neutral", "mixed"];
const score = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

export async function sentimentHealth() {
  try {
    const { data } = await axios.get(`${endpoint()}/health`, { timeout: 2500 });
    if (data?.status !== "running" || typeof data.model !== "string") throw new Error("Invalid health response");
    return { available: true, model: data.model, modelVersion: data.modelVersion || null };
  } catch { return { available: false, message: unavailableMessage }; }
}

export function reviewAnalysisPayload(text, result) {
  return { sentiment: result.sentiment, sentimentScore: result.confidence, aspects: result.aspects,
    aspectInsights: result.aspectInsights, summary: result.summary,
    sentimentAnalysis: { source: "model", status: "completed", model: result.model || "Sentiment service",
      modelVersion: result.modelVersion || "", analyzedAt: new Date(), textHash: reviewTextHash(text) } };
}

const DEFAULT_SENTIMENT_RESULT = {
  sentiment: "neutral",
  confidence: 0,
  aspects: [],
  aspectInsights: [],
  summary: "Sentiment service unavailable",
};

export const analyzeSentiment = async (text, { strict = false } = {}) => {
  try {
    const apiUrl = endpoint();

    const response = await axios.post(
      `${apiUrl}/predict`,
      { review: text },
      { timeout: 15000, maxContentLength: 1_000_000 },
    );
    const data = response.data;
    if (!labels.includes(data?.sentiment) || !score(data.confidence) || typeof data.summary !== "string" || !data.summary.trim() ||
      !Array.isArray(data.aspects) || !data.aspects.every(a => typeof a === "string") ||
      !Array.isArray(data.aspectInsights) || !data.aspectInsights.every(a => a && typeof a.aspect === "string" && a.aspect.trim() && labels.includes(a.sentiment) && score(a.confidence) &&
        (a.mentions === undefined || Number.isSafeInteger(a.mentions) && a.mentions >= 1)))
      throw new Error("Invalid prediction response");
    return {
      sentiment: response.data?.sentiment || "neutral",
      confidence: Number(response.data?.confidence || 0),
      aspects: Array.isArray(response.data?.aspects) ? response.data.aspects : [],
      aspectInsights: Array.isArray(response.data?.aspectInsights)
        ? response.data.aspectInsights
        : [],
      summary: response.data?.summary || "",
      model: typeof data.model === "string" ? data.model : "Sentiment service",
      modelVersion: typeof data.modelVersion === "string" ? data.modelVersion : "",
    };
  } catch (error) {
    if (strict) throw new SentimentServiceError();
    console.error("Sentiment API unavailable. Check SENTIMENT_API_URL and start the model service.");
    return DEFAULT_SENTIMENT_RESULT;
  }
};

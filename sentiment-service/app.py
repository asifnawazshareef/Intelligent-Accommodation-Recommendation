"""
FastAPI service for the self-trained ISAR/IARS sentiment model.

Run locally:
uvicorn app:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Dict, List

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from text_preprocessing import detect_rule_based_sentiment, normalize_text

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "sentiment_pipeline.joblib"

ASPECT_KEYWORDS: Dict[str, List[str]] = {
    "cleanliness": ["clean", "dirty", "hygiene", "neat", "smell", "dust", "spotless", "filthy"],
    "staff": ["staff", "host", "receptionist", "service", "manager", "helpful", "rude", "friendly"],
    "location": ["location", "area", "nearby", "distance", "market", "center", "centre", "beach", "station"],
    "room": ["room", "bed", "bathroom", "shower", "toilet", "space", "suite", "window"],
    "wifi": ["wifi", "wi-fi", "internet", "network", "connection"],
    "value": ["price", "expensive", "cheap", "worth", "value", "money", "cost"],
    "facilities": ["ac", "air condition", "parking", "pool", "kitchen", "lift", "elevator", "heater", "facility", "facilities"],
    "food": ["breakfast", "dinner", "restaurant", "food", "meal", "bar"],
    "noise": ["noise", "noisy", "quiet", "sound", "loud"],
}


def load_model():
    if not MODEL_PATH.exists():
        raise RuntimeError(
            "Model file not found. Run `python train_model.py` before starting the API."
        )
    return joblib.load(MODEL_PATH)


model = load_model()
app = FastAPI(
    title="ISAR Sentiment Analysis API",
    version="1.0.0",
    description="Self-trained sentiment model API for hotel/accommodation reviews.",
)


class PredictRequest(BaseModel):
    review: str = Field(..., min_length=1, description="Guest review text")


class PredictResponse(BaseModel):
    sentiment: str
    confidence: float
    aspects: List[str]
    aspectInsights: List[dict]
    summary: str
    sentenceResults: List[dict]


def split_sentences(text: str) -> List[str]:
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 0]


# Split contrastive clauses so mixed reviews map aspects correctly
# e.g. "the room was clean but the Wi-Fi was poor"
CLAUSE_SPLITTERS = re.compile(
    r"\s*,?\s*\b(?:but|however|although|though|yet|while|whereas)\b\s*",
    re.IGNORECASE,
)


def split_analysis_units(text: str) -> List[str]:
    """Sentences split further on contrast words for per-clause aspect sentiment."""
    units: List[str] = []

    for sentence in split_sentences(text):
        clauses = CLAUSE_SPLITTERS.split(sentence)
        for clause in clauses:
            cleaned = clause.strip(" ,;")
            if len(cleaned) > 0:
                units.append(cleaned)

    return units if units else [text.strip()]


def detect_aspects(text: str) -> List[str]:
    lower_text = text.lower()
    found = []
    for aspect, keywords in ASPECT_KEYWORDS.items():
        if any(keyword in lower_text for keyword in keywords):
            found.append(aspect)
    return found


def make_summary(sentiment: str, aspect_insights: List[dict]) -> str:
    if not aspect_insights:
        return f"Review sentiment is {sentiment}."

    praise = [item["aspect"] for item in aspect_insights if item["sentiment"] == "positive"]
    concerns = [item["aspect"] for item in aspect_insights if item["sentiment"] == "negative"]

    if praise and concerns:
        return (
            f"Guest praised {', '.join(praise[:3])} "
            f"but raised concerns about {', '.join(concerns[:3])}."
        )
    if praise:
        return f"Guest gave positive feedback about {', '.join(praise[:4])}."
    if concerns:
        return f"Guest raised concerns about {', '.join(concerns[:4])}."
    if sentiment == "mixed":
        mentioned = ", ".join(item["aspect"] for item in aspect_insights[:4])
        return f"Guest shared mixed feedback about {mentioned}."
    mentioned = ", ".join(item["aspect"] for item in aspect_insights[:4])
    return f"Guest mentioned {mentioned} in a neutral way."


def build_aspect_insights(sentence_results: List[dict]) -> List[dict]:
    aspect_scores: Dict[str, Counter] = {}

    for item in sentence_results:
        for aspect in item["aspects"]:
            aspect_scores.setdefault(aspect, Counter())
            aspect_scores[aspect][item["sentiment"]] += 1

    insights = []
    for aspect, counter in aspect_scores.items():
        sentiment = counter.most_common(1)[0][0]
        mentions = sum(counter.values())
        confidence = counter[sentiment] / mentions if mentions else 0.0
        insights.append(
            {
                "aspect": aspect,
                "sentiment": sentiment,
                "confidence": round(float(confidence), 4),
                "mentions": int(mentions),
            }
        )

    return sorted(insights, key=lambda entry: entry["mentions"], reverse=True)


def predict_single(sentence: str) -> dict:
    normalized = normalize_text(sentence)
    rule_sentiment = detect_rule_based_sentiment(normalized)

    probabilities = model.predict_proba([normalized])[0]
    classes = list(model.classes_)
    best_index = int(probabilities.argmax())
    sentiment = classes[best_index]
    confidence = float(probabilities[best_index])

    if rule_sentiment and rule_sentiment != sentiment:
        sentiment = rule_sentiment
        confidence = max(confidence, 0.88)

    return {
        "text": sentence,
        "sentiment": sentiment,
        "confidence": round(confidence, 4),
        "aspects": detect_aspects(sentence),
    }


@app.get("/health")
def health():
    return {
        "status": "running",
        "service": "sentiment-analysis",
        "model": "TF-IDF (1-3 gram, negation-safe) + Logistic Regression",
    }


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    review = payload.review.strip()
    if not review:
        raise HTTPException(status_code=400, detail="Review text is required.")

    sentences = split_analysis_units(review)
    sentence_results = [predict_single(unit) for unit in sentences]

    sentiment_counts = Counter(item["sentiment"] for item in sentence_results)
    sentiments_found = set(sentiment_counts.keys())

    if "positive" in sentiments_found and "negative" in sentiments_found:
        overall_sentiment = "mixed"
    else:
        overall_sentiment = sentiment_counts.most_common(1)[0][0]

    avg_confidence = sum(item["confidence"] for item in sentence_results) / len(sentence_results)

    aspect_counter = Counter()
    for item in sentence_results:
        aspect_counter.update(item["aspects"])
    aspects = [aspect for aspect, _ in aspect_counter.most_common()]
    aspect_insights = build_aspect_insights(sentence_results)

    return {
        "sentiment": overall_sentiment,
        "confidence": round(float(avg_confidence), 4),
        "aspects": aspects,
        "aspectInsights": aspect_insights,
        "summary": make_summary(overall_sentiment, aspect_insights),
        "sentenceResults": sentence_results,
    }

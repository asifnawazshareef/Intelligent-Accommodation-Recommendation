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
    summary: str
    sentenceResults: List[dict]


def split_sentences(text: str) -> List[str]:
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 0]


def detect_aspects(text: str) -> List[str]:
    lower_text = text.lower()
    found = []
    for aspect, keywords in ASPECT_KEYWORDS.items():
        if any(keyword in lower_text for keyword in keywords):
            found.append(aspect)
    return found


def make_summary(sentiment: str, aspects: List[str]) -> str:
    if aspects:
        aspect_text = ", ".join(aspects[:4])
        if sentiment == "positive":
            return f"Guest gave positive feedback about {aspect_text}."
        if sentiment == "negative":
            return f"Guest gave negative feedback about {aspect_text}."
        if sentiment == "mixed":
            return f"Guest shared mixed feedback about {aspect_text}."
        return f"Guest mentioned {aspect_text} in a neutral way."
    return f"Review sentiment is {sentiment}."


def predict_single(sentence: str) -> dict:
    probabilities = model.predict_proba([sentence])[0]
    classes = list(model.classes_)
    best_index = int(probabilities.argmax())
    sentiment = classes[best_index]
    confidence = float(probabilities[best_index])
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
        "model": "TF-IDF + Logistic Regression",
    }


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    review = payload.review.strip()
    if not review:
        raise HTTPException(status_code=400, detail="Review text is required.")

    sentences = split_sentences(review)
    sentence_results = [predict_single(sentence) for sentence in sentences]

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

    return {
        "sentiment": overall_sentiment,
        "confidence": round(float(avg_confidence), 4),
        "aspects": aspects,
        "summary": make_summary(overall_sentiment, aspects),
        "sentenceResults": sentence_results,
    }

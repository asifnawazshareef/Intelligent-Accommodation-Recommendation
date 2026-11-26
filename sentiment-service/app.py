"""
FastAPI service for the self-trained ISAR/IARS sentiment model.

Run locally:
uvicorn app:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from review_analyzer import MODEL_PATH, ReviewAnalyzer, load_trained_model

BASE_DIR = Path(__file__).resolve().parent

# The trained scikit-learn pipeline. `scripts/sentiment.cjs check` imports it directly.
model = load_trained_model()
analyzer = ReviewAnalyzer(model)

MODEL_NAME = "Aspect-based hybrid: clause segmentation + opinion lexicon + TF-IDF (1-3 gram) Logistic Regression"
# Any change to the trained model or to the analysis rules gives a new version,
# so stored reviews show which analysis produced them.
_VERSIONED_FILES = (
    MODEL_PATH,
    Path(__file__),
    BASE_DIR / "review_analyzer.py",
    BASE_DIR / "clause_segmentation.py",
    BASE_DIR / "opinion_lexicon.py",
    BASE_DIR / "aspect_extraction.py",
    BASE_DIR / "text_preprocessing.py",
)
MODEL_VERSION = hashlib.sha256(b"".join(path.read_bytes() for path in _VERSIONED_FILES)).hexdigest()[:16]

app = FastAPI(
    title="ISAR Sentiment Analysis API",
    version="2.0.0",
    description="Self-trained, aspect-based sentiment analysis for hotel and accommodation reviews.",
)


class PredictRequest(BaseModel):
    review: str = Field(..., min_length=1, description="Guest review text")


class PredictResponse(BaseModel):
    model: str
    modelVersion: str
    sentiment: str
    confidence: float
    aspects: List[str]
    aspectInsights: List[dict]
    summary: str
    sentenceResults: List[dict]


@app.get("/health")
def health():
    return {
        "status": "running",
        "service": "sentiment-analysis",
        "model": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    review = payload.review.strip()
    if not review:
        raise HTTPException(status_code=400, detail="Review text is required.")

    return {"model": MODEL_NAME, "modelVersion": MODEL_VERSION, **analyzer.analyze(review)}

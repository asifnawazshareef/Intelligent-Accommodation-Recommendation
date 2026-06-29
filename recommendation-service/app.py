"""
FastAPI service for IARS ML accommodation recommendations.

Run locally:
uvicorn app:app --reload --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from feature_engineering import DEFAULT_PRICE, explain_match, extract_features, features_to_frame

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "recommendation_model.joblib"


def load_artifact():
    if not MODEL_PATH.exists():
        raise RuntimeError(
            "Recommendation model not found. Run `python train_model.py` first."
        )
    return joblib.load(MODEL_PATH)


artifact = load_artifact()
model = artifact["model"]
FEATURE_NAMES = artifact["feature_names"]

app = FastAPI(
    title="IARS Recommendation API",
    version="1.0.0",
    description="Hybrid ML recommendation service for hotels and apartments.",
)


class PropertyPayload(BaseModel):
    id: str
    title: str = ""
    city: str = ""
    country: str = "Pakistan"
    price: float = Field(default=DEFAULT_PRICE, ge=0)
    avgRating: Optional[float] = Field(default=None, ge=0, le=5)
    reviewCount: int = Field(default=0, ge=0)


class UserProfilePayload(BaseModel):
    preferredCities: List[str] = Field(default_factory=list)
    preferredPrice: float = Field(default=DEFAULT_PRICE, ge=0)
    priceMin: Optional[float] = Field(default=None, ge=0)
    priceMax: Optional[float] = Field(default=None, ge=0)
    bookedCities: List[str] = Field(default_factory=list)
    bookedAvgPrice: float = Field(default=0, ge=0)
    bookedCount: int = Field(default=0, ge=0)
    avgRatingGiven: float = Field(default=0, ge=0, le=5)
    languagePref: str = "en"
    excludePropertyIds: List[str] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    userProfile: UserProfilePayload
    properties: List[PropertyPayload]
    limit: int = Field(default=6, ge=1, le=20)
    globalBookingCounts: Dict[str, int] = Field(default_factory=dict)


class RecommendationItem(BaseModel):
    propertyId: str
    score: float
    matchReasons: List[str]


class RecommendResponse(BaseModel):
    engine: str
    count: int
    recommendations: List[RecommendationItem]


@app.get("/health")
def health():
    return {
        "status": "running",
        "service": "recommendation",
        "model": artifact.get("model_type", "Gradient Boosting Regressor"),
        "features": FEATURE_NAMES,
    }


@app.post("/recommend", response_model=RecommendResponse)
def recommend(payload: RecommendRequest):
    if not payload.properties:
        raise HTTPException(status_code=400, detail="At least one property is required.")

    profile = payload.userProfile.model_dump()
    exclude = set(profile.pop("excludePropertyIds", []))

    scored: List[RecommendationItem] = []

    for prop in payload.properties:
        if prop.id in exclude:
            continue

        property_dict = prop.model_dump()
        features = extract_features(profile, property_dict, payload.globalBookingCounts)
        feature_matrix = features_to_frame(features, FEATURE_NAMES)
        score = float(model.predict(feature_matrix)[0])
        score = max(0.0, min(1.0, score))

        scored.append(
            RecommendationItem(
                propertyId=prop.id,
                score=round(score, 4),
                matchReasons=explain_match(profile, property_dict, features),
            )
        )

    scored.sort(key=lambda item: item.score, reverse=True)
    recommendations = scored[: payload.limit]

    return {
        "engine": artifact.get("model_type", "Gradient Boosting Regressor"),
        "count": len(recommendations),
        "recommendations": recommendations,
    }

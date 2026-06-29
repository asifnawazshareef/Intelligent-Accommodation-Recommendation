"""
Shared feature extraction for IARS accommodation recommendation model.

Hybrid signals: search history, bookings, review ratings, and property quality.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence

import pandas as pd

FEATURE_NAMES: List[str] = [
    "city_match",
    "price_similarity",
    "price_in_budget",
    "property_rating_norm",
    "property_review_count_log",
    "user_avg_rating_given",
    "user_booked_count_norm",
    "user_search_city_freq",
    "booked_same_city",
    "price_vs_booked_avg",
    "collaborative_popularity",
    "language_region_match",
]

DEFAULT_PRICE = 15000.0
MAX_PRICE = 50000.0


def _normalize_price(price: float) -> float:
    bounded = max(0.0, min(float(price), MAX_PRICE))
    return bounded / MAX_PRICE


def _safe_log(value: float) -> float:
    return math.log1p(max(0.0, value))


def _city_key(city: str) -> str:
    return (city or "").strip().lower()


def _price_similarity(user_price: float, property_price: float) -> float:
    if user_price <= 0 or property_price <= 0:
        return 0.0
    ratio = abs(property_price - user_price) / max(user_price, property_price)
    return max(0.0, 1.0 - ratio)


def _price_in_budget(
    property_price: float,
    budget_min: Optional[float],
    budget_max: Optional[float],
) -> float:
    if budget_min is None and budget_max is None:
        return 0.5

    lower = budget_min if budget_min is not None else 0.0
    upper = budget_max if budget_max is not None else MAX_PRICE

    if lower > upper:
        lower, upper = upper, lower

    if lower <= property_price <= upper:
        return 1.0

    if property_price < lower:
        gap = lower - property_price
    else:
        gap = property_price - upper

    span = max(upper - lower, 1.0)
    return max(0.0, 1.0 - gap / span)


def build_city_weights(cities: Sequence[str]) -> Dict[str, float]:
    weights: Dict[str, float] = {}
    if not cities:
        return weights

    for city in cities:
        key = _city_key(city)
        if not key:
            continue
        weights[key] = weights.get(key, 0.0) + 1.0

    total = sum(weights.values()) or 1.0
    return {city: value / total for city, value in weights.items()}


def extract_features(
    user_profile: dict,
    property_item: dict,
    global_booking_counts: Optional[Dict[str, int]] = None,
) -> List[float]:
    """Build a fixed-length feature vector for one user-property pair."""
    preferred_cities = user_profile.get("preferredCities") or []
    city_weights = build_city_weights(preferred_cities)

    property_city = _city_key(property_item.get("city", ""))
    city_match = city_weights.get(property_city, 0.0)

    preferred_price = float(user_profile.get("preferredPrice") or DEFAULT_PRICE)
    property_price = float(property_item.get("price") or DEFAULT_PRICE)
    price_similarity = _price_similarity(preferred_price, property_price)

    budget_min = user_profile.get("priceMin")
    budget_max = user_profile.get("priceMax")
    price_in_budget = _price_in_budget(
        property_price,
        float(budget_min) if budget_min is not None else None,
        float(budget_max) if budget_max is not None else None,
    )

    avg_rating = float(property_item.get("avgRating") or 0.0)
    property_rating_norm = avg_rating / 5.0

    review_count = float(property_item.get("reviewCount") or 0.0)
    property_review_count_log = _safe_log(review_count) / _safe_log(100.0)

    user_avg_rating = float(user_profile.get("avgRatingGiven") or 0.0)
    user_avg_rating_given = user_avg_rating / 5.0

    booked_count = float(user_profile.get("bookedCount") or 0.0)
    user_booked_count_norm = min(booked_count, 10.0) / 10.0

    search_city_freq = city_match

    booked_cities = user_profile.get("bookedCities") or []
    booked_same_city = (
        1.0 if property_city and property_city in {_city_key(c) for c in booked_cities} else 0.0
    )

    booked_avg_price = float(user_profile.get("bookedAvgPrice") or 0.0)
    price_vs_booked_avg = (
        _price_similarity(booked_avg_price, property_price) if booked_avg_price > 0 else 0.0
    )

    property_id = str(property_item.get("id", ""))
    booking_count = 0
    if global_booking_counts and property_id:
        booking_count = global_booking_counts.get(property_id, 0)
    collaborative_popularity = min(float(booking_count), 20.0) / 20.0

    language_pref = (user_profile.get("languagePref") or "en").lower()
    country = (property_item.get("country") or "").lower()
    language_region_match = 1.0 if language_pref in {"ur", "ar"} and country == "pakistan" else 0.5

    return [
        city_match,
        price_similarity,
        price_in_budget,
        property_rating_norm,
        property_review_count_log,
        user_avg_rating_given,
        user_booked_count_norm,
        search_city_freq,
        booked_same_city,
        price_vs_booked_avg,
        collaborative_popularity,
        language_region_match,
    ]


def features_to_frame(
    features: Sequence[float],
    feature_names: Optional[Sequence[str]] = None,
) -> pd.DataFrame:
    """Return a single-row DataFrame with the model's expected column names."""
    columns = list(feature_names or FEATURE_NAMES)
    return pd.DataFrame([list(features)], columns=columns)


def explain_match(user_profile: dict, property_item: dict, features: List[float]) -> List[str]:
    """Human-readable reasons derived from the strongest feature signals."""
    reasons: List[str] = []
    feature_map = dict(zip(FEATURE_NAMES, features))

    if feature_map["city_match"] >= 0.25:
        reasons.append("matches_preferred_city")
    if feature_map["price_similarity"] >= 0.65 or feature_map["price_in_budget"] >= 0.85:
        reasons.append("matches_budget")
    if feature_map["booked_same_city"] >= 1.0:
        reasons.append("similar_to_past_stays")
    if feature_map["property_rating_norm"] >= 0.75:
        reasons.append("highly_rated")
    if feature_map["collaborative_popularity"] >= 0.5:
        reasons.append("popular_with_guests")
    if feature_map["price_vs_booked_avg"] >= 0.7:
        reasons.append("similar_price_to_bookings")

    if not reasons:
        if float(property_item.get("avgRating") or 0) >= 3.5:
            reasons.append("highly_rated")
        else:
            reasons.append("recommended_for_you")

    return reasons[:3]

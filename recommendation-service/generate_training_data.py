"""
Generate synthetic user-property interaction data for recommendation training.

Patterns encoded:
- Users prefer cities they search and book in
- Users prefer prices near their search/budget range
- Higher-rated properties receive stronger positive signals
- Bookings are stronger than searches
"""

from __future__ import annotations

import random
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

from feature_engineering import DEFAULT_PRICE, extract_features

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "training_interactions.csv"

CITIES = [
    ("Islamabad", "Pakistan"),
    ("Karachi", "Pakistan"),
    ("Lahore", "Pakistan"),
    ("Murree", "Pakistan"),
    ("Hunza", "Pakistan"),
    ("Dubai", "UAE"),
    ("Abu Dhabi", "UAE"),
]

PROPERTY_TEMPLATES = [
    "Pearl Continental {}",
    "Serena Hotel {}",
    "Marriott {}",
    "Guest House {}",
    "Executive Apartments {}",
    "Budget Inn {}",
    "Luxury Suites {}",
    "City View Hotel {}",
]


def _make_properties(count: int = 80, seed: int = 42) -> List[dict]:
    random.seed(seed)
    properties: List[dict] = []

    for index in range(count):
        city, country = random.choice(CITIES)
        template = random.choice(PROPERTY_TEMPLATES)
        price = random.choice([5000, 8000, 12000, 15000, 18000, 22000, 28000, 35000, 45000])
        avg_rating = round(random.uniform(2.5, 5.0), 1)
        review_count = random.randint(0, 120)

        properties.append(
            {
                "id": f"prop_{index}",
                "title": template.format(city),
                "city": city,
                "country": country,
                "price": float(price),
                "avgRating": avg_rating,
                "reviewCount": review_count,
            }
        )

    return properties


def _make_user_profile(
    user_id: int,
    properties: List[dict],
    seed: int,
) -> Tuple[dict, Dict[str, int]]:
    random.seed(seed + user_id)
    preferred_city = random.choice(CITIES)[0]
    budget_center = random.choice([8000, 12000, 15000, 20000, 25000, 30000])
    budget_spread = random.choice([2000, 4000, 6000, 8000])

    search_cities = [preferred_city]
    if random.random() > 0.4:
        search_cities.append(random.choice(CITIES)[0])

    booked_cities: List[str] = []
    booked_prices: List[float] = []
    booked_count = random.randint(0, 4)

    for _ in range(booked_count):
        city = random.choice(search_cities)
        booked_cities.append(city)
        booked_prices.append(budget_center + random.uniform(-budget_spread, budget_spread))

    avg_rating_given = round(random.uniform(3.0, 5.0), 2) if random.random() > 0.3 else 0.0

    profile = {
        "userId": f"user_{user_id}",
        "preferredCities": search_cities * random.randint(1, 4),
        "preferredPrice": budget_center,
        "priceMin": max(1000, budget_center - budget_spread),
        "priceMax": budget_center + budget_spread,
        "bookedCities": booked_cities,
        "bookedAvgPrice": float(np.mean(booked_prices)) if booked_prices else 0.0,
        "bookedCount": booked_count,
        "avgRatingGiven": avg_rating_given,
        "languagePref": random.choice(["en", "en", "ur", "ar"]),
    }

    booking_counts: Dict[str, int] = {}
    for prop in properties:
        if prop["city"] in booked_cities and random.random() > 0.7:
            booking_counts[prop["id"]] = booking_counts.get(prop["id"], 0) + 1

    return profile, booking_counts


def _interaction_strength(profile: dict, prop: dict, global_counts: Dict[str, int]) -> float:
    features = extract_features(profile, prop, global_counts)
    city_match, price_sim, in_budget, rating_norm, review_log, *_ = features

    score = (
        0.28 * city_match
        + 0.22 * price_sim
        + 0.18 * in_budget
        + 0.15 * rating_norm
        + 0.07 * review_log
        + 0.10 * min(global_counts.get(prop["id"], 0) / 10.0, 1.0)
    )

    if profile["bookedCount"] > 0 and prop["city"] in profile["bookedCities"]:
        score += 0.12

    noise = random.uniform(-0.08, 0.08)
    return float(max(0.0, min(1.0, score + noise)))


def generate_dataset(
    user_count: int = 350,
    samples_per_user: int = 24,
    seed: int = 42,
) -> pd.DataFrame:
    random.seed(seed)
    np.random.seed(seed)

    properties = _make_properties()
    global_counts: Dict[str, int] = {}

    rows: List[dict] = []

    for user_index in range(user_count):
        profile, user_bookings = _make_user_profile(user_index, properties, seed)

        for prop_id, count in user_bookings.items():
            global_counts[prop_id] = global_counts.get(prop_id, 0) + count

        sampled_properties = random.sample(properties, min(samples_per_user, len(properties)))

        for prop in sampled_properties:
            strength = _interaction_strength(profile, prop, global_counts)
            label = 1 if strength >= 0.55 else 0

            feature_values = extract_features(profile, prop, global_counts)
            row = {
                "user_id": profile["userId"],
                "property_id": prop["id"],
                "interaction_strength": strength,
                "label": label,
            }

            for name, value in zip(
                [
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
                ],
                feature_values,
            ):
                row[name] = value

            rows.append(row)

    df = pd.DataFrame(rows)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(DATA_PATH, index=False)
    return df


if __name__ == "__main__":
    dataset = generate_dataset()
    positive_rate = dataset["label"].mean()
    print(f"Generated {len(dataset)} training rows at {DATA_PATH}")
    print(f"Positive interaction rate: {positive_rate:.2%}")
